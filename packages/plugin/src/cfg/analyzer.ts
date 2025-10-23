import type { ControlFlowGraph, CFGAnalysisResult, CFGViolation, CFGPath, CFGEvidence } from "./types.js";
import type { Issue, AnalysisContext } from "../types.js";

/**
 * Analyzes CFGs to detect security vulnerabilities and patterns
 */
export class CFGAnalyzer {
  
  /**
   * Analyze a CFG for external calls before state updates (CEI pattern violation)
   */
  analyzeExternalBeforeState(cfg: ControlFlowGraph, criticalStateVars: string[] = []): CFGAnalysisResult {
    const violations: CFGViolation[] = [];
    
    // Find all paths from entry to exit
    const paths = this.findAllPaths(cfg, cfg.entryNode, cfg.exitNodes);
    
    for (const path of paths) {
      const violation = this.checkCEIViolationOnPath(cfg, path, criticalStateVars);
      if (violation) {
        violations.push(violation);
      }
    }

    return {
      ruleId: "external-before-state",
      violations,
      confidence: violations.length > 0 ? "high" : "low",
      exploitPath: violations.length > 0 ? this.buildExploitPath(cfg, violations[0]) : undefined
    };
  }

  /**
   * Check for Check-Effects-Interactions pattern violation on a specific path
   */
  private checkCEIViolationOnPath(
    cfg: ControlFlowGraph, 
    path: string[], 
    criticalStateVars: string[]
  ): CFGViolation | null {
    let lastExternalCallNode: string | null = null;
    let lastExternalCallIndex = -1;

    // Walk through the path looking for external calls followed by state updates
    for (let i = 0; i < path.length; i++) {
      const nodeId = path[i];
      const node = cfg.nodes.get(nodeId);
      if (!node) continue;

      // Check if this node has external calls
      if (node.metadata?.externalCalls.length) {
        lastExternalCallNode = nodeId;
        lastExternalCallIndex = i;
        continue;
      }

      // Check if this node updates critical state after external call
      if (lastExternalCallNode && node.metadata?.stateWrites.length) {
        const criticalWrites = node.metadata.stateWrites.filter(varName =>
          criticalStateVars.length === 0 || criticalStateVars.includes(varName) ||
          node.metadata?.isCriticalStateUpdate
        );

        if (criticalWrites.length > 0) {
          // Found violation: external call before state update
          return {
            nodeId: lastExternalCallNode,
            description: `External call in function ${cfg.functionName} occurs before updating critical state variables: ${criticalWrites.join(", ")}. This violates the Check-Effects-Interactions pattern and may allow reentrancy attacks.`,
            severity: "critical",
            location: node.location || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
            evidence: {
              externalCallNode: lastExternalCallNode,
              stateUpdateNode: nodeId,
              pathToViolation: path.slice(0, i + 1),
              codeSnippet: this.extractCodeSnippet(node)
            }
          };
        }
      }
    }

    return null;
  }

  /**
   * Analyze CFG for unreachable code
   */
  analyzeUnreachableCode(cfg: ControlFlowGraph): CFGAnalysisResult {
    const reachableNodes = new Set<string>();
    const violations: CFGViolation[] = [];

    // DFS from entry node to find all reachable nodes
    this.dfsReachable(cfg, cfg.entryNode, reachableNodes);

    // Find unreachable nodes
    for (const [nodeId, node] of cfg.nodes) {
      if (!reachableNodes.has(nodeId) && node.type !== "exit") {
        violations.push({
          nodeId,
          description: `Unreachable code detected in function ${cfg.functionName}. This code will never execute and may indicate a logic error.`,
          severity: "medium",
          location: node.location || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
          evidence: {
            pathToViolation: [],
            codeSnippet: this.extractCodeSnippet(node)
          }
        });
      }
    }

    return {
      ruleId: "unreachable-code",
      violations,
      confidence: "high"
    };
  }

  /**
   * Analyze CFG for potential reentrancy paths
   */
  analyzeReentrancyPaths(cfg: ControlFlowGraph): CFGAnalysisResult {
    const violations: CFGViolation[] = [];

    // Find nodes with external calls that could allow reentrancy
    for (const [nodeId, node] of cfg.nodes) {
      if (node.metadata?.externalCalls.length) {
        // Check if there are state reads/writes after this external call
        const vulnerablePaths = this.findPathsWithStateAccessAfterCall(cfg, nodeId);
        
        for (const path of vulnerablePaths) {
          violations.push({
            nodeId,
            description: `Potential reentrancy vulnerability in function ${cfg.functionName}. External call allows contract to reenter and access/modify state.`,
            severity: "high",
            location: node.location || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
            evidence: {
              externalCallNode: nodeId,
              pathToViolation: path,
              codeSnippet: this.extractCodeSnippet(node)
            }
          });
        }
      }
    }

    return {
      ruleId: "reentrancy-paths",
      violations,
      confidence: violations.length > 0 ? "medium" : "low"
    };
  }

