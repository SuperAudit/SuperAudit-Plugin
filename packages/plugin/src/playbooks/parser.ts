import * as yaml from "yaml";
import { readFileSync, existsSync } from "fs";
import type {
  Playbook,
  ParsedPlaybook,
  ParsedStaticRule,
  ParsedDynamicScenario,
  ParsedRule,
  ParsedScenarioStep,
  ParsedAction,
  RuleType,
  RuleCategory
} from "./types.js";

/**
 * Parses YAML audit playbooks and converts them to executable format
 */
export class PlaybookParser {
  
  /**
   * Parse a playbook from file path
   */
  static parseFromFile(filePath: string): ParsedPlaybook {
    if (!existsSync(filePath)) {
      throw new Error(`Playbook file not found: ${filePath}`);
    }

    try {
      const yamlContent = readFileSync(filePath, "utf8");
      return this.parseFromString(yamlContent);
    } catch (error) {
      throw new Error(`Failed to read playbook file ${filePath}: ${error}`);
    }
  }

  /**
   * Parse a playbook from YAML string
   */
  static parseFromString(yamlContent: string): ParsedPlaybook {
    try {
      const rawPlaybook = yaml.parse(yamlContent) as Playbook;
      return this.validateAndParse(rawPlaybook);
    } catch (error) {
      throw new Error(`Failed to parse YAML playbook: ${error}`);
    }
  }

  /**
   * Validate and parse raw playbook into executable format
   */
  private static validateAndParse(rawPlaybook: Playbook): ParsedPlaybook {
    // Validate required fields
    this.validatePlaybook(rawPlaybook);

    return {
      meta: rawPlaybook.meta,
      targets: rawPlaybook.targets || { contracts: ["*"] },
      staticRules: this.parseStaticRules(rawPlaybook.checks),
      dynamicScenarios: this.parseDynamicScenarios(rawPlaybook.dynamic?.scenarios || []),
      invariants: rawPlaybook.dynamic?.invariants || [],
      fuzzingConfig: rawPlaybook.dynamic?.fuzzing
    };
  }

  /**
   * Validate playbook structure and required fields
   */
  private static validatePlaybook(playbook: Playbook): void {
    if (!playbook.version) {
      throw new Error("Playbook must specify a version");
    }

    if (!playbook.meta) {
      throw new Error("Playbook must have meta information");
    }

    if (!playbook.meta.name) {
      throw new Error("Playbook meta must include a name");
    }

    if (!playbook.meta.author) {
      throw new Error("Playbook meta must include an author");
    }

    if (!playbook.checks || !Array.isArray(playbook.checks)) {
      throw new Error("Playbook must include an array of checks");
    }

    // Validate individual checks
    for (const check of playbook.checks) {
      this.validateCheck(check);
    }

    // Validate dynamic scenarios if present
    if (playbook.dynamic?.scenarios) {
      for (const scenario of playbook.dynamic.scenarios) {
        this.validateScenario(scenario);
      }
    }
  }

  /**
   * Validate individual check configuration
   */
  private static validateCheck(check: any): void {
    if (!check.id) {
      throw new Error("Each check must have an id");
    }

    if (!check.rule) {
      throw new Error(`Check ${check.id} must have a rule`);
    }

    if (!check.severity) {
      throw new Error(`Check ${check.id} must have a severity`);
    }

    const validSeverities = ["critical", "high", "medium", "low", "info"];
    if (!validSeverities.includes(check.severity)) {
      throw new Error(`Check ${check.id} has invalid severity: ${check.severity}`);
    }
  }

  /**
   * Validate dynamic scenario configuration
   */
  private static validateScenario(scenario: any): void {
    if (!scenario.name) {
      throw new Error("Each scenario must have a name");
    }

    if (!scenario.steps || !Array.isArray(scenario.steps)) {
      throw new Error(`Scenario ${scenario.name} must have an array of steps`);
    }

    if (!scenario.assert || !Array.isArray(scenario.assert)) {
      throw new Error(`Scenario ${scenario.name} must have assertions`);
    }
  }

