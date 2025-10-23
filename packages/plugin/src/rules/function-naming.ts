import parser from "@solidity-parser/parser";
import type { ASTNode, Rule, AnalysisContext, FunctionDefinition } from "../types.js";

/**
 * Rule that enforces camelCase naming convention for functions
 * 
 * Style Guide: Function names should follow camelCase convention
 * where the first word is lowercase and subsequent words start
 * with uppercase letters, with no underscores or spaces.
 * 
 * Examples:
 * - Good: transfer, balanceOf, transferFrom, increaseAllowance
 * - Bad: Transfer, balance_of, transfer_from, increase_allowance
 * 
 * Exceptions:
 * - Constructor functions (no name)
 * - Fallback and receive functions
 */
export class FunctionNamingRule implements Rule {
  public readonly id = "function-naming";
  public readonly description = "Function names should follow camelCase convention";
  public readonly severity = "warning" as const;

  // Regex pattern for camelCase: starts with lowercase, followed by letters/numbers
  private readonly camelCaseRegex = /^[a-z][a-zA-Z0-9]*$/;

  // Special function names that should be ignored
  private readonly specialFunctions = new Set([
    "constructor", 
    "fallback", 
    "receive"
  ]);

  apply(ast: ASTNode, context: AnalysisContext): void {
    parser.visit(ast, {
      FunctionDefinition: (node: FunctionDefinition) => {
        this.checkFunctionName(node, context);
      }
    });
  }

  private checkFunctionName(functionNode: FunctionDefinition, context: AnalysisContext): void {
    const functionName = functionNode.name;
    
    // Skip functions without names (constructors) or special functions
    // Handle both undefined and null cases
    if (!functionName || functionName === null || this.specialFunctions.has(functionName)) {
      return;
    }

    // Skip if it's a constructor (isConstructor field)
    if (functionNode.isConstructor) {
      return;
    }

    if (!this.camelCaseRegex.test(functionName)) {
      const suggestion = this.suggestCamelCase(functionName);
      
      context.issues.push({
        ruleId: this.id,
        message: `Function name '${functionName}' should follow camelCase convention${suggestion ? `. Consider: '${suggestion}'` : ''}`,
        severity: this.severity,
        file: context.filePath,
        line: functionNode.loc?.start.line || 0,
        column: functionNode.loc?.start.column || 0
      });
    }
  }

  /**
   * Suggest a camelCase version of the given name
   */
  private suggestCamelCase(name: string): string | null {
    // Handle common patterns
    if (name.includes('_')) {
      // Convert snake_case to camelCase
      const parts = name.split('_');
      return parts[0].toLowerCase() + 
        parts.slice(1)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join('');
    } else if (name.charAt(0) === name.charAt(0).toUpperCase()) {
      // Convert PascalCase to camelCase
      return name.charAt(0).toLowerCase() + name.slice(1);
    }
    
    return null;
  }
}
