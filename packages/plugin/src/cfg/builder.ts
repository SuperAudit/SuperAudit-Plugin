import type { 
  ASTNode, 
  FunctionDefinition, 
  Block, 
  IfStatement,
  WhileStatement,
  ForStatement,
  ExpressionStatement,
  VariableDeclaration,
  MemberAccess,
  FunctionCall,
  Identifier
} from "../types.js";
import type {
  ControlFlowGraph,
  CFGNode,
  CFGEdge,
  CFGNodeType,
  CFGNodeMetadata,
  ExternalCallInfo,
  CFGMetadata
} from "./types.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Builds Control Flow Graphs from function ASTs
 */
export class CFGBuilder {
  private nodeCounter = 0;
  private currentCFG: ControlFlowGraph | null = null;

  /**
   * Build a complete CFG for a function
   */
  buildCFG(functionNode: FunctionDefinition): ControlFlowGraph {
    const functionName = functionNode.name || "constructor";
    
    this.currentCFG = {
      functionName,
      nodes: new Map(),
      edges: [],
      entryNode: "",
      exitNodes: [],
      metadata: this.initializeMetadata()
    };

    // Create entry node
    const entryNode = this.createNode("entry", [], functionNode.loc);
    this.currentCFG.entryNode = entryNode.id;

    // Process function body
    let currentNodeId = entryNode.id;
    if (functionNode.body && functionNode.body.statements) {
      currentNodeId = this.processStatements(functionNode.body.statements, currentNodeId);
    }

    // Create exit node if needed
    if (this.currentCFG.exitNodes.length === 0) {
      const exitNode = this.createNode("exit", [], functionNode.loc);
      this.addEdge(currentNodeId, exitNode.id, "sequential");
      this.currentCFG.exitNodes.push(exitNode.id);
    }

    // Calculate metadata
    this.calculateCFGMetadata();

    return this.currentCFG;
  }

  /**
   * Process a sequence of statements and return the last node ID
   */
  private processStatements(statements: ASTNode[], fromNodeId: string): string {
    let currentNodeId = fromNodeId;
    let currentStatements: ASTNode[] = [];

    for (const statement of statements) {
      if (this.isControlFlowStatement(statement)) {
        // Process accumulated basic block statements
        if (currentStatements.length > 0) {
          const basicBlock = this.createBasicBlock(currentStatements);
          this.addEdge(currentNodeId, basicBlock.id, "sequential");
          currentNodeId = basicBlock.id;
          currentStatements = [];
        }

        // Process control flow statement
        currentNodeId = this.processControlFlowStatement(statement, currentNodeId);
      } else {
        // Accumulate statement for basic block
        currentStatements.push(statement);
      }
    }

    // Process remaining statements
    if (currentStatements.length > 0) {
      const basicBlock = this.createBasicBlock(currentStatements);
      this.addEdge(currentNodeId, basicBlock.id, "sequential");
      currentNodeId = basicBlock.id;
    }

    return currentNodeId;
  }

  /**
   * Check if a statement affects control flow
   */
  private isControlFlowStatement(statement: ASTNode): boolean {
    return [
      "IfStatement",
      "WhileStatement", 
      "ForStatement",
      "ReturnStatement",
      "BreakStatement",
      "ContinueStatement",
      "RevertStatement",
      "RequireStatement",
      "AssertStatement"
    ].includes(statement.type);
  }

  /**
   * Process control flow statements (if, while, for, etc.)
   */
  private processControlFlowStatement(statement: ASTNode, fromNodeId: string): string {
    switch (statement.type) {
      case "IfStatement":
        return this.processIfStatement(statement as IfStatement, fromNodeId);
      
      case "WhileStatement":
        return this.processWhileStatement(statement as WhileStatement, fromNodeId);
      
      case "ForStatement":
        return this.processForStatement(statement as ForStatement, fromNodeId);
      
      case "ReturnStatement":
        return this.processReturnStatement(statement, fromNodeId);
      
      default:
        // For now, treat other control statements as basic blocks
        const node = this.createBasicBlock([statement]);
        this.addEdge(fromNodeId, node.id, "sequential");
        return node.id;
    }
  }

