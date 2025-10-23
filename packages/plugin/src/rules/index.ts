// Import all rule implementations
import { NoTxOriginRule } from "./no-tx-origin.js";
import { ExplicitVisibilityRule } from "./explicit-visibility.js";
import { ContractNamingRule } from "./contract-naming.js";
import { FunctionNamingRule } from "./function-naming.js";

// Import advanced CFG-based rules
import { ADVANCED_RULES } from "./advanced/index.js";

// Export individual rules
export { NoTxOriginRule } from "./no-tx-origin.js";
export { ExplicitVisibilityRule } from "./explicit-visibility.js";
export { ContractNamingRule } from "./contract-naming.js";
export { FunctionNamingRule } from "./function-naming.js";
export { RuleEngine } from "./engine.js";

// Export advanced rules
export * from "./advanced/index.js";

// Basic AST-based rules (fast, always enabled)
export const BASIC_RULES = [
  new NoTxOriginRule(),
  new ExplicitVisibilityRule(),
  new ContractNamingRule(),
  new FunctionNamingRule(),
];

// Export the default rule set (basic + advanced)
export const DEFAULT_RULES = [
  ...BASIC_RULES,
  ...ADVANCED_RULES
];

/**
 * Get all available rules
 */
export function getAllRules() {
  return [...DEFAULT_RULES];
}

/**
 * Get rules filtered by severity
 */
export function getRulesBySeverity(severity: "error" | "warning" | "info") {
  return DEFAULT_RULES.filter(rule => rule.severity === severity);
}

/**
 * Get rules filtered by category (based on rule ID patterns)
 */
export function getRulesByCategory(category: "security" | "style" | "performance" | "all" = "all") {
  if (category === "all") {
    return [...DEFAULT_RULES];
  }

  const securityRuleIds = ["no-tx-origin", "explicit-visibility"];
  const styleRuleIds = ["contract-naming", "function-naming"];
  const performanceRuleIds: string[] = []; // None yet

  let targetRuleIds: string[];
  switch (category) {
    case "security":
      targetRuleIds = securityRuleIds;
      break;
    case "style":
      targetRuleIds = styleRuleIds;
      break;
    case "performance":
      targetRuleIds = performanceRuleIds;
      break;
    default:
      targetRuleIds = [];
  }

  return DEFAULT_RULES.filter(rule => targetRuleIds.includes(rule.id));
}

/**
 * Create a rule engine with the default rule set
 */
export async function createDefaultRuleEngine() {
  const { RuleEngine } = await import("./engine.js");
  return new RuleEngine(DEFAULT_RULES);
}
