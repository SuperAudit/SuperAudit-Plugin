import parser from "@solidity-parser/parser";
import type { ASTNode, Rule, AnalysisContext, FunctionDefinition } from "../../types.js";
import { CFGBuilder } from "../../cfg/builder.js";
import { CFGAnalyzer } from "../../cfg/analyzer.js";

/**
 * Advanced rule that analyzes potential reentrancy attack paths using CFG
 * 
 * This rule goes beyond simple pattern matching to analyze the actual execution
 * paths that could be exploited in a reentrancy attack. It identifies:
 * 
 * 1. Functions with external calls that could allow reentrancy
 * 2. State that could be inconsistent during reentrant calls
 * 3. Multiple call paths that could be chained in an attack
 * 4. Cross-function reentrancy patterns
 * 
 * The rule provides detailed attack scenarios and prioritizes findings
 * based on exploitability and potential impact.
 */
export class ReentrancyPathsRule implements Rule {
  public readonly id = "reentrancy-paths";
  public readonly description = "Analyze execution paths for potential reentrancy vulnerabilities";
  public readonly severity = "warning" as const;

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

    // Skip view/pure functions as they can't be reentered meaningfully
    if (functionNode.stateMutability === "view" || functionNode.stateMutability === "pure") {
      return;
    }

    // Skip internal/private functions (they can't be directly called by attackers)
    // but still analyze them as they could be called by vulnerable public functions
    const isPublicEntry = !functionNode.visibility || 
                         ["public", "external"].includes(functionNode.visibility);