  /**
   * Process if-else statement
   */
  private processIfStatement(ifStmt: IfStatement, fromNodeId: string): string {
    // Create condition node
    const conditionNode = this.createNode("condition", [ifStmt.condition], ifStmt.loc);
    this.addEdge(fromNodeId, conditionNode.id, "sequential");

    // Process true branch
    let trueBranchEndId = conditionNode.id;
    if (ifStmt.body) {
      trueBranchEndId = this.processStatements([ifStmt.body], conditionNode.id);
      this.addEdge(conditionNode.id, trueBranchEndId, "conditional", "true");
    }

    // Process false branch (else)
    let falseBranchEndId = conditionNode.id;
    if (ifStmt.elseBody) {
      falseBranchEndId = this.processStatements([ifStmt.elseBody], conditionNode.id);
      this.addEdge(conditionNode.id, falseBranchEndId, "conditional", "false");
    } else {
      // No else branch - condition can flow directly to merge point
      falseBranchEndId = conditionNode.id;
    }

    // Create merge node where both branches reconvene
    const mergeNode = this.createNode("basic", [], ifStmt.loc);
    
    if (trueBranchEndId !== conditionNode.id) {
      this.addEdge(trueBranchEndId, mergeNode.id, "sequential");
    }
    if (falseBranchEndId !== conditionNode.id) {
      this.addEdge(falseBranchEndId, mergeNode.id, "sequential");
    }
    if (falseBranchEndId === conditionNode.id) {
      // Direct path from condition to merge (no else branch)
      this.addEdge(conditionNode.id, mergeNode.id, "conditional", "false");
    }

    return mergeNode.id;
  }

  /**
   * Process while loop
   */
  private processWhileStatement(whileStmt: WhileStatement, fromNodeId: string): string {
    // Create loop header with condition
    const headerNode = this.createNode("loop-header", [whileStmt.condition], whileStmt.loc);
    this.addEdge(fromNodeId, headerNode.id, "sequential");

    // Process loop body
    let bodyEndId = headerNode.id;
    if (whileStmt.body) {
      bodyEndId = this.processStatements([whileStmt.body], headerNode.id);
      this.addEdge(headerNode.id, bodyEndId, "conditional", "true");
      
      // Back edge from body to header
      this.addEdge(bodyEndId, headerNode.id, "loop-back");
    }

    // Create exit node for loop
    const exitNode = this.createNode("basic", [], whileStmt.loc);
    this.addEdge(headerNode.id, exitNode.id, "loop-exit", "false");

    return exitNode.id;
  }

  /**
   * Process for loop
   */
  private processForStatement(forStmt: ForStatement, fromNodeId: string): string {
    let currentNodeId = fromNodeId;

    // Process initialization
    if (forStmt.init) {
      const initNode = this.createBasicBlock([forStmt.init]);
      this.addEdge(currentNodeId, initNode.id, "sequential");
      currentNodeId = initNode.id;
    }

    // Create loop header with condition
    const headerStatements = forStmt.condition ? [forStmt.condition] : [];
    const headerNode = this.createNode("loop-header", headerStatements, forStmt.loc);
    this.addEdge(currentNodeId, headerNode.id, "sequential");

    // Process loop body
    let bodyEndId = headerNode.id;
    if (forStmt.body) {
      bodyEndId = this.processStatements([forStmt.body], headerNode.id);
      this.addEdge(headerNode.id, bodyEndId, "conditional", "true");
    }

    // Process update statement
    if (forStmt.update) {
      const updateNode = this.createBasicBlock([forStmt.update]);
      this.addEdge(bodyEndId, updateNode.id, "sequential");
      bodyEndId = updateNode.id;
    }

    // Back edge to header
    this.addEdge(bodyEndId, headerNode.id, "loop-back");

    // Exit node
    const exitNode = this.createNode("basic", [], forStmt.loc);
    this.addEdge(headerNode.id, exitNode.id, "loop-exit", "false");

    return exitNode.id;
  }

  /**
   * Process return statement
   */
  private processReturnStatement(returnStmt: ASTNode, fromNodeId: string): string {
    const returnNode = this.createNode("return", [returnStmt], returnStmt.loc);
    this.addEdge(fromNodeId, returnNode.id, "sequential");
    
    if (!this.currentCFG) throw new Error("No current CFG");
    this.currentCFG.exitNodes.push(returnNode.id);
    
    return returnNode.id;
  }

