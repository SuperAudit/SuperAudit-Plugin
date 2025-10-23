// Define AST node types based on solidity-parser output
// Since @solidity-parser/parser doesn't export TypeScript types, we define our own
export interface Location {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface ASTNode {
  type: string;
  loc?: Location;
  range?: [number, number];
}

export interface SourceUnit extends ASTNode {
  type: "SourceUnit";
  children: ASTNode[];
}

export interface ContractDefinition extends ASTNode {
  type: "ContractDefinition";
  name: string;
  kind?: string; // More flexible - parser returns string, not enum
  body?: ASTNode[];
}

export interface FunctionDefinition extends ASTNode {
  type: "FunctionDefinition";
  name?: string | null; // Parser can return null
  isConstructor?: boolean;
  visibility?: string;
  stateMutability?: string | null; // Parser can return null
  body?: Block | null; // Parser can return null
}

export interface VariableDeclaration extends ASTNode {
  type: "VariableDeclaration";
  name?: string;
  visibility?: string;
  typeName?: ASTNode;
}

export interface MemberAccess extends ASTNode {
  type: "MemberAccess";
  expression: ASTNode;
  memberName: string;
}

export interface Identifier extends ASTNode {
  type: "Identifier";
  name: string;
}

export interface Block extends ASTNode {
  type: "Block";
  statements: ASTNode[];
}

export interface ExpressionStatement extends ASTNode {
  type: "ExpressionStatement";
  expression: ASTNode;
}

export interface BinaryOperation extends ASTNode {
  type: "BinaryOperation";
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface FunctionCall extends ASTNode {
  type: "FunctionCall";
  expression: ASTNode;
  arguments: ASTNode[];
}

export interface IfStatement extends ASTNode {
  type: "IfStatement";
  condition: ASTNode;
  body: ASTNode;
  elseBody?: ASTNode;
}

export interface WhileStatement extends ASTNode {
  type: "WhileStatement";
  condition: ASTNode;
  body: ASTNode;
}

export interface ForStatement extends ASTNode {
  type: "ForStatement";
  init?: ASTNode;
  condition?: ASTNode;
  update?: ASTNode;
  body: ASTNode;
}

export interface Issue {
  ruleId: string;
  message: string;
  severity: "error" | "warning" | "info";
  file: string;
  line: number;
  column: number;
  aiEnhancement?: AIEnhancement;
}

export interface AIEnhancement {
  explanation: string;
  suggestedFix?: string;
  riskScore?: number;
  additionalContext?: string;
  confidence: number;
}

export interface AnalysisContext {
  filePath: string;
  sourceCode: string;
  issues: Issue[];
}

export type Severity = "error" | "warning" | "info";

// Rule interface that all analysis rules must implement
export interface Rule {
  id: string;
  description: string;
  severity: Severity;
  apply(ast: ASTNode, context: AnalysisContext): void;
}