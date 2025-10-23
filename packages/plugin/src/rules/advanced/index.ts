// Advanced CFG-based rules for sophisticated vulnerability detection
export { ExternalBeforeStateRule } from "./external-before-state.js";
export { UnreachableCodeRule } from "./unreachable-code.js";  
export { ReentrancyPathsRule } from "./reentrancy-paths.js";

import { ExternalBeforeStateRule } from "./external-before-state.js";
import { UnreachableCodeRule } from "./unreachable-code.js";
import { ReentrancyPathsRule } from "./reentrancy-paths.js";

/**
 * Advanced rules that require CFG analysis
 * These rules provide deeper security analysis but have higher computational cost
 */
export const ADVANCED_RULES = [
  new ExternalBeforeStateRule(),
  new UnreachableCodeRule(), 
  new ReentrancyPathsRule(),
];

/**
 * Get advanced rules by category
 */
export function getAdvancedRulesByCategory(category: "security" | "optimization" | "all" = "all") {
  switch (category) {
    case "security":
      return [
        new ExternalBeforeStateRule(),
        new ReentrancyPathsRule()
      ];
    case "optimization": 
      return [
        new UnreachableCodeRule()
      ];
    case "all":
    default:
      return [...ADVANCED_RULES];
  }
}

/**
 * Check if a rule requires CFG analysis
 */
export function requiresCFG(ruleId: string): boolean {
  const cfgRuleIds = ["external-before-state", "unreachable-code", "reentrancy-paths"];
  return cfgRuleIds.includes(ruleId);
}