  /**
   * Analyze CFG for state consistency issues
   */
  analyzeStateConsistency(cfg: ControlFlowGraph): CFGAnalysisResult {
    const violations: CFGViolation[] = [];

    // Check for paths where state variables are read but never updated
    const stateVarUsage = this.analyzeStateVariableUsage(cfg);
    
    for (const [varName, usage] of stateVarUsage) {
      if (usage.reads > 0 && usage.writes === 0 && usage.isImportantForConsistency) {
        // Find a node that reads this variable
        const readingNode = this.findNodeReadingVariable(cfg, varName);
        if (readingNode) {
          violations.push({
            nodeId: readingNode.id,
            description: `State variable '${varName}' is read but never updated in function ${cfg.functionName}. This might indicate missing state synchronization.`,
            severity: "low", 
            location: readingNode.location || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
            evidence: {
              pathToViolation: [readingNode.id],
              codeSnippet: this.extractCodeSnippet(readingNode)
            }
          });
        }
      }
    }

    return {
      ruleId: "state-consistency",
      violations,
      confidence: "low"
    };
  }

  /**
   * Find all paths from start to any of the end nodes
   */
  private findAllPaths(cfg: ControlFlowGraph, start: string, ends: string[]): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (current: string, path: string[]): void => {
      if (visited.has(current)) return; // Avoid infinite loops
      
      const newPath = [...path, current];
      
      if (ends.includes(current)) {
        paths.push(newPath);
        return;
      }

      visited.add(current);
      
      // Follow outgoing edges
      const outgoingEdges = cfg.edges.filter(edge => edge.from === current);
      for (const edge of outgoingEdges) {
        dfs(edge.to, newPath);
      }
      
      visited.delete(current);
    };

    dfs(start, []);
    return paths;
  }

  /**
   * DFS to find reachable nodes
   */
  private dfsReachable(cfg: ControlFlowGraph, nodeId: string, reachable: Set<string>): void {
    if (reachable.has(nodeId)) return;
    
    reachable.add(nodeId);
    
    const outgoingEdges = cfg.edges.filter(edge => edge.from === nodeId);
    for (const edge of outgoingEdges) {
      this.dfsReachable(cfg, edge.to, reachable);
    }
  }

  /**
   * Find paths with state access after external call
   */
  private findPathsWithStateAccessAfterCall(cfg: ControlFlowGraph, callNodeId: string): string[][] {
    const paths: string[][] = [];
    
    // Find paths from the external call node that access state
    const traverse = (current: string, path: string[], visited: Set<string>): void => {
      if (visited.has(current)) return;
      
      const node = cfg.nodes.get(current);
      if (!node) return;
      
      const newPath = [...path, current];
      
      // If this node (after the call) accesses state, we found a potential issue
      if (current !== callNodeId && 
          (node.metadata?.stateReads.length || node.metadata?.stateWrites.length)) {
        paths.push(newPath);
      }
      
      visited.add(current);
      
      const outgoingEdges = cfg.edges.filter(edge => edge.from === current);
      for (const edge of outgoingEdges) {
        traverse(edge.to, newPath, new Set(visited));
      }
    };

    traverse(callNodeId, [], new Set());
    return paths;
  }

  /**
   * Analyze state variable usage patterns
   */
  private analyzeStateVariableUsage(cfg: ControlFlowGraph): Map<string, {
    reads: number;
    writes: number;
    isImportantForConsistency: boolean;
  }> {
    const usage = new Map();

    for (const [_, node] of cfg.nodes) {
      if (node.metadata) {
        // Count reads
        for (const varName of node.metadata.stateReads) {
          if (!usage.has(varName)) {
            usage.set(varName, { 
              reads: 0, 
              writes: 0, 
              isImportantForConsistency: this.isImportantForConsistency(varName)
            });
          }
          usage.get(varName).reads++;
        }

        // Count writes
        for (const varName of node.metadata.stateWrites) {
          if (!usage.has(varName)) {
            usage.set(varName, { 
              reads: 0, 
              writes: 0, 
              isImportantForConsistency: this.isImportantForConsistency(varName)
            });
          }
          usage.get(varName).writes++;
        }
      }
    }

    return usage;
  }

  /**
   * Check if variable is important for state consistency
   */
  private isImportantForConsistency(varName: string): boolean {
    const importantPatterns = [
      "balance", "total", "supply", "count", "amount", "value", "sum"
    ];
    
    return importantPatterns.some(pattern => 
      varName.toLowerCase().includes(pattern)
    );
  }

  /**
   * Find node that reads a specific variable
   */
  private findNodeReadingVariable(cfg: ControlFlowGraph, varName: string) {
    for (const [_, node] of cfg.nodes) {
      if (node.metadata?.stateReads.includes(varName)) {
        return node;
      }
    }
    return null;
  }

  /**
   * Build exploit path from violation
   */
  private buildExploitPath(cfg: ControlFlowGraph, violation: CFGViolation): CFGPath {
    return {
      nodes: violation.evidence.pathToViolation,
      description: `Reentrancy exploit path: ${violation.evidence.pathToViolation.join(" → ")}`,
      isExploitable: true
    };
  }

  /**
   * Extract code snippet from node
   */
  private extractCodeSnippet(node: any): string {
    // Simplified - would extract actual source code
    return node.statements?.length ? 
      `${node.statements.length} statement(s) at line ${node.location?.start?.line || "unknown"}` :
      "No statements";
  }

  /**
   * Convert CFG analysis results to standard Issue format
   */
  convertToIssues(results: CFGAnalysisResult[], context: AnalysisContext): Issue[] {
    const issues: Issue[] = [];

    for (const result of results) {
      for (const violation of result.violations) {
        issues.push({
          ruleId: result.ruleId,
          message: violation.description,
          severity: violation.severity === "critical" ? "error" : 
                   violation.severity === "high" ? "warning" : "info",
          file: context.filePath,
          line: violation.location.start.line,
          column: violation.location.start.column
        });
      }
    }

    return issues;
  }
}
