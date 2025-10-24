// Export all playbook-related functionality
export * from "./types.js";
export { PlaybookParser } from "./parser.js";
export { DSLInterpreter } from "./dsl/interpreter.js";
export * from "./registry.js";
export * from "./registry-utils.js";
export * from "./lighthouse-storage.js";

// Convenience functions for working with playbooks
import { PlaybookParser } from "./parser.js";
import { DSLInterpreter } from "./dsl/interpreter.js";
import type { ParsedPlaybook } from "./types.js";
import type { Rule } from "../types.js";

/**
 * Load and create executable rules from a playbook file
 */
export async function loadPlaybookRules(playbookPath: string): Promise<Rule[]> {
  const parsedPlaybook = PlaybookParser.parseFromFile(playbookPath);
  const interpreter = new DSLInterpreter();
  return interpreter.createRulesFromDSL(parsedPlaybook.staticRules);
}

/**
 * Create rules from YAML string
 */
export function createRulesFromYAML(yamlContent: string): Rule[] {
  const parsedPlaybook = PlaybookParser.parseFromString(yamlContent);
  const interpreter = new DSLInterpreter();
  return interpreter.createRulesFromDSL(parsedPlaybook.staticRules);
}

/**
 * Validate a playbook without executing it
 */
export function validatePlaybook(yamlContent: string): { valid: boolean; errors: string[] } {
  try {
    PlaybookParser.parseFromString(yamlContent);
    return { valid: true, errors: [] };
  } catch (error) {
    return { 
      valid: false, 
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

/**
 * Get sample playbook templates
 */
export function getSamplePlaybooks(): Record<string, string> {
  return {
    "defi-vault-security": getDeFiVaultSecurityPlaybook(),
    "erc20-security": getERC20SecurityPlaybook(),
    "access-control": getAccessControlPlaybook()
  };
}

/**
 * Sample DeFi Vault Security playbook
 */
function getDeFiVaultSecurityPlaybook(): string {
  return `
version: "1.0"
meta:
  name: "DeFi Vault Security"
  author: "SuperAudit Team"
  description: "Comprehensive security analysis for DeFi vault contracts"
  tags: ["defi", "vault", "reentrancy", "access-control"]
  version: "1.0.0"

targets:
  contracts: ["Vault*", "Strategy*", "*Vault", "*Strategy"]
  exclude: ["Test*", "*Test"]

checks:
  # Critical reentrancy protection
  - id: "vault-external-before-state"
    rule: "order.externalBefore(state=['shares','totalShares','balance','totalAssets'])"
    severity: "critical"
    description: "External calls must not occur before updating critical vault state"
    
  # ERC20 transfer safety
  - id: "unchecked-transfers"
    rule: "pattern.transferFrom(!checkedReturn)"
    severity: "high"
    description: "transferFrom calls must check return value"
    
  - id: "unchecked-transfer"
    rule: "pattern.transfer(!checkedReturn)"  
    severity: "high"
    description: "transfer calls must check return value"
    
  # Access control for critical functions
  - id: "missing-access-control"
    rule: "access.missingOwnable(functions=['withdraw','deposit','emergencyWithdraw','setStrategy'])"
    severity: "high"
    description: "Critical vault functions must have access control"
    
  # Low-level call safety
  - id: "dangerous-delegatecall"
    rule: "pattern.delegatecall(target=untrusted)"
    severity: "critical"
    description: "delegatecall to untrusted contracts is dangerous"
    
  # Value validation
  - id: "deposit-amount-validation"
    rule: "value.range(variable='amount', min=1, max=1000000000000000000000000)"
    severity: "medium"
    description: "Deposit amounts should be validated"

dynamic:
  scenarios:
    # Classic reentrancy attack scenario
    - name: "vault-reentrancy-attack"
      description: "Test if vault is vulnerable to reentrancy during withdrawal"
      type: "script"
      steps:
        - action: "attacker.deposit"
          value: "10 ether"
          expect: "success"
        - action: "attacker.withdraw"
          value: "5 ether"
          expect: "success"
        - action: "attacker.triggerReentrancy"
          expect: "revert"
      assert:
        - expr: "profit(attacker) <= 0"
          severity: "critical"
          description: "Attacker should not profit from reentrancy"
        - expr: "vaultBalance >= userDeposits"
          severity: "critical"
          description: "Vault should maintain sufficient balance"
          
    # Price oracle manipulation test  
    - name: "oracle-manipulation"
      description: "Test vault behavior during price oracle manipulation"
      type: "script"
      steps:
        - action: "user.deposit"
          value: "100 ether"
          expect: "success"
        - action: "oracle.setPrice"
          value: "0"
          expect: "success"
        - action: "user.withdraw"
          expect: "revert"
      assert:
        - expr: "vault.totalAssets() > 0"
          severity: "high"
          description: "Vault should not allow zero-price exploitation"

  invariants:
    - id: "vault-balance-consistency"
      expression: "vault.balance >= sum(userShares * sharePrice)"
      description: "Vault balance should always cover user shares"
      severity: "critical"
      
    - id: "share-conservation"
      expression: "totalShares == sum(userShares)"
      description: "Total shares should equal sum of all user shares"
      severity: "critical"

  fuzzing:
    runs: 1000
    depth: 5
    strategy: "coverage"
    timeout: 300
`.trim();
}

/**
 * Sample ERC20 Security playbook  
 */
function getERC20SecurityPlaybook(): string {
  return `
version: "1.0"
meta:
  name: "ERC20 Security"
  author: "SuperAudit Team"
  description: "Security analysis for ERC20 token contracts"
  tags: ["erc20", "token", "transfers"]

targets:
  contracts: ["*Token", "ERC20*"]

checks:
  - id: "transfer-return-value"
    rule: "pattern.transfer(!checkedReturn)"
    severity: "medium"
    description: "ERC20 transfer calls should check return values"
    
  - id: "approve-race-condition"
    rule: "pattern.approve(raceCondition=true)"
    severity: "medium" 
    description: "Approve function should prevent race conditions"
    
  - id: "mint-access-control"
    rule: "access.missingOwnable(functions=['mint'])"
    severity: "high"
    description: "Mint function must have proper access control"
`.trim();
}

/**
 * Sample Access Control playbook
 */
function getAccessControlPlaybook(): string {
  return `
version: "1.0"
meta:
  name: "Access Control Security"
  author: "SuperAudit Team" 
  description: "Access control and privilege management analysis"
  tags: ["access-control", "admin", "ownership"]

targets:
  contracts: ["*"]

checks:
  - id: "public-admin-functions"
    rule: "access.publicFunction(critical=true)"
    severity: "high"
    description: "Critical public functions need security review"
    
  - id: "missing-two-step-ownership"
    rule: "pattern.transferOwnership(!twoStep)"
    severity: "medium"
    description: "Ownership transfers should use two-step process"
    
  - id: "dangerous-selfdestruct"
    rule: "pattern.selfdestruct()"
    severity: "high"
    description: "selfdestruct usage should be carefully reviewed"
`.trim();
}
