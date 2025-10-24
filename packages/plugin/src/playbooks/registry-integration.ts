/**
 * Example integration of Playbook Registry with SuperAudit Task
 * 
 * This file demonstrates how to integrate the playbook registry
 * into the main analyze task for enhanced playbook management.
 */

import { existsSync } from "fs";
import { basename, extname } from "path";
import {
  getPlaybookRegistry,
  initializeRegistry,
  initializeLighthouseFromEnv,
  isLighthouseInitialized,
  loadRulesFromRegistry,
  loadRulesFromMultiplePlaybooks,
  getRecommendedPlaybooks,
  formatPlaybookList,
  formatRegistryStats,
  getSamplePlaybooks,
} from "./index.js";
import type { Rule } from "../types.js";

/**
 * Initialize the registry with builtin playbooks and Lighthouse
 */
export async function initializePlaybookRegistry(): Promise<void> {
  console.log("🔧 Initializing Playbook Registry...");
  
  // Initialize Lighthouse from environment if available
  const lighthouse = initializeLighthouseFromEnv();
  if (lighthouse) {
    console.log("✅ Lighthouse storage initialized");
  }
  
  // Get builtin sample playbooks
  const builtins = getSamplePlaybooks();
  
  // Initialize registry
  await initializeRegistry(builtins);
  
  const registry = getPlaybookRegistry();
  console.log(`✅ Loaded ${registry.getAll().length} builtin playbooks`);
  
  // Sync from Lighthouse if available
  if (isLighthouseInitialized()) {
    try {
      await registry.syncFromLighthouse();
    } catch (error) {
      console.warn("⚠️  Failed to sync from Lighthouse:", error);
    }
  }
}

/**
 * Enhanced version of determineAnalysisRules that uses the registry
 */
