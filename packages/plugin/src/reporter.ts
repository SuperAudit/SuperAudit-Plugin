import chalk from "chalk";
import type { Issue, Severity } from "./types.js";

export interface ReportSummary {
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

/**
 * Format and display analysis results to the console
 */
export class Reporter {
  private issues: Issue[] = [];

  /**
   * Add an issue to the report
   */
  addIssue(issue: Issue): void {
    this.issues.push(issue);
  }

  /**
   * Add multiple issues to the report
   */
  addIssues(issues: Issue[]): void {
    this.issues.push(...issues);
  }

  /**
   * Get all collected issues
   */
  getIssues(): Issue[] {
    return [...this.issues];
  }

  /**
   * Clear all issues
   */
  clear(): void {
    this.issues = [];
  }

  /**
   * Generate a summary of the issues
   */
  getSummary(): ReportSummary {
    const summary = {
      totalIssues: this.issues.length,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0
    };

    for (const issue of this.issues) {
      switch (issue.severity) {
        case "error":
          summary.errorCount++;
          break;
        case "warning":
          summary.warningCount++;
          break;
        case "info":
          summary.infoCount++;
          break;
      }
    }

    return summary;
  }

  /**
   * Format a severity level with color
   */
  private formatSeverity(severity: Severity): string {
    switch (severity) {
      case "error":
        return chalk.red("[Error]");
      case "warning":
        return chalk.yellow("[Warning]");
      case "info":
        return chalk.blue("[Info]");
    }
  }

  /**
   * Format a single issue for display
   */
  private formatIssue(issue: Issue): string {
    const location = `${issue.file}:${issue.line}:${issue.column}`;
    const severity = this.formatSeverity(issue.severity);
    const ruleId = chalk.dim(issue.ruleId);
    
    let output = `${location} ${severity} ${ruleId}: ${issue.message}`;
    
    // Add AI enhancement if present
    if ((issue as any).aiEnhancement) {
      const ai = (issue as any).aiEnhancement;
      
      output += chalk.cyan("\n\n  🤖 AI ANALYSIS:");
      output += `\n  ${ai.explanation.split('\n').join('\n  ')}`;
      
      if (ai.suggestedFix) {
        output += chalk.green("\n\n  🔧 SUGGESTED FIX:");
        output += `\n  ${ai.suggestedFix.split('\n').join('\n  ')}`;
      }
      
      if (ai.additionalContext) {
        output += chalk.blue("\n\n  📚 ADDITIONAL CONTEXT:");
        output += `\n  ${ai.additionalContext.split('\n').join('\n  ')}`;
      }
      
      if (ai.riskScore) {
        const riskColor = ai.riskScore >= 8 ? chalk.red : ai.riskScore >= 5 ? chalk.yellow : chalk.green;
        output += riskColor(`\n\n  ⚠️  RISK SCORE: ${ai.riskScore}/10`);
      }
      
      if (ai.confidence) {
        output += chalk.dim(`  •  CONFIDENCE: ${Math.round(ai.confidence * 100)}%`);
      }
    }
    
    return output;
  }

  /**
   * Print all issues to the console
   */
  printReport(): void {
    if (this.issues.length === 0) {
      console.log(chalk.green("✅ No issues found!"));
      return;
    }

    // Sort issues by file, then by line number
    const sortedIssues = this.issues.sort((a, b) => {
      if (a.file !== b.file) {
        return a.file.localeCompare(b.file);
      }
      if (a.line !== b.line) {
        return a.line - b.line;
      }
      return a.column - b.column;
    });

    console.log(chalk.bold("\n📋 Static Analysis Report\n"));

    // Group issues by file for better readability
    let currentFile = "";
    for (const issue of sortedIssues) {
      if (issue.file !== currentFile) {
        if (currentFile !== "") {
          console.log(); // Add spacing between files
        }
        console.log(chalk.bold.underline(issue.file));
        currentFile = issue.file;
      }
      
      console.log(`  ${this.formatIssue(issue)}`);
    }

    // Print summary
    const summary = this.getSummary();
    console.log(chalk.bold("\n📊 Summary:"));
    
    if (summary.errorCount > 0) {
      console.log(`  ${chalk.red("Errors")}: ${summary.errorCount}`);
    }
    if (summary.warningCount > 0) {
      console.log(`  ${chalk.yellow("Warnings")}: ${summary.warningCount}`);
    }
    if (summary.infoCount > 0) {
      console.log(`  ${chalk.blue("Info")}: ${summary.infoCount}`);
    }
    
    console.log(`  ${chalk.bold("Total issues")}: ${summary.totalIssues}`);
  }

  /**
   * Determine if the analysis should be considered as failing
   * (i.e., should exit with non-zero code)
   */
  hasErrors(): boolean {
    return this.issues.some(issue => issue.severity === "error");
  }
}