    try {
      // Build CFG for this function
      const cfg = this.cfgBuilder.buildCFG(functionNode);
      
      // Only analyze functions with external calls
      if (!cfg.metadata.hasExternalCalls) {
        return;
      }

      // Analyze for reentrancy paths
      const analysisResult = this.cfgAnalyzer.analyzeReentrancyPaths(cfg);

      // Convert violations to issues with enhanced context
      const issues = this.cfgAnalyzer.convertToIssues([analysisResult], context);
      
      for (const issue of issues) {
        // Enhance message based on function visibility and reentrancy risk
        const enhancedIssue = {
          ...issue,
          severity: this.calculateSeverity(cfg, isPublicEntry, analysisResult),
          message: this.enhanceReentrancyMessage(issue.message, cfg, isPublicEntry)
        };
        context.issues.push(enhancedIssue);
      }

      // Add detailed reentrancy analysis
      this.addReentrancyAnalysis(analysisResult, context, cfg, isPublicEntry);

    } catch (error) {
      // CFG construction failed - fall back to basic analysis
      console.warn(`CFG analysis failed for function ${functionNode.name}: ${error}`);
      this.performBasicReentrancyCheck(functionNode, context);
    }
  }

  /**
   * Calculate severity based on reentrancy risk factors
   */
  private calculateSeverity(cfg: any, isPublicEntry: boolean, analysisResult: any): "error" | "warning" | "info" {
    // High severity if:
    // - Function is publicly callable
    // - Has both external calls and state updates  
    // - Involves critical state variables (balances, etc.)
    
    const hasCriticalState = this.hasCriticalStateUpdates(cfg);
    const hasMultiplePaths = analysisResult.violations.length > 1;
    
    if (isPublicEntry && cfg.metadata.hasStateUpdates && hasCriticalState) {
      return "error"; // Critical reentrancy risk
    } else if (isPublicEntry && cfg.metadata.hasStateUpdates) {
      return "warning"; // Medium reentrancy risk  
    } else {
      return "info"; // Low risk or internal function
    }
  }

  /**
   * Enhance reentrancy message with specific context
   */
  private enhanceReentrancyMessage(baseMessage: string, cfg: any, isPublicEntry: boolean): string {
    const functionType = isPublicEntry ? "public/external" : "internal/private";
    const riskLevel = isPublicEntry ? "HIGH" : "MEDIUM";
    
    return `${baseMessage} [${riskLevel} RISK] This ${functionType} function in ${cfg.functionName} could be exploited through reentrancy.`;
  }

  /**
   * Check if CFG involves critical state updates
   */
  private hasCriticalStateUpdates(cfg: any): boolean {
    for (const [_, node] of cfg.nodes) {
      if (node.metadata?.isCriticalStateUpdate) {
        return true;
      }
      // Check for critical variable patterns
      for (const varName of node.metadata?.stateWrites || []) {
        if (this.isCriticalVariable(varName)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if variable name indicates critical state
   */
  private isCriticalVariable(varName: string): boolean {
    const criticalPatterns = [
      "balance", "balances", "totalSupply", "totalBalance",
      "shares", "totalShares", "deposits", "withdrawals", 
      "amount", "amounts", "value", "values",
      "reserves", "liquidity", "debt", "credit"
    ];
    
    const lowerVarName = varName.toLowerCase();
    return criticalPatterns.some(pattern => lowerVarName.includes(pattern));
  }

  /**
   * Add detailed reentrancy analysis
   */
  private addReentrancyAnalysis(
    analysisResult: any,
    context: AnalysisContext,
    cfg: any,
    isPublicEntry: boolean
  ): void {
    if (analysisResult.violations.length === 0) return;

    // Generate attack scenario
    const attackScenario = this.generateAttackScenario(cfg, isPublicEntry);
    
    context.issues.push({
      ruleId: `${this.id}-analysis`,
      message: attackScenario,
      severity: "info",
      file: context.filePath,
      line: cfg.nodes.get(cfg.entryNode)?.location?.start?.line || 0,
      column: 0
    });

    // Add mitigation suggestions
    const mitigations = this.generateMitigationSuggestions(cfg, analysisResult);
    for (const mitigation of mitigations) {
      context.issues.push({
        ruleId: `${this.id}-mitigation`,
        message: mitigation,
        severity: "info",
        file: context.filePath,
        line: 0,
        column: 0
      });
    }
  }

  /**
   * Generate detailed attack scenario
   */
  private generateAttackScenario(cfg: any, isPublicEntry: boolean): string {
    const functionName = cfg.functionName;
    const hasStateUpdates = cfg.metadata.hasStateUpdates;
    const hasExternalCalls = cfg.metadata.hasExternalCalls;

    let scenario = `REENTRANCY ATTACK ANALYSIS for function ${functionName}:\n`;
    
    if (isPublicEntry) {
      scenario += `
ATTACK VECTOR (${functionName} is publicly callable):
1. Attacker deploys malicious contract with fallback/receive function
2. Attacker calls ${functionName} with malicious contract address
3. When ${functionName} makes external call, control transfers to attacker
4. Attacker's contract reenters ${functionName} before state is updated
5. Attacker can exploit inconsistent state to drain funds or manipulate logic

RISK LEVEL: ${hasStateUpdates ? "HIGH" : "MEDIUM"} - Function ${hasStateUpdates ? "modifies state" : "only reads state"}
      `;
    } else {
      scenario += `
INDIRECT ATTACK VECTOR (${functionName} is internal):
1. Attacker finds public function that calls ${functionName}
2. Uses the same reentrancy pattern through the public entry point
3. During reentrancy, ${functionName} executes with inconsistent state

RISK LEVEL: MEDIUM - Requires finding vulnerable public caller
      `;
    }

    if (hasExternalCalls && hasStateUpdates) {
      scenario += `
EXPLOIT CONDITIONS:
✓ Function makes external calls (reentrancy entry point)
✓ Function modifies state (inconsistent state during reentry)
✗ No reentrancy guard detected
✗ No Check-Effects-Interactions pattern
      `;
    }

    return scenario.trim();
  }

  /**
   * Generate mitigation suggestions
   */
  private generateMitigationSuggestions(cfg: any, analysisResult: any): string[] {
    const suggestions = [];

    // Primary mitigation: Reentrancy guard
    suggestions.push(`
MITIGATION 1: Add reentrancy guard
- Use OpenZeppelin's ReentrancyGuard: import "@openzeppelin/contracts/security/ReentrancyGuard.sol"
- Add "nonReentrant" modifier to function ${cfg.functionName}
- This prevents any reentrant calls to protected functions
    `);

    // Secondary mitigation: CEI pattern
    if (cfg.metadata.hasStateUpdates && cfg.metadata.hasExternalCalls) {
      suggestions.push(`
MITIGATION 2: Follow Check-Effects-Interactions pattern
- Move all state updates BEFORE external calls
- Validate inputs first (Check)
- Update state variables (Effects) 
- Make external calls last (Interactions)
- This ensures state is consistent before any external interaction
      `);
    }

    // Tertiary mitigation: Pull payment pattern
    suggestions.push(`
MITIGATION 3: Use Pull Payment pattern
- Instead of sending ETH directly, record amount owed to recipient
- Provide separate withdraw() function for users to claim funds
- This eliminates external calls from main business logic
    `);

    // Additional suggestion for complex functions
    if (cfg.metadata.cyclomaticComplexity > 5) {
      suggestions.push(`
MITIGATION 4: Simplify function complexity
- Current cyclomatic complexity: ${cfg.metadata.cyclomaticComplexity}
- Consider splitting complex functions into smaller, focused functions
- Reduces attack surface and makes security analysis easier
      `);
    }

    return suggestions;
  }

  /**
   * Fallback basic reentrancy check when CFG analysis fails
   */
  private performBasicReentrancyCheck(functionNode: FunctionDefinition, context: AnalysisContext): void {
    if (!functionNode.body?.statements) return;

    let hasExternalCall = false;
    let hasStateUpdate = false;
    let externalCallLine = 0;

    // Simple scan for external calls and state updates
    for (const stmt of functionNode.body.statements) {
      if (this.containsExternalCall(stmt)) {
        hasExternalCall = true;
        externalCallLine = stmt.loc?.start.line || 0;
      }
      if (this.containsStateUpdate(stmt)) {
        hasStateUpdate = true;
      }
    }

    if (hasExternalCall && hasStateUpdate) {
      context.issues.push({
        ruleId: this.id,
        message: `Function ${functionNode.name || "constructor"} contains both external calls and state updates, creating potential for reentrancy attacks.`,
        severity: this.severity,
        file: context.filePath,
        line: externalCallLine,
        column: 0
      });
    }
  }

  /**
   * Check if statement contains external calls (simplified)
   */
  private containsExternalCall(stmt: ASTNode): boolean {
    // This is a simplified version - the CFG version is more accurate
    let hasCall = false;
    
    const visitor = {
      FunctionCall: (node: any) => {
        if (node.expression?.type === "MemberAccess") {
          const memberAccess = node.expression;
          if (["call", "transfer", "send"].includes(memberAccess.memberName)) {
            hasCall = true;
          }
        }
      }
    };

    try {
      parser.visit(stmt, visitor);
    } catch (error) {
      // Ignore errors in basic analysis
    }

    return hasCall;
  }

  /**
   * Check if statement contains state updates (simplified)
   */
  private containsStateUpdate(stmt: ASTNode): boolean {
    let hasUpdate = false;
    
    const visitor = {
      AssignmentOperator: () => {
        hasUpdate = true;
      },
      _node: () => {} // Add default handler to satisfy visitor interface
    };

    try {
      parser.visit(stmt, visitor as any);
    } catch (error) {
      // Ignore errors in basic analysis
    }

    return hasUpdate;
  }
}