export async function determineAnalysisRulesWithRegistry(
  args: any,
  basicRules: Rule[],
  advancedRules: Rule[]
): Promise<{ rules: Rule[]; analysisMode: string }> {
  const registry = getPlaybookRegistry();

  // Handle --list-playbooks flag
  if (args.listPlaybooks) {
    const allPlaybooks = registry.getAll();
    console.log(formatPlaybookList(allPlaybooks));
    process.exit(0);
  }

  // Handle --registry-stats flag
  if (args.registryStats) {
    const stats = registry.getStats();
    console.log(formatRegistryStats(stats));
    process.exit(0);
  }

  // Handle --search-playbooks flag
  if (args.searchPlaybooks) {
    const tags = args.searchPlaybooks.split(",").map((t: string) => t.trim());
    const results = registry.search({ tags });
    console.log(formatPlaybookList(results));
    process.exit(0);
  }

  // Handle --register-playbook flag
  if (args.registerPlaybook) {
    if (!existsSync(args.registerPlaybook)) {
      throw new Error(`Playbook file not found: ${args.registerPlaybook}`);
    }
    const registered = await registry.registerFromFile(args.registerPlaybook);
    console.log(`✅ Registered playbook: ${registered.id}`);
    console.log(`   Name: ${registered.meta.name}`);
    console.log(`   Author: ${registered.meta.author}`);
    process.exit(0);
  }

  // Handle --upload-playbook flag (upload to Lighthouse)
  if (args.uploadPlaybook) {
    if (!isLighthouseInitialized()) {
      throw new Error(
        "Lighthouse not initialized. Set LIGHTHOUSE_API_KEY environment variable."
      );
    }
    if (!existsSync(args.uploadPlaybook)) {
      throw new Error(`Playbook file not found: ${args.uploadPlaybook}`);
    }
    
    const progressCallback = (progressData: any) => {
      const percentage = 100 - ((progressData?.total / progressData?.uploaded) * 100 || 0);
      console.log(`   Upload progress: ${percentage.toFixed(2)}%`);
    };
    
    const registered = await registry.uploadAndRegisterToLighthouse(
      args.uploadPlaybook,
      undefined,
      progressCallback
    );
    console.log(`✅ Uploaded and registered playbook`);
    console.log(`   ID: ${registered.id}`);
    console.log(`   Name: ${registered.meta.name}`);
    console.log(`   CID: ${registered.source.cid}`);
    console.log(`   URL: ${registered.source.location}`);
    process.exit(0);
  }

  // Handle --register-from-lighthouse flag (register from CID)
  if (args.registerFromLighthouse) {
    if (!isLighthouseInitialized()) {
      throw new Error(
        "Lighthouse not initialized. Set LIGHTHOUSE_API_KEY environment variable."
      );
    }
    
    const cid = args.registerFromLighthouse;
    const registered = await registry.registerFromLighthouse(cid);
    console.log(`✅ Registered playbook from Lighthouse`);
    console.log(`   ID: ${registered.id}`);
    console.log(`   Name: ${registered.meta.name}`);
    console.log(`   CID: ${cid}`);
    process.exit(0);
  }

  // Handle --sync-lighthouse flag
  if (args.syncLighthouse) {
    if (!isLighthouseInitialized()) {
      throw new Error(
        "Lighthouse not initialized. Set LIGHTHOUSE_API_KEY environment variable."
      );
    }
    
    const synced = await registry.syncFromLighthouse();
    console.log(`✅ Synced ${synced.length} playbook(s) from Lighthouse`);
    process.exit(0);
  }

  // Handle playbook(s) specified for analysis
  if (args.playbook) {
    return await loadPlaybookForAnalysis(args.playbook, basicRules);
  }

  // Handle multiple playbooks
  if (args.playbooks) {
    const playbookIds = args.playbooks.split(",").map((id: string) => id.trim());
    console.log(`📋 Loading ${playbookIds.length} playbooks from registry...`);
    
    const playbookRules = await loadRulesFromMultiplePlaybooks(playbookIds);
    return {
      rules: [...basicRules, ...playbookRules],
      analysisMode: "multiple-playbooks",
    };
  }

  // Handle specific rules
  if (args.rules) {
    const requestedRuleIds = args.rules.split(",").map((id: string) => id.trim());
    const allRules = [...basicRules, ...advancedRules];
    const filteredRules = allRules.filter((rule) =>
      requestedRuleIds.includes(rule.id)
    );

    if (filteredRules.length === 0) {
      throw new Error(`No rules found matching: ${args.rules}`);
    }

    return { rules: filteredRules, analysisMode: "custom" };
  }

  // Auto-recommend playbooks based on contract patterns
  if (args.autoRecommend) {
    const contractPatterns = extractContractPatterns(args);
    const recommended = getRecommendedPlaybooks(contractPatterns);
    
    if (recommended.length > 0) {
      console.log(`🎯 Auto-recommended ${recommended.length} playbooks:`);
      for (const pb of recommended.slice(0, 3)) {
        console.log(`   - ${pb.meta.name} (${pb.id})`);
      }
      
      const recommendedRules = await loadRulesFromMultiplePlaybooks(
        recommended.slice(0, 3).map(pb => pb.id)
      );
      
      return {
        rules: [...basicRules, ...recommendedRules],
        analysisMode: "auto-recommended",
      };
    }
  }

  // Default mode-based rules
  switch (args.mode) {
    case "basic":
      return { rules: basicRules, analysisMode: "basic" };
    case "advanced":
      return {
        rules: [...basicRules, ...advancedRules],
        analysisMode: "advanced",
      };
    case "full":
    default:
      return {
        rules: [...basicRules, ...advancedRules],
        analysisMode: "full",
      };
  }
}

/**
 * Load a playbook for analysis - handles both registry IDs and file paths
 */
