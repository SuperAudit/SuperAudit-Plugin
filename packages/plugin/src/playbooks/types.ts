/**
 * Type definitions for YAML audit playbooks
 */

export interface Playbook {
  version: string;
  meta: PlaybookMeta;
  targets?: PlaybookTargets;
  checks: PlaybookCheck[];
  dynamic?: DynamicAnalysis;
}

export interface PlaybookMeta {
  name: string;
  author: string;
  description?: string;
  price?: string;
  lighthouseResource?: string; // IPFS hash for encrypted playbook
  tags?: string[];
  version?: string;
  created?: string;
  updated?: string;
  ai?: PlaybookAIConfig;
}

export interface PlaybookAIConfig {
  enabled: boolean;
  provider?: "openai" | "anthropic" | "local";
  model?: string;
  enhance_findings?: boolean;
  generate_fixes?: boolean;
  custom_prompts?: Record<string, string>;
}

export interface PlaybookTargets {
  contracts?: string[]; // Contract name patterns to analyze
  functions?: string[]; // Function name patterns to analyze
  exclude?: string[]; // Patterns to exclude from analysis
}

export interface PlaybookCheck {
  id: string;
  rule: string; // DSL rule expression
  severity: "critical" | "high" | "medium" | "low" | "info";
  description?: string;
  enabled?: boolean;
  params?: Record<string, any>; // Rule-specific parameters
  ai_prompt?: string; // Custom AI prompt for this check
}

export interface DynamicAnalysis {
  scenarios: DynamicScenario[];
  invariants?: InvariantCheck[];
  fuzzing?: FuzzingConfig;
}

export interface DynamicScenario {
  name: string;
  description?: string;
  type: "script" | "fuzzing" | "invariant";
  steps: ScenarioStep[];
  assert: AssertionCheck[];
  setup?: ScenarioSetup;
}

export interface ScenarioStep {
  action: string; // e.g., "attacker.depositETH", "vault.withdraw"
  value?: string; // e.g., "5 ether", "1000"
  params?: Record<string, any>;
  expect?: "success" | "revert" | "any";
}

export interface AssertionCheck {
  expr: string; // e.g., "profit(attacker) > 0"
  severity: "critical" | "high" | "medium" | "low";
  description?: string;
}

export interface ScenarioSetup {
  contracts?: ContractDeployment[];
  accounts?: AccountSetup[];
  blockchain?: BlockchainSetup;
}

export interface ContractDeployment {
  name: string;
  contract: string; // Contract name to deploy
  params?: any[]; // Constructor parameters
  role?: string; // e.g., "attacker", "victim", "oracle"
}

export interface AccountSetup {
  name: string;
  role: string; // e.g., "owner", "user", "attacker"
  balance?: string; // e.g., "100 ether"
}

export interface BlockchainSetup {
  fork?: string; // Network to fork (mainnet, goerli, etc.)
  blockNumber?: number;
  timestamp?: number;
}

export interface InvariantCheck {
  id: string;
  expression: string; // e.g., "sum(balances) == totalSupply"
  description?: string;
  severity: "critical" | "high" | "medium" | "low";
}

export interface FuzzingConfig {
  runs?: number; // Number of fuzzing runs
  depth?: number; // Max call sequence depth
  strategy?: "random" | "coverage" | "mutation";
  timeout?: number; // Timeout in seconds
}

/**
 * Rule DSL types for parsing rule expressions
 */
export interface ParsedRule {
  type: RuleType;
  category: RuleCategory;
  params: RuleParams;
}

export type RuleType =
  | "order" // Execution order rules
  | "pattern" // Pattern matching rules
  | "access" // Access control rules
  | "value" // Value/range rules
  | "custom"; // Custom rule logic

export type RuleCategory = "security" | "style" | "optimization" | "compliance";

export interface RuleParams {
  [key: string]: any;
}

/**
 * Parsed playbook with resolved rules and scenarios
 */
export interface ParsedPlaybook {
  meta: PlaybookMeta;
  targets: PlaybookTargets;
  staticRules: ParsedStaticRule[];
  dynamicScenarios: ParsedDynamicScenario[];
  invariants: InvariantCheck[];
  fuzzingConfig?: FuzzingConfig;
}

export interface ParsedStaticRule {
  id: string;
  rule: ParsedRule;
  severity: "critical" | "high" | "medium" | "low" | "info";
  description?: string;
  enabled: boolean;
}

export interface ParsedDynamicScenario {
  name: string;
  description?: string;
  steps: ParsedScenarioStep[];
  assertions: AssertionCheck[];
  setup?: ScenarioSetup;
}

export interface ParsedScenarioStep {
  action: ParsedAction;
  value?: any;
  params?: Record<string, any>;
  expect?: "success" | "revert" | "any";
}

export interface ParsedAction {
  target: string; // Contract or actor name
  method: string; // Method to call
  type: "call" | "send" | "deploy" | "set";
}

/**
 * Execution results from playbook scenarios
 */
export interface PlaybookExecutionResult {
  playbook: string; // Playbook name
  staticResults: StaticRuleResult[];
  dynamicResults: DynamicScenarioResult[];
  summary: ExecutionSummary;
}

export interface StaticRuleResult {
  ruleId: string;
  violations: number;
  issues: any[]; // Actual issue objects
  executionTime: number;
}

export interface DynamicScenarioResult {
  scenarioName: string;
  success: boolean;
  assertions: AssertionResult[];
  executionTrace?: ExecutionStep[];
  error?: string;
}

export interface AssertionResult {
  expression: string;
  passed: boolean;
  actualValue?: any;
  expectedValue?: any;
  severity: string;
}

export interface ExecutionStep {
  step: number;
  action: string;
  result: any;
  gasUsed?: number;
  events?: any[];
}

export interface ExecutionSummary {
  totalRules: number;
  passedRules: number;
  failedRules: number;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  executionTime: number;
}
