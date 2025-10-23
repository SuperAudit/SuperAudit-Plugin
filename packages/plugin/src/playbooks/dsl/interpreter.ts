import parser from "@solidity-parser/parser";
import type { 
  ASTNode, 
  Rule, 
  AnalysisContext, 
  FunctionDefinition,
  ContractDefinition 
} from "../../types.js";
import type { ParsedRule, ParsedStaticRule } from "../types.js";
import { CFGBuilder } from "../../cfg/builder.js";
import { CFGAnalyzer } from "../../cfg/analyzer.js";

/**
 * Interprets parsed rule DSL into executable analysis logic
 */
export class DSLInterpreter {
  private cfgBuilder = new CFGBuilder();
  private cfgAnalyzer = new CFGAnalyzer();

  /**
   * Convert a parsed static rule into an executable Rule object
   */
  createRuleFromDSL(parsedRule: ParsedStaticRule): Rule {
    return new DSLRule(parsedRule, this.cfgBuilder, this.cfgAnalyzer);
  }

  /**
   * Create multiple rules from parsed DSL rules
   */
  createRulesFromDSL(parsedRules: ParsedStaticRule[]): Rule[] {
    return parsedRules
      .filter(rule => rule.enabled)
      .map(rule => this.createRuleFromDSL(rule));
  }
}

/**
 * Dynamic rule implementation based on DSL specification
 */
class DSLRule implements Rule {
  public readonly id: string;
  public readonly description: string;
  public readonly severity: "error" | "warning" | "info";

  constructor(
    private parsedRule: ParsedStaticRule,
    private cfgBuilder: CFGBuilder,
    private cfgAnalyzer: CFGAnalyzer
  ) {
    this.id = parsedRule.id;
    this.description = parsedRule.description || `DSL rule: ${parsedRule.rule.type}`;
    this.severity = this.mapSeverity(parsedRule.severity);
  }

  apply(ast: ASTNode, context: AnalysisContext): void {
    const ruleType = this.parsedRule.rule.type;

    switch (ruleType) {
      case "order":
        this.applyOrderRule(ast, context);
        break;
      case "pattern":
        this.applyPatternRule(ast, context);
        break;
      case "access":
        this.applyAccessRule(ast, context);
        break;
      case "value":
        this.applyValueRule(ast, context);
        break;
      case "custom":
        this.applyCustomRule(ast, context);
        break;
      default:
        console.warn(`Unknown rule type: ${ruleType}`);
    }
  }

  /**
   * Apply execution order rules (requires CFG analysis)
   */
  private applyOrderRule(ast: ASTNode, context: AnalysisContext): void {
    const { method, ...params } = this.parsedRule.rule.params;

    parser.visit(ast, {
      FunctionDefinition: (node: FunctionDefinition) => {
        try {
          const cfg = this.cfgBuilder.buildCFG(node);
          
          switch (method) {
            case "externalBefore":
              this.checkExternalBefore(cfg, params, context, node);
              break;
            case "stateAfter":
              this.checkStateAfter(cfg, params, context, node);
              break;
            default:
              console.warn(`Unknown order method: ${method}`);
          }
        } catch (error) {
          // CFG analysis failed, skip this function
          console.warn(`CFG analysis failed for ${node.name}: ${error}`);
        }
      }
    });
  }

  /**
   * Check external calls before state updates
   */
  private checkExternalBefore(cfg: any, params: any, context: AnalysisContext, node: FunctionDefinition): void {
    const stateVars = params.state || [];
    const analysisResult = this.cfgAnalyzer.analyzeExternalBeforeState(cfg, stateVars);
    
    for (const violation of analysisResult.violations) {
      context.issues.push({
        ruleId: this.id,
        message: `${this.description}: ${violation.description}`,
        severity: this.severity,
        file: context.filePath,
        line: violation.location.start.line,
        column: violation.location.start.column
      });
    }
  }

  /**
   * Check state updates after specific calls
   */
  private checkStateAfter(cfg: any, params: any, context: AnalysisContext, node: FunctionDefinition): void {
    const requiredCalls = params.calls || [];
    // Implementation would check that state is updated after the specified calls
    // This is a simplified version
    
    if (cfg.metadata.hasExternalCalls && cfg.metadata.hasStateUpdates) {
      context.issues.push({
        ruleId: this.id,
        message: `${this.description}: Function ${node.name} should update state after calls: ${requiredCalls.join(", ")}`,
        severity: this.severity,
        file: context.filePath,
        line: node.loc?.start.line || 0,
        column: node.loc?.start.column || 0
      });
    }
  }