async function loadPlaybookForAnalysis(
  playbookArg: string,
  basicRules: Rule[]
): Promise<{ rules: Rule[]; analysisMode: string }> {
  const registry = getPlaybookRegistry();

  // Check if it's a registered playbook ID
  if (registry.has(playbookArg)) {
    console.log(`📋 Loading playbook from registry: ${playbookArg}`);
    
    const playbook = registry.get(playbookArg);
    if (playbook) {
      console.log(`   Name: ${playbook.meta.name}`);
      console.log(`   Author: ${playbook.meta.author}`);
      if (playbook.meta.description) {
        console.log(`   Description: ${playbook.meta.description}`);
      }
    }
    
    const playbookRules = await loadRulesFromRegistry(playbookArg);
    return {
      rules: [...basicRules, ...playbookRules],
      analysisMode: "playbook",
    };
  }

  // Check if it's a file path
  if (existsSync(playbookArg)) {
    console.log(`📋 Registering and loading playbook: ${playbookArg}`);
    
    // Register the playbook
    const registered = await registry.registerFromFile(playbookArg);
    console.log(`   Registered as: ${registered.id}`);
    console.log(`   Name: ${registered.meta.name}`);
    console.log(`   Author: ${registered.meta.author}`);
    
    // Load rules from newly registered playbook
    const playbookRules = await loadRulesFromRegistry(registered.id);
    return {
      rules: [...basicRules, ...playbookRules],
      analysisMode: "playbook",
    };
  }

  throw new Error(
    `Playbook not found: ${playbookArg}\n` +
    `  - Not registered in registry\n` +
    `  - Not found as file path\n` +
    `Use --list-playbooks to see available playbooks`
  );
}

/**
 * Extract contract patterns from command line args or detected contracts
 */
function extractContractPatterns(args: any): string[] {
  const patterns: string[] = [];

  // Extract from contract names if available
  if (args.contracts && Array.isArray(args.contracts)) {
    patterns.push(...args.contracts);
  }

  // Extract from file names
  if (args.files && Array.isArray(args.files)) {
    for (const file of args.files) {
      const name = basename(file, extname(file));
      patterns.push(name);
    }
  }

  // Common DeFi patterns to check for
  const commonPatterns = [
    "Token",
    "ERC20",
    "Vault",
    "Pool",
    "Staking",
    "Lending",
    "NFT",
    "ERC721",
    "Governance",
    "DAO",
  ];

  // Add common patterns if they match any detected contracts
  for (const pattern of commonPatterns) {
    const patternLower = pattern.toLowerCase();
    if (
      patterns.some(
        (p) =>
          p.toLowerCase().includes(patternLower) ||
          patternLower.includes(p.toLowerCase())
      )
    ) {
      patterns.push(pattern);
    }
  }

  return [...new Set(patterns)]; // Unique patterns
}

/**
 * Register playbooks from a project directory
 */
export async function registerProjectPlaybooks(projectRoot: string): Promise<number> {
  const registry = getPlaybookRegistry();
  
  // Common locations for playbooks
  const playbookDirs = [
    `${projectRoot}/playbooks`,
    `${projectRoot}/audit/playbooks`,
    `${projectRoot}/.superaudit/playbooks`,
  ];

  let registered = 0;
  for (const dir of playbookDirs) {
    if (existsSync(dir)) {
      console.log(`🔍 Discovering playbooks in: ${dir}`);
      const playbooks = await registry.registerFromDirectory(dir, true);
      registered += playbooks.length;
      console.log(`   Found ${playbooks.length} playbook(s)`);
    }
  }

  return registered;
}

/**
 * Show playbook information
 */
