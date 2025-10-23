import parser from "@solidity-parser/parser";
import type { ASTNode, Rule, AnalysisContext, MemberAccess, Identifier } from "../types.js";

/**
 * Rule that detects usage of tx.origin for authentication
 * 
 * Security Issue: tx.origin should not be used for authorization because it represents
 * the original external account that started the transaction chain, not the immediate
 * caller. This makes contracts vulnerable to phishing attacks where a malicious
 * contract can trick users into calling it, which then calls the target contract
 * with the user's tx.origin.
 * 
 * Recommendation: Use msg.sender instead of tx.origin for authorization checks.
 */
export class NoTxOriginRule implements Rule {
  public readonly id = "no-tx-origin";
  public readonly description = "Avoid using tx.origin for authorization (use msg.sender instead)";
  public readonly severity = "warning" as const;

  apply(ast: ASTNode, context: AnalysisContext): void {
    parser.visit(ast, {
      MemberAccess: (node: MemberAccess) => {
        this.checkMemberAccess(node, context);
      }
    });
  }

  private checkMemberAccess(node: MemberAccess, context: AnalysisContext): void {
    // Check if this is tx.origin access
    if (
      node.expression.type === "Identifier" &&
      (node.expression as Identifier).name === "tx" &&
      node.memberName === "origin"
    ) {
      context.issues.push({
        ruleId: this.id,
        message: "Avoid using tx.origin for authorization. Use msg.sender instead to prevent phishing attacks.",
        severity: this.severity,
        file: context.filePath,
        line: node.loc?.start.line || 0,
        column: node.loc?.start.column || 0
      });
    }
  }
}
