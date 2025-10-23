import type { ASTNode, FunctionDefinition, Location } from "../types.js";

/**
 * Represents a basic block in the control flow graph
 * A basic block is a sequence of statements with no branches except at the end
 */
export interface CFGNode {
  id: string;
  type: CFGNodeType;
  statements: ASTNode[];
  location?: Location;
  metadata?: CFGNodeMetadata;
}

export type CFGNodeType = 
  | "entry"           // Function entry point
  | "exit"            // Function exit point  
  | "basic"           // Regular basic block
  | "condition"       // Conditional branch (if/while condition)
  | "loop-header"     // Loop header/condition
  | "loop-body"       // Loop body
  | "external-call"   // Contains external contract calls
  | "state-update"    // Contains state variable updates
  | "revert"          // Revert/require/assert statement
  | "return"          // Return statement

export interface CFGNodeMetadata {
  // State variables read in this block
  stateReads: string[];
  // State variables written in this block  
  stateWrites: string[];
  // External calls made in this block
  externalCalls: ExternalCallInfo[];
  // Whether this block can revert
  canRevert: boolean;
  // Whether this block modifies critical state
  isCriticalStateUpdate: boolean;
}

export interface ExternalCallInfo {
  target: string;          // Call target (contract/address)
  method: string;          // Method being called
  location: Location;      // Location in source code
  isLowLevel: boolean;     // true for .call(), .delegatecall(), etc.
  returnValueChecked: boolean; // Whether return value is checked
}

/**
 * Represents an edge between CFG nodes
 */
export interface CFGEdge {
  from: string;            // Source node ID
  to: string;              // Target node ID
  type: CFGEdgeType;
  condition?: string;      // Condition for conditional edges
}

export type CFGEdgeType =
  | "sequential"     // Normal sequential flow
  | "conditional"    // Conditional branch (true/false)
  | "loop-back"      // Back edge in loop
  | "loop-exit"      // Exit from loop
  | "exception"      // Exception/revert flow
  | "return"         // Function return

/**
 * Control Flow Graph for a single function
 */
export interface ControlFlowGraph {
  functionName: string;
  nodes: Map<string, CFGNode>;
  edges: CFGEdge[];
  entryNode: string;
  exitNodes: string[];  // Can have multiple exit points
  metadata: CFGMetadata;
}

export interface CFGMetadata {
  hasExternalCalls: boolean;
  hasStateUpdates: boolean;
  hasReentrancyRisk: boolean;
  cyclomaticComplexity: number;
  potentialVulnerabilities: string[];
}

/**
 * Analysis results from CFG-based rules
 */
export interface CFGAnalysisResult {
  ruleId: string;
  violations: CFGViolation[];
  confidence: "high" | "medium" | "low";
  exploitPath?: CFGPath;
}

export interface CFGViolation {
  nodeId: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  location: Location;
  evidence: CFGEvidence;
}

export interface CFGEvidence {
  externalCallNode?: string;
  stateUpdateNode?: string;
  pathToViolation: string[];
  codeSnippet?: string;
}

export interface CFGPath {
  nodes: string[];
  description: string;
  isExploitable: boolean;
}
