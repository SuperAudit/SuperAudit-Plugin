import parser from "@solidity-parser/parser";
import type { ASTNode, Rule, AnalysisContext, FunctionDefinition } from "../../types.js";
import { CFGBuilder } from "../../cfg/builder.js";
import { CFGAnalyzer } from "../../cfg/analyzer.js";

/**
 * Advanced rule that detects external calls before state updates (CEI pattern violation)
 * 
 * This rule uses Control Flow Graph (CFG) analysis to detect when external calls
 * occur before critical state updates, which violates the Check-Effects-Interactions
 * pattern and can lead to reentrancy vulnerabilities.
 * 
 * The rule is more sophisticated than simple AST pattern matching because it:
 * 1. Tracks execution paths through the function
 * 2. Identifies the order of external calls vs state updates
 * 3. Considers different control flow branches
 * 4. Focuses on critical state variables (balances, shares, etc.)
 */
export class ExternalBeforeStateRule implements Rule {
  public readonly id = "external-before-state";
  public readonly description = "External calls should not occur before critical state updates (Check-Effects-Interactions pattern)";
  public readonly severity = "error" as const;

  private cfgBuilder = new CFGBuilder();
  private cfgAnalyzer = new CFGAnalyzer();

  apply(ast: ASTNode, context: AnalysisContext): void {
    parser.visit(ast, {
      FunctionDefinition: (node: FunctionDefinition) => {
        this.checkFunction(node, context);
      }
    });
  }

  private checkFunction(functionNode: FunctionDefinition, context: AnalysisContext): void {
    // Skip functions without body
    if (!functionNode.body || !functionNode.body.statements) {
      return;
    }

    // Skip view/pure functions as they can't modify state
    if (functionNode.stateMutability === "view" || functionNode.stateMutability === "pure") {
      return;
    }

    try {
      // Build CFG for this function
      const cfg = this.cfgBuilder.buildCFG(functionNode);
      
      // Only analyze functions that have both external calls and state updates
      if (!cfg.metadata.hasExternalCalls || !cfg.metadata.hasStateUpdates) {
        return;
      }

      // Analyze for CEI pattern violations
      const criticalStateVars = this.identifyCriticalStateVars(context);
      const analysisResult = this.cfgAnalyzer.analyzeExternalBeforeState(cfg, criticalStateVars);

      // Convert violations to issues
      const issues = this.cfgAnalyzer.convertToIssues([analysisResult], context);
      context.issues.push(...issues);

      // Add additional context for critical violations
      for (const violation of analysisResult.violations) {
        if (violation.severity === "critical") {
          context.issues.push({
            ruleId: `${this.id}-context`,
            message: this.generateDetailedExplanation(violation, cfg.functionName),
            severity: "info",
            file: context.filePath,
            line: violation.location.start.line,
            column: violation.location.start.column
          });
        }
      }

    } catch (error) {
      // CFG construction failed - fall back to basic analysis
      console.warn(`CFG analysis failed for function ${functionNode.name}: ${error}`);
      this.performBasicAnalysis(functionNode, context);
    }
  }

  /**
   * Fallback basic analysis when CFG construction fails
   */
  private performBasicAnalysis(functionNode: FunctionDefinition, context: AnalysisContext): void {
    if (!functionNode.body?.statements) return;

    let hasExternalCall = false;
    let externalCallLine = 0;

    // Simple linear scan for external calls followed by state updates
    for (const stmt of functionNode.body.statements) {
      if (this.containsExternalCall(stmt)) {
        hasExternalCall = true;
        externalCallLine = stmt.loc?.start.line || 0;
      } else if (hasExternalCall && this.containsStateUpdate(stmt)) {
        context.issues.push({
          ruleId: this.id,
          message: "External call detected before state update. This may violate the Check-Effects-Interactions pattern and allow reentrancy attacks.",
          severity: this.severity,
          file: context.filePath,
          line: externalCallLine,
          column: stmt.loc?.start.column || 0
        });
        break;
      }
    }
  }

  /**
   * Identify critical state variables that should be updated before external calls
   */
  private identifyCriticalStateVars(context: AnalysisContext): string[] {
    // Extract variable names from source code that match critical patterns
    const criticalPatterns = [
      /\b(balance|balances)\b/gi,
      /\b(total.*supply|totalSupply)\b/gi,
      /\b(shares|totalShares)\b/gi,
      /\b(deposits|withdrawals)\b/gi,
      /\b(reserves|reserve)\b/gi,
      /\b(amount|amounts)\b/gi
    ];

    const criticalVars: string[] = [];
    
    for (const pattern of criticalPatterns) {
      const matches = context.sourceCode.match(pattern);
      if (matches) {
        criticalVars.push(...matches.map(match => match.toLowerCase()));
      }
    }

    return [...new Set(criticalVars)]; // Remove duplicates
  }

  /**
   * Generate detailed explanation for critical violations
   */
  private generateDetailedExplanation(violation: any, functionName: string): string {
    return `
REENTRANCY RISK ANALYSIS:
Function: ${functionName}
Issue: External call occurs before state update

ATTACK SCENARIO:
1. Attacker calls function ${functionName}
2. Function makes external call (line ${violation.location.start.line})  
3. Attacker's contract receives call and reenters ${functionName}
4. State variables are in inconsistent state during reentrant call
5. Attacker can exploit this inconsistency

RECOMMENDATION:
Follow the Check-Effects-Interactions (CEI) pattern:
1. CHECK: Validate inputs and conditions
2. EFFECTS: Update all state variables
3. INTERACTIONS: Make external calls last

Consider using OpenZeppelin's ReentrancyGuard modifier as additional protection.
    `.trim();
  }

  /**
   * Check if statement contains external calls (basic version)
   */
  private containsExternalCall(stmt: ASTNode): boolean {
    let hasCall = false;
    
    const visitor = {
      FunctionCall: (node: any) => {
        if (node.expression?.type === "MemberAccess") {
          const memberAccess = node.expression;
          // Check for common external call patterns
          if (["call", "transfer", "send", "delegatecall"].includes(memberAccess.memberName)) {
            hasCall = true;
          }
          // Check for calls to other contracts (not this, msg, block, tx)
          if (memberAccess.expression?.type === "Identifier") {
            const target = memberAccess.expression.name;
            if (!["this", "msg", "block", "tx"].includes(target)) {
              hasCall = true;
            }
          }
        }
      }
    };

    try {
      parser.visit(stmt, visitor);
    } catch (error) {
      // Ignore parse errors in basic analysis
    }

    return hasCall;
  }

  /**
   * Check if statement contains state updates (basic version)
   */
  private containsStateUpdate(stmt: ASTNode): boolean {
    let hasUpdate = false;
    
    const visitor = {
      AssignmentOperator: (node: any) => {
        // Check if left side is a state variable (simplified)
        if (node.left?.type === "Identifier" || node.left?.type === "MemberAccess") {
          hasUpdate = true;
        }
      },
      _node: () => {} // Add default handler to satisfy visitor interface
    };

    try {
      parser.visit(stmt, visitor as any);
    } catch (error) {
      // Ignore parse errors in basic analysis
    }

    return hasUpdate;
  }
}