  /**
   * Parse static rules from checks
   */
  private static parseStaticRules(checks: any[]): ParsedStaticRule[] {
    return checks.map(check => ({
      id: check.id,
      rule: this.parseRuleDSL(check.rule),
      severity: check.severity,
      description: check.description,
      enabled: check.enabled !== false // Default to true
    }));
  }

  /**
   * Parse rule DSL expressions into structured format
   */
  private static parseRuleDSL(ruleExpression: string): ParsedRule {
    try {
      // Parse different rule patterns
      
      // Order rules: order.externalBefore(state=['shares','totalShares'])
      if (ruleExpression.startsWith("order.")) {
        return this.parseOrderRule(ruleExpression);
      }

      // Pattern rules: pattern.transferFrom(!checkedReturn)
      if (ruleExpression.startsWith("pattern.")) {
        return this.parsePatternRule(ruleExpression);
      }

      // Access control rules: access.missingOwnable(functions=['withdraw'])
      if (ruleExpression.startsWith("access.")) {
        return this.parseAccessRule(ruleExpression);
      }

      // Value rules: value.range(variable='amount', min=0, max=1000000)
      if (ruleExpression.startsWith("value.")) {
        return this.parseValueRule(ruleExpression);
      }

      // Custom rules: custom.myRule(param1='value1')
      if (ruleExpression.startsWith("custom.")) {
        return this.parseCustomRule(ruleExpression);
      }

      // Default: treat as pattern rule
      return {
        type: "pattern",
        category: "security",
        params: { expression: ruleExpression }
      };

    } catch (error) {
      throw new Error(`Failed to parse rule DSL: ${ruleExpression}. Error: ${error}`);
    }
  }

  /**
   * Parse order-based rules (execution order, CEI pattern, etc.)
   */
  private static parseOrderRule(expression: string): ParsedRule {
    // Examples:
    // order.externalBefore(state=['shares','totalShares'])
    // order.stateAfter(calls=['transfer'])

    const match = expression.match(/order\.(\w+)\((.+)\)/);
    if (!match) {
      throw new Error(`Invalid order rule syntax: ${expression}`);
    }

    const [, method, paramsStr] = match;
    const params = this.parseParameterList(paramsStr);

    return {
      type: "order",
      category: "security",
      params: {
        method,
        ...params
      }
    };
  }

  /**
   * Parse pattern-matching rules
   */
  private static parsePatternRule(expression: string): ParsedRule {
    // Examples:
    // pattern.transferFrom(!checkedReturn)
    // pattern.delegatecall(target=untrusted)

    const match = expression.match(/pattern\.(\w+)\((.+)\)/);
    if (!match) {
      throw new Error(`Invalid pattern rule syntax: ${expression}`);
    }

    const [, method, paramsStr] = match;
    const params = this.parseParameterList(paramsStr);

    return {
      type: "pattern", 
      category: "security",
      params: {
        method,
        ...params
      }
    };
  }

  /**
   * Parse access control rules
   */
  private static parseAccessRule(expression: string): ParsedRule {
    // Examples:
    // access.missingOwnable(functions=['withdraw'])
    // access.publicFunction(critical=true)

    const match = expression.match(/access\.(\w+)\((.+)\)/);
    if (!match) {
      throw new Error(`Invalid access rule syntax: ${expression}`);
    }

    const [, method, paramsStr] = match;
    const params = this.parseParameterList(paramsStr);

    return {
      type: "access",
      category: "security", 
      params: {
        method,
        ...params
      }
    };
  }

  /**
   * Parse value/range rules
   */
  private static parseValueRule(expression: string): ParsedRule {
    const match = expression.match(/value\.(\w+)\((.+)\)/);
    if (!match) {
      throw new Error(`Invalid value rule syntax: ${expression}`);
    }

    const [, method, paramsStr] = match;
    const params = this.parseParameterList(paramsStr);

    return {
      type: "value",
      category: "compliance",
      params: {
        method,
        ...params
      }
    };
  }