  /**
   * Create a basic block from statements
   */
  private createBasicBlock(statements: ASTNode[]): CFGNode {
    // Analyze statements to determine node type and metadata
    const metadata = this.analyzeStatements(statements);
    
    let nodeType: CFGNodeType = "basic";
    if (metadata.externalCalls.length > 0) {
      nodeType = "external-call";
    } else if (metadata.stateWrites.length > 0) {
      nodeType = "state-update";
    }

    return this.createNode(nodeType, statements, statements[0]?.loc, metadata);
  }

  /**
   * Create a CFG node
   */
  private createNode(
    type: CFGNodeType, 
    statements: ASTNode[], 
    location?: any,
    metadata?: CFGNodeMetadata
  ): CFGNode {
    const node: CFGNode = {
      id: `node_${this.nodeCounter++}`,
      type,
      statements,
      location,
      metadata: metadata || this.analyzeStatements(statements)
    };

    if (!this.currentCFG) throw new Error("No current CFG");
    this.currentCFG.nodes.set(node.id, node);
    
    return node;
  }

  /**
   * Add an edge between nodes
   */
  private addEdge(
    from: string, 
    to: string, 
    type: "sequential" | "conditional" | "loop-back" | "loop-exit" | "exception" | "return",
    condition?: string
  ): void {
    if (!this.currentCFG) throw new Error("No current CFG");
    
    this.currentCFG.edges.push({
      from,
      to,
      type,
      condition
    });
  }

  /**
   * Analyze statements to extract metadata
   */
  private analyzeStatements(statements: ASTNode[]): CFGNodeMetadata {
    const metadata: CFGNodeMetadata = {
      stateReads: [],
      stateWrites: [],
      externalCalls: [],
      canRevert: false,
      isCriticalStateUpdate: false
    };

    for (const stmt of statements) {
      this.analyzeStatementRecursively(stmt, metadata);
    }

    // Remove duplicates
    metadata.stateReads = [...new Set(metadata.stateReads)];
    metadata.stateWrites = [...new Set(metadata.stateWrites)];
    
    // Determine if this is a critical state update
    metadata.isCriticalStateUpdate = metadata.stateWrites.some(varName => 
      this.isCriticalStateVariable(varName)
    );

    return metadata;
  }

  /**
   * Recursively analyze a statement for metadata
   */
  private analyzeStatementRecursively(node: ASTNode, metadata: CFGNodeMetadata): void {
    switch (node.type) {
      case "ExpressionStatement":
        const exprStmt = node as ExpressionStatement;
        if (exprStmt.expression) {
          this.analyzeStatementRecursively(exprStmt.expression, metadata);
        }
        break;

      case "AssignmentOperator":
        // State variable assignment
        const assignment = node as any;
        if (assignment.left && this.isStateVariableAccess(assignment.left)) {
          metadata.stateWrites.push(this.getVariableName(assignment.left));
        }
        if (assignment.right) {
          this.analyzeStatementRecursively(assignment.right, metadata);
        }
        break;

      case "FunctionCall":
        const funcCall = node as FunctionCall;
        const callInfo = this.analyzeFunctionCall(funcCall);
        if (callInfo) {
          metadata.externalCalls.push(callInfo);
        }
        
        // Check if this is a revert/require/assert
        if (this.isRevertFunction(funcCall)) {
          metadata.canRevert = true;
        }
        break;

      case "MemberAccess":
        const memberAccess = node as MemberAccess;
        if (this.isStateVariableAccess(memberAccess)) {
          metadata.stateReads.push(this.getVariableName(memberAccess));
        }
        break;

      case "Identifier":
        const identifier = node as Identifier;
        if (this.isStateVariable(identifier.name)) {
          metadata.stateReads.push(identifier.name);
        }
        break;

      default:
        // Recursively check child nodes
        this.visitChildNodes(node, (child) => {
          this.analyzeStatementRecursively(child, metadata);
        });
        break;
    }
  }

  /**
   * Analyze a function call to determine if it's external
   */
  private analyzeFunctionCall(funcCall: FunctionCall): ExternalCallInfo | null {
    // This is a simplified implementation
    // In practice, we'd need more sophisticated analysis to determine if a call is external
    
    if (funcCall.expression.type === "MemberAccess") {
      const memberAccess = funcCall.expression as MemberAccess;
      
      // Check for low-level calls
      const isLowLevel = ["call", "delegatecall", "staticcall", "send", "transfer"]
        .includes(memberAccess.memberName);
      
      if (isLowLevel || this.isExternalContract(memberAccess.expression)) {
        return {
          target: this.getCallTarget(memberAccess),
          method: memberAccess.memberName,
          location: funcCall.loc || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
          isLowLevel,
          returnValueChecked: false // TODO: Analyze if return value is checked
        };
      }
    }

    return null;
  }