  /**
   * Apply pattern matching rules
   */
  private applyPatternRule(ast: ASTNode, context: AnalysisContext): void {
    const { method, ...params } = this.parsedRule.rule.params;

    switch (method) {
      case "transferFrom":
        this.checkTransferFromPattern(ast, params, context);
        break;
      case "delegatecall":
        this.checkDelegatecallPattern(ast, params, context);
        break;
      case "lowLevelCall":
        this.checkLowLevelCallPattern(ast, params, context);
        break;
      default:
        this.checkGenericPattern(ast, method, params, context);
    }
  }

  /**
   * Check transferFrom patterns (e.g., unchecked return values)
   */
  private checkTransferFromPattern(ast: ASTNode, params: any, context: AnalysisContext): void {
    parser.visit(ast, {
      FunctionCall: (node: any) => {
        if (this.isTransferFromCall(node)) {
          if (params.checkedReturn === false || params["!checkedReturn"]) {
            // Check if return value is checked
            if (!this.isReturnValueChecked(node)) {
              context.issues.push({
                ruleId: this.id,
                message: `${this.description}: transferFrom call without checking return value`,
                severity: this.severity,
                file: context.filePath,
                line: node.loc?.start.line || 0,
                column: node.loc?.start.column || 0
              });
            }
          }
        }
      }
    });
  }

  /**
   * Check delegatecall patterns
   */
  private checkDelegatecallPattern(ast: ASTNode, params: any, context: AnalysisContext): void {
    parser.visit(ast, {
      FunctionCall: (node: any) => {
        if (this.isDelegatecallCall(node)) {
          const target = params.target;
          if (target === "untrusted" && this.isUntrustedTarget(node)) {
            context.issues.push({
              ruleId: this.id,
              message: `${this.description}: delegatecall to untrusted target`,
              severity: this.severity,
              file: context.filePath,
              line: node.loc?.start.line || 0,
              column: node.loc?.start.column || 0
            });
          }
        }
      }
    });
  }

  /**
   * Check low-level call patterns
   */
  private checkLowLevelCallPattern(ast: ASTNode, params: any, context: AnalysisContext): void {
    const lowLevelMethods = ["call", "staticcall", "delegatecall", "send"];
    
    parser.visit(ast, {
      FunctionCall: (node: any) => {
        if (node.expression?.type === "MemberAccess") {
          const memberAccess = node.expression;
          if (lowLevelMethods.includes(memberAccess.memberName)) {
            context.issues.push({
              ruleId: this.id,
              message: `${this.description}: Low-level call detected: ${memberAccess.memberName}`,
              severity: this.severity,
              file: context.filePath,
              line: node.loc?.start.line || 0,
              column: node.loc?.start.column || 0
            });
          }
        }
      }
    });
  }

  /**
   * Check generic pattern (fallback for unknown patterns)
   */
  private checkGenericPattern(ast: ASTNode, pattern: string, params: any, context: AnalysisContext): void {
    // Generic pattern matching - look for method name in function calls
    parser.visit(ast, {
      FunctionCall: (node: any) => {
        if (this.matchesPattern(node, pattern)) {
          context.issues.push({
            ruleId: this.id,
            message: `${this.description}: Pattern '${pattern}' detected`,
            severity: this.severity,
            file: context.filePath,
            line: node.loc?.start.line || 0,
            column: node.loc?.start.column || 0
          });
        }
      }
    });
  }

  /**
   * Apply access control rules
   */
  private applyAccessRule(ast: ASTNode, context: AnalysisContext): void {
    const { method, ...params } = this.parsedRule.rule.params;

    switch (method) {
      case "missingOwnable":
        this.checkMissingOwnable(ast, params, context);
        break;
      case "publicFunction":
        this.checkPublicFunction(ast, params, context);
        break;
      default:
        console.warn(`Unknown access method: ${method}`);
    }
  }

