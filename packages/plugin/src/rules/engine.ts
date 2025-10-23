import parser from "@solidity-parser/parser";
import type { ASTNode, Rule, AnalysisContext, Issue } from "../types.js";
import { Reporter } from "../reporter.js";

/**
 * Rule engine that orchestrates the execution of analysis rules
 */
export class RuleEngine {
  private rules: Rule[];
  private reporter: Reporter;

  constructor(rules: Rule[], reporter?: Reporter) {
    this.rules = rules;
    this.reporter = reporter || new Reporter();
  }

  /**
   * Add a rule to the engine
   */
  addRule(rule: Rule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a rule from the engine
   */
  removeRule(ruleId: string): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter(rule => rule.id !== ruleId);
    return this.rules.length < initialLength;
  }

  /**
   * Get all rules in the engine
   */
  getRules(): Rule[] {
    return [...this.rules];
  }

  /**
   * Get the reporter instance
   */
  getReporter(): Reporter {
    return this.reporter;
  }

  /**
   * Analyze a single AST with all configured rules
   */
  analyze(ast: ASTNode, filePath: string, sourceCode: string): Issue[] {
    const context: AnalysisContext = {
      filePath,
      sourceCode,
      issues: []
    };

    // Apply each rule to the AST
    for (const rule of this.rules) {
      try {
        rule.apply(ast, context);
      } catch (error) {
        // If a rule fails, we should report it but not crash the entire analysis
        console.warn(
          `Warning: Rule ${rule.id} failed on ${filePath}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    // Add issues to the reporter
    this.reporter.addIssues(context.issues);

    return context.issues;
  }

  /**
   * Analyze multiple files
   */
  analyzeMultiple(
    parseResults: Array<{ ast: ASTNode; filePath: string; sourceCode: string }>
  ): Issue[] {
    const allIssues: Issue[] = [];

    for (const result of parseResults) {
      const issues = this.analyze(result.ast, result.filePath, result.sourceCode);
      allIssues.push(...issues);
    }

    return allIssues;
  }

  /**
   * Helper method to create a visitor that applies rules based on node types
   * This is a more advanced approach that allows for optimized traversal
   */
  private createOptimizedVisitor(context: AnalysisContext): any {
    // Group rules by the node types they're interested in
    const rulesByNodeType: Record<string, Rule[]> = {};

    // For now, we'll use a simple approach where all rules are called for all nodes
    // In the future, rules could specify which node types they care about
    return {
      _node: (node: ASTNode) => {
        for (const rule of this.rules) {
          try {
            rule.apply(node, context);
          } catch (error) {
            console.warn(`Rule ${rule.id} failed on node type ${node.type}: ${error}`);
          }
        }
      }
    };
  }

  /**
   * Alternative analysis method using visitor pattern for potentially better performance
   */
  analyzeWithVisitor(ast: ASTNode, filePath: string, sourceCode: string): Issue[] {
    const context: AnalysisContext = {
      filePath,
      sourceCode,
      issues: []
    };

    const visitor = this.createOptimizedVisitor(context);

    try {
      parser.visit(ast, visitor);
    } catch (error) {
      console.warn(
        `Warning: Visitor-based analysis failed on ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      // Fall back to direct rule application
      return this.analyze(ast, filePath, sourceCode);
    }

    // Add issues to the reporter
    this.reporter.addIssues(context.issues);

    return context.issues;
  }

  /**
   * Clear all collected issues from the reporter
   */
  clearResults(): void {
    this.reporter.clear();
  }

  /**
   * Print the analysis report
   */
  printReport(): void {
    this.reporter.printReport();
  }

  /**
   * Check if there are any errors that should fail the build
   */
  hasErrors(): boolean {
    return this.reporter.hasErrors();
  }
}
