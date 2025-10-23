import parser from "@solidity-parser/parser";
import type { ASTNode, Rule, AnalysisContext, ContractDefinition } from "../types.js";

/**
 * Rule that enforces PascalCase naming convention for contracts
 * 
 * Style Guide: Contract names should follow PascalCase convention
 * (also known as CapitalCase or UpperCamelCase) where each word
 * starts with a capital letter and there are no underscores or spaces.
 * 
 * Examples:
 * - Good: MyContract, TokenManager, ERC20Token
 * - Bad: myContract, token_manager, erc20_token
 */
export class ContractNamingRule implements Rule {
  public readonly id = "contract-naming";
  public readonly description = "Contract names should follow PascalCase convention";
  public readonly severity = "warning" as const;

  // Regex pattern for PascalCase: starts with uppercase, followed by letters/numbers
  private readonly pascalCaseRegex = /^[A-Z][a-zA-Z0-9]*$/;

  apply(ast: ASTNode, context: AnalysisContext): void {
    parser.visit(ast, {
      ContractDefinition: (node: ContractDefinition) => {
        this.checkContractName(node, context);
      }
    });
  }

  private checkContractName(contractNode: ContractDefinition, context: AnalysisContext): void {
    const contractName = contractNode.name;
    
    if (!contractName) {
      return; // Skip contracts without names (shouldn't happen in valid Solidity)
    }

    if (!this.pascalCaseRegex.test(contractName)) {
      const suggestion = this.suggestPascalCase(contractName);
      
      context.issues.push({
        ruleId: this.id,
        message: `Contract name '${contractName}' should follow PascalCase convention${suggestion ? `. Consider: '${suggestion}'` : ''}`,
        severity: this.severity,
        file: context.filePath,
        line: contractNode.loc?.start.line || 0,
        column: contractNode.loc?.start.column || 0
      });
    }
  }

  /**
   * Suggest a PascalCase version of the given name
   */
  private suggestPascalCase(name: string): string | null {
    // Handle common patterns
    if (name.includes('_')) {
      // Convert snake_case to PascalCase
      return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
    } else if (name.charAt(0) === name.charAt(0).toLowerCase()) {
      // Just capitalize the first letter if it's camelCase
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    
    return null;
  }
}