  /**
   * Check for missing access control (Ownable pattern)
   */
  private checkMissingOwnable(ast: ASTNode, params: any, context: AnalysisContext): void {
    const targetFunctions = params.functions || [];
    
    parser.visit(ast, {
      FunctionDefinition: (node: FunctionDefinition) => {
        const functionName = node.name || "";
        
        if (targetFunctions.length === 0 || targetFunctions.includes(functionName)) {
          if (this.isPublicFunction(node) && !this.hasAccessControl(node)) {
            context.issues.push({
              ruleId: this.id,
              message: `${this.description}: Function '${functionName}' is missing access control`,
              severity: this.severity,
              file: context.filePath,
              line: node.loc?.start.line || 0,
              column: node.loc?.start.column || 0
            });
          }
        }
      }
    });
  }

  /**
   * Check public function security
   */
  private checkPublicFunction(ast: ASTNode, params: any, context: AnalysisContext): void {
    const isCritical = params.critical;
    
    parser.visit(ast, {
      FunctionDefinition: (node: FunctionDefinition) => {
        if (this.isPublicFunction(node)) {
          if (isCritical && this.isCriticalFunction(node)) {
            context.issues.push({
              ruleId: this.id,
              message: `${this.description}: Critical public function '${node.name}' needs extra security review`,
              severity: this.severity,
              file: context.filePath,
              line: node.loc?.start.line || 0,
              column: node.loc?.start.column || 0
            });
          }
        }
      }
    });
  }

  /**
   * Apply value/range rules
   */
  private applyValueRule(ast: ASTNode, context: AnalysisContext): void {
    const { method, ...params } = this.parsedRule.rule.params;

    switch (method) {
      case "range":
        this.checkValueRange(ast, params, context);
        break;
      default:
        console.warn(`Unknown value method: ${method}`);
    }
  }

  /**
   * Check value ranges
   */
  private checkValueRange(ast: ASTNode, params: any, context: AnalysisContext): void {
    const variable = params.variable;
    const min = params.min;
    const max = params.max;

    // This is a simplified implementation
    // In practice, would need more sophisticated static analysis
    context.issues.push({
      ruleId: this.id,
      message: `${this.description}: Value range check for '${variable}' (${min}-${max})`,
      severity: this.severity,
      file: context.filePath,
      line: 0,
      column: 0
    });
  }

  /**
   * Apply custom rules
   */
  private applyCustomRule(ast: ASTNode, context: AnalysisContext): void {
    // Custom rules would be implemented by loading external modules
    // For now, just log that we encountered a custom rule
    context.issues.push({
      ruleId: this.id,
      message: `${this.description}: Custom rule not implemented`,
      severity: "info",
      file: context.filePath,
      line: 0,
      column: 0
    });
  }

  // Helper methods for pattern matching
  private isTransferFromCall(node: any): boolean {
    return node.expression?.type === "MemberAccess" && 
           node.expression.memberName === "transferFrom";
  }

  private isDelegatecallCall(node: any): boolean {
    return node.expression?.type === "MemberAccess" && 
           node.expression.memberName === "delegatecall";
  }

  private isReturnValueChecked(node: any): boolean {
    // Simplified check - would need more sophisticated analysis
    return false; // Assume not checked for demo purposes
  }

  private isUntrustedTarget(node: any): boolean {
    // Simplified check - would analyze if target is from user input
    return true; // Assume untrusted for demo purposes
  }

  private matchesPattern(node: any, pattern: string): boolean {
    if (node.expression?.type === "Identifier") {
      return node.expression.name === pattern;
    }
    if (node.expression?.type === "MemberAccess") {
      return node.expression.memberName === pattern;
    }
    return false;
  }

  private isPublicFunction(node: FunctionDefinition): boolean {
    return !node.visibility || ["public", "external"].includes(node.visibility);
  }

  private hasAccessControl(node: FunctionDefinition): boolean {
    // Simplified check - would look for require statements or modifiers
    return false; // Assume no access control for demo purposes
  }

  private isCriticalFunction(node: FunctionDefinition): boolean {
    const criticalNames = ["withdraw", "transfer", "mint", "burn", "admin"];
    const functionName = (node.name || "").toLowerCase();
    return criticalNames.some(name => functionName.includes(name));
  }

  private mapSeverity(severity: string): "error" | "warning" | "info" {
    switch (severity) {
      case "critical":
      case "high":
        return "error";
      case "medium":
        return "warning";
      case "low":
      case "info":
      default:
        return "info";
    }
  }
}
