import parser from "@solidity-parser/parser";
import type { ASTNode, Rule, AnalysisContext, FunctionDefinition } from "../../types.js";
import { CFGBuilder } from "../../cfg/builder.js";
import { CFGAnalyzer } from "../../cfg/analyzer.js";

/**
 * Advanced rule that detects unreachable code using CFG analysis
 * 
 * This rule uses Control Flow Graph analysis to identify code that can never
 * be executed due to the control flow structure. Common causes include:
 * 1. Code after return statements
 * 2. Code in unreachable branches (e.g., after revert without condition)
 * 3. Code after infinite loops
 * 4. Dead code due to conditional logic errors
 * 
 * Unlike simple AST analysis, this rule can detect complex unreachable
 * patterns across multiple control flow branches.
 */
export class UnreachableCodeRule implements Rule {
  public readonly id = "unreachable-code";
  public readonly description = "Detect unreachable code that can never be executed";
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

    // Skip very simple functions (single statement)
    if (functionNode.body.statements.length <= 1) {
      return;
    }

    try {
      // Build CFG for this function
      const cfg = this.cfgBuilder.buildCFG(functionNode);
      
      // Analyze for unreachable code
      const analysisResult = this.cfgAnalyzer.analyzeUnreachableCode(cfg);

      // Convert violations to issues
      const issues = this.cfgAnalyzer.convertToIssues([analysisResult], context);
      
      // Add enhanced messages for unreachable code issues
      for (const issue of issues) {
        const enhancedIssue = {
          ...issue,
          message: `${issue.message} Consider removing this code or fixing the logic that prevents it from executing.`
        };
        context.issues.push(enhancedIssue);
      }

      // Add suggestions for common patterns
      this.addUnreachableCodeSuggestions(analysisResult, context, cfg.functionName);

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

    const statements = functionNode.body.statements;
    
    for (let i = 0; i < statements.length - 1; i++) {
      const stmt = statements[i];
      
      // Check for code after return statements
      if (this.isReturnStatement(stmt)) {
        const nextStmt = statements[i + 1];
        if (nextStmt) {
          context.issues.push({
            ruleId: this.id,
            message: "Unreachable code detected after return statement. This code will never execute.",
            severity: this.severity,
            file: context.filePath,
            line: nextStmt.loc?.start.line || 0,
            column: nextStmt.loc?.start.column || 0
          });
        }
      }

      // Check for code after revert/require(false)/assert(false)
      if (this.isAlwaysRevertStatement(stmt)) {
        const nextStmt = statements[i + 1];
        if (nextStmt) {
          context.issues.push({
            ruleId: this.id,
            message: "Unreachable code detected after statement that always reverts. This code will never execute.",
            severity: this.severity,
            file: context.filePath,
            line: nextStmt.loc?.start.line || 0,
            column: nextStmt.loc?.start.column || 0
          });
        }
      }
    }
  }

  /**
   * Add suggestions for fixing unreachable code patterns
   */
  private addUnreachableCodeSuggestions(
    analysisResult: any, 
    context: AnalysisContext,
    functionName: string
  ): void {
    if (analysisResult.violations.length === 0) return;

    const suggestions = this.generateUnreachableCodeSuggestions(analysisResult.violations);
    
    for (const suggestion of suggestions) {
      context.issues.push({
        ruleId: `${this.id}-suggestion`,
        message: suggestion.message,
        severity: "info",
        file: context.filePath,
        line: suggestion.line,
        column: suggestion.column
      });
    }
  }

  /**
   * Generate specific suggestions for fixing unreachable code
   */
  private generateUnreachableCodeSuggestions(violations: any[]): Array<{
    message: string;
    line: number;
    column: number;
  }> {
    const suggestions = [];

    for (const violation of violations) {
      const line = violation.location.start.line;
      const column = violation.location.start.column;

      // Categorize the type of unreachable code and provide specific advice
      if (violation.evidence?.codeSnippet?.includes("return")) {
        suggestions.push({
          message: "SUGGESTION: Remove code after return statement, or move return to the end of the function if the code should execute.",
          line,
          column
        });
      } else if (violation.evidence?.codeSnippet?.includes("revert") || 
                 violation.evidence?.codeSnippet?.includes("require")) {
        suggestions.push({
          message: "SUGGESTION: Remove code after revert/require, or add conditions to make the revert conditional.",
          line,
          column
        });
      } else {
        suggestions.push({
          message: "SUGGESTION: Review the control flow logic. This code may be unreachable due to conditional statements or loops.",
          line,
          column
        });
      }
    }

    return suggestions;
  }

  /**
   * Check if statement is a return statement
   */
  private isReturnStatement(stmt: ASTNode): boolean {
    return stmt.type === "ReturnStatement";
  }

  /**
   * Check if statement always causes a revert
   */
  private isAlwaysRevertStatement(stmt: ASTNode): boolean {
    if (stmt.type === "RevertStatement") {
      return true;
    }

    // Check for require(false) or assert(false)
    if (stmt.type === "ExpressionStatement") {
      const exprStmt = stmt as any;
      if (exprStmt.expression?.type === "FunctionCall") {
        const funcCall = exprStmt.expression;
        if (funcCall.expression?.type === "Identifier") {
          const funcName = funcCall.expression.name;
          if ((funcName === "require" || funcName === "assert") && 
              funcCall.arguments?.[0]?.type === "BooleanLiteral" &&
              funcCall.arguments[0].value === false) {
            return true;
          }
        }
      }
    }

    return false;
  }
}