  /**
   * Helper methods for analysis
   */
  private isStateVariableAccess(node: ASTNode): boolean {
    // Simplified - in practice would need contract context
    return node.type === "Identifier" && this.isStateVariable((node as Identifier).name);
  }

  private isStateVariable(name: string): boolean {
    // Simplified - would need to track state variables from contract analysis
    return name !== "msg" && name !== "block" && name !== "tx" && 
           !this.isLocalVariable(name);
  }

  private isLocalVariable(name: string): boolean {
    // Simplified - would track local variables in scope
    return false;
  }

  private isCriticalStateVariable(name: string): boolean {
    // Variables that are commonly critical in DeFi contracts
    const criticalNames = [
      "balance", "balances", "totalSupply", "reserves", 
      "shares", "totalShares", "deposits", "withdrawals",
      "price", "oracle", "owner", "paused"
    ];
    
    return criticalNames.some(critical => 
      name.toLowerCase().includes(critical.toLowerCase())
    );
  }

  private getVariableName(node: ASTNode): string {
    if (node.type === "Identifier") {
      return (node as Identifier).name;
    } else if (node.type === "MemberAccess") {
      return (node as MemberAccess).memberName;
    }
    return "unknown";
  }

  private isExternalContract(node: ASTNode): boolean {
    // Simplified - would need contract context to determine external contracts
    return node.type === "Identifier" && 
           !["this", "msg", "block", "tx"].includes((node as Identifier).name);
  }

  private getCallTarget(memberAccess: MemberAccess): string {
    if (memberAccess.expression.type === "Identifier") {
      return (memberAccess.expression as Identifier).name;
    }
    return "unknown";
  }

  private isRevertFunction(funcCall: FunctionCall): boolean {
    if (funcCall.expression.type === "Identifier") {
      const name = (funcCall.expression as Identifier).name;
      return ["revert", "require", "assert"].includes(name);
    }
    return false;
  }

  private visitChildNodes(node: ASTNode, visitor: (child: ASTNode) => void): void {
    // Simplified visitor - would need to handle all AST node types properly
    const nodeAny = node as any;
    
    for (const key in nodeAny) {
      const value = nodeAny[key];
      if (value && typeof value === "object") {
        if (Array.isArray(value)) {
          value.forEach(item => {
            if (item && item.type) {
              visitor(item);
            }
          });
        } else if (value.type) {
          visitor(value);
        }
      }
    }
  }

  /**
   * Calculate CFG metadata after construction
   */
  private calculateCFGMetadata(): void {
    if (!this.currentCFG) return;

    let hasExternalCalls = false;
    let hasStateUpdates = false;
    let hasReentrancyRisk = false;

    for (const [_, node] of this.currentCFG.nodes) {
      if (node.metadata?.externalCalls.length) {
        hasExternalCalls = true;
      }
      if (node.metadata?.stateWrites.length) {
        hasStateUpdates = true;
      }
    }

    // Simple reentrancy risk detection
    hasReentrancyRisk = hasExternalCalls && hasStateUpdates;

    this.currentCFG.metadata = {
      hasExternalCalls,
      hasStateUpdates, 
      hasReentrancyRisk,
      cyclomaticComplexity: this.calculateCyclomaticComplexity(),
      potentialVulnerabilities: []
    };
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateCyclomaticComplexity(): number {
    if (!this.currentCFG) return 1;
    
    // McCabe complexity = E - N + 2P
    // E = edges, N = nodes, P = connected components (1 for single function)
    const edges = this.currentCFG.edges.length;
    const nodes = this.currentCFG.nodes.size;
    
    return edges - nodes + 2;
  }

  private initializeMetadata(): CFGMetadata {
    return {
      hasExternalCalls: false,
      hasStateUpdates: false,
      hasReentrancyRisk: false,
      cyclomaticComplexity: 1,
      potentialVulnerabilities: []
    };
  }
}