export function showPlaybookInfo(playbookId: string): void {
  const registry = getPlaybookRegistry();
  const playbook = registry.get(playbookId);

  if (!playbook) {
    console.error(`❌ Playbook not found: ${playbookId}`);
    console.log("\nAvailable playbooks:");
    const all = registry.getAll();
    for (const pb of all) {
      console.log(`  - ${pb.id}`);
    }
    return;
  }

  console.log(`\n📋 Playbook: ${playbook.id}`);
  console.log("=".repeat(50));
  console.log(`Name:        ${playbook.meta.name}`);
  console.log(`Author:      ${playbook.meta.author}`);
  console.log(`Version:     ${playbook.meta.version || "N/A"}`);
  
  if (playbook.meta.description) {
    console.log(`Description: ${playbook.meta.description}`);
  }

  if (playbook.meta.tags && playbook.meta.tags.length > 0) {
    console.log(`Tags:        ${playbook.meta.tags.join(", ")}`);
  }

  console.log(`\nSource:      ${playbook.source.type} - ${playbook.source.location}`);
  console.log(`Registered:  ${playbook.registeredAt.toLocaleString()}`);
  console.log(`Validated:   ${playbook.validated ? "✅ Yes" : "❌ No"}`);

  if (!playbook.validated && playbook.validationErrors) {
    console.log(`\nValidation Errors:`);
    for (const error of playbook.validationErrors) {
      console.log(`  ❌ ${error}`);
    }
  }

  if (playbook.parsedPlaybook) {
    const { staticRules, dynamicScenarios, invariants } = playbook.parsedPlaybook;
    
    console.log(`\nChecks:`);
    console.log(`  Static Rules:      ${staticRules.length}`);
    console.log(`  Dynamic Scenarios: ${dynamicScenarios.length}`);
    console.log(`  Invariants:        ${invariants.length}`);

    if (staticRules.length > 0) {
      console.log(`\nStatic Rules:`);
      const bySeverity = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      };
      for (const rule of staticRules) {
        bySeverity[rule.severity]++;
      }
      console.log(`  Critical: ${bySeverity.critical}`);
      console.log(`  High:     ${bySeverity.high}`);
      console.log(`  Medium:   ${bySeverity.medium}`);
      console.log(`  Low:      ${bySeverity.low}`);
      console.log(`  Info:     ${bySeverity.info}`);
    }
  }

  if (playbook.usageCount > 0) {
    console.log(`\nUsage:`);
    console.log(`  Times Used: ${playbook.usageCount}`);
    if (playbook.lastUsed) {
      console.log(`  Last Used:  ${playbook.lastUsed.toLocaleString()}`);
    }
  }

  if (playbook.meta.ai?.enabled) {
    console.log(`\nAI Integration:`);
    console.log(`  Enabled:         Yes`);
    console.log(`  Provider:        ${playbook.meta.ai.provider || "N/A"}`);
    console.log(`  Model:           ${playbook.meta.ai.model || "N/A"}`);
    console.log(`  Enhance Findings: ${playbook.meta.ai.enhance_findings ? "Yes" : "No"}`);
    console.log(`  Generate Fixes:   ${playbook.meta.ai.generate_fixes ? "Yes" : "No"}`);
  }

  console.log();
}

/**
 * Example of how to integrate into task definition
 */
export function exampleTaskIntegration() {
  // This shows how you would modify the task in tasks/analyze.ts
  
  /*
  task("superaudit")
    .addParam("playbook", "Playbook file path or registry ID", undefined, types.string, true)
    .addParam("playbooks", "Comma-separated playbook IDs", undefined, types.string, true)
    .addFlag("listPlaybooks", "List all registered playbooks")
    .addFlag("registryStats", "Show registry statistics")
    .addParam("searchPlaybooks", "Search playbooks by tags", undefined, types.string, true)
    .addParam("registerPlaybook", "Register a new playbook file", undefined, types.string, true)
    .addFlag("autoRecommend", "Auto-recommend playbooks based on contracts")
    .addParam("playbookInfo", "Show detailed info about a playbook", undefined, types.string, true)
    .setAction(async (taskArgs, hre) => {
      // Initialize registry at the start
      await initializePlaybookRegistry();
      
      // Register any project-local playbooks
      await registerProjectPlaybooks(hre.config.paths.root);
      
      // Handle playbook-info flag
      if (taskArgs.playbookInfo) {
        showPlaybookInfo(taskArgs.playbookInfo);
        return;
      }
      
      // Determine rules using registry-enhanced function
      const { rules, analysisMode } = await determineAnalysisRulesWithRegistry(
        taskArgs,
        BASIC_RULES,
        ADVANCED_RULES
      );
      
      // ... rest of analysis
    });
  */
}