  /**
   * Parse custom rules
   */
  private static parseCustomRule(expression: string): ParsedRule {
    const match = expression.match(/custom\.(\w+)\((.+)\)/);
    if (!match) {
      throw new Error(`Invalid custom rule syntax: ${expression}`);
    }

    const [, method, paramsStr] = match;
    const params = this.parseParameterList(paramsStr);

    return {
      type: "custom",
      category: "security", // Default category
      params: {
        method,
        ...params
      }
    };
  }

  /**
   * Parse parameter list from DSL expression
   */
  private static parseParameterList(paramStr: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // Handle array parameters: state=['shares','totalShares']
    const arrayMatches = paramStr.match(/(\w+)=\[([^\]]+)\]/g);
    if (arrayMatches) {
      for (const match of arrayMatches) {
        const [, key, values] = match.match(/(\w+)=\[([^\]]+)\]/) || [];
        if (key && values) {
          params[key] = values.split(',').map(v => v.trim().replace(/['"]/g, ''));
        }
      }
    }

    // Handle string parameters: target='untrusted'
    const stringMatches = paramStr.match(/(\w+)=['"]([^'"]+)['"]/g);
    if (stringMatches) {
      for (const match of stringMatches) {
        const [, key, value] = match.match(/(\w+)=['"]([^'"]+)['"]/) || [];
        if (key && value !== undefined) {
          params[key] = value;
        }
      }
    }

    // Handle boolean/numeric parameters: critical=true, max=1000
    const simpleMatches = paramStr.match(/(\w+)=([^,\[\]'"]+)/g);
    if (simpleMatches) {
      for (const match of simpleMatches) {
        const [, key, value] = match.match(/(\w+)=([^,\[\]'"]+)/) || [];
        if (key && value !== undefined) {
          const trimmedValue = value.trim();
          if (trimmedValue === 'true') {
            params[key] = true;
          } else if (trimmedValue === 'false') {
            params[key] = false;
          } else if (/^\d+$/.test(trimmedValue)) {
            params[key] = parseInt(trimmedValue);
          } else if (/^\d+\.\d+$/.test(trimmedValue)) {
            params[key] = parseFloat(trimmedValue);
          } else {
            params[key] = trimmedValue;
          }
        }
      }
    }

    return params;
  }

  /**
   * Parse dynamic scenarios
   */
  private static parseDynamicScenarios(scenarios: any[]): ParsedDynamicScenario[] {
    return scenarios.map(scenario => ({
      name: scenario.name,
      description: scenario.description,
      steps: this.parseScenarioSteps(scenario.steps),
      assertions: scenario.assert || [],
      setup: scenario.setup
    }));
  }

  /**
   * Parse scenario steps
   */
  private static parseScenarioSteps(steps: any[]): ParsedScenarioStep[] {
    return steps.map(step => ({
      action: this.parseAction(step.action),
      value: step.value,
      params: step.params,
      expect: step.expect || "any"
    }));
  }

  /**
   * Parse action string into structured format
   */
  private static parseAction(actionStr: string): ParsedAction {
    // Examples:
    // "attacker.depositETH" -> { target: "attacker", method: "depositETH", type: "call" }  
    // "vault.transfer" -> { target: "vault", method: "transfer", type: "call" }
    // "deploy.AttackerContract" -> { target: "AttackerContract", method: "", type: "deploy" }

    if (actionStr.startsWith("deploy.")) {
      const contractName = actionStr.substring(7);
      return {
        target: contractName,
        method: "",
        type: "deploy"
      };
    }

    const [target, method] = actionStr.split(".");
    if (!target || !method) {
      throw new Error(`Invalid action format: ${actionStr}. Expected format: 'target.method'`);
    }

    return {
      target,
      method,
      type: "call"
    };
  }
}
