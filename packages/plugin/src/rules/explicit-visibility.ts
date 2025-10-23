import parser from "@solidity-parser/parser";
import type { ASTNode, Rule, AnalysisContext, VariableDeclaration, ContractDefinition } from "../types.js";

/**
 * Rule that checks for explicit visibility modifiers on state variables
 * 
 * Best Practice: State variables should have explicit visibility modifiers
 * (public, private, internal) rather than relying on default visibility.
 * This makes the code more readable and prevents accidental exposure of
 * sensitive data.
 * 
 * Default visibility for state variables is internal, but it's better
 * to be explicit about the intended visibility.
 */
export class ExplicitVisibilityRule implements Rule {
  public readonly id = "explicit-visibility";
  public readonly description = "State variables should have explicit visibility modifiers";
  public readonly severity = "warning" as const;

  apply(ast: ASTNode, context: AnalysisContext): void {
    parser.visit(ast, {
      ContractDefinition: (node: ContractDefinition) => {
        this.checkContractStateVariables(node, context);
      }
    });
  }

  private checkContractStateVariables(contractNode: ContractDefinition, context: AnalysisContext): void {
    // Check all sub-nodes in the contract (the parser uses subNodes, not body)
    const subNodes = (contractNode as any).subNodes;
    if (!subNodes || !Array.isArray(subNodes)) {
      return;
    }

    for (const node of subNodes) {
      if (node.type === "StateVariableDeclaration") {
        // StateVariableDeclaration contains an array of variables
        const stateVarDecl = node as any;
        if (stateVarDecl.variables && Array.isArray(stateVarDecl.variables)) {
          for (const variable of stateVarDecl.variables) {
            this.checkStateVariable(variable as VariableDeclaration, context);
          }
        }
      }
    }
  }

  private checkStateVariable(variableNode: VariableDeclaration, context: AnalysisContext): void {
    // Check if the variable has explicit visibility
    // The parser returns "default" for variables without explicit visibility
    const hasExplicitVisibility = variableNode.visibility && 
      variableNode.visibility !== "default" &&
      ["public", "private", "internal"].includes(variableNode.visibility);

    if (!hasExplicitVisibility) {
      const variableName = variableNode.name || "unnamed variable";
      
      context.issues.push({
        ruleId: this.id,
        message: `State variable '${variableName}' should have explicit visibility (public, private, or internal)`,
        severity: this.severity,
        file: context.filePath,
        line: variableNode.loc?.start.line || 0,
        column: variableNode.loc?.start.column || 0
      });
    }
  }
}
