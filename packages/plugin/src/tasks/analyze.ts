import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { parseAllSourceFiles, ParseError } from "../parser.js";
import { RuleEngine } from "../rules/engine.js";
import { Reporter } from "../reporter.js";
import { DEFAULT_RULES, BASIC_RULES, ADVANCED_RULES } from "../rules/index.js";
import { loadPlaybookRules, validatePlaybook, getSamplePlaybooks } from "../playbooks/index.js";
import { 
  initializeRegistry,
  getPlaybookRegistry,
  initializeLighthouseFromEnv,
  isLighthouseInitialized,
  loadRulesFromRegistry
} from "../playbooks/index.js";
import { LLMClient } from "../ai/llm-client.js";
import { AIEnhancedRule } from "../rules/ai-enhanced-rule.js";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface AnalyzeTaskArguments {
  [key: string]: any; // Allow flexible arguments for now
}

export default async function analyzeTask(
  taskArguments: AnalyzeTaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("🔍 SuperAudit - Advanced Smart Contract Security Analysis\n");

  try {
    // Initialize playbook registry and Lighthouse (always available with default shared API key)
    const lighthouse = initializeLighthouseFromEnv();
    
    const builtins = getSamplePlaybooks();
    await initializeRegistry(builtins);
    
    // Sync from Lighthouse (shared community playbooks)
    try {
      const registry = getPlaybookRegistry();
      const synced = await registry.syncFromLighthouse();
      if (synced.length > 0) {
        console.log(`✅ Loaded ${synced.length} shared playbook(s) from community\n`);
      }
    } catch (error) {
      // Silently fail sync - not critical
      console.log();
    }
    
    // Get config from hardhat.config.ts (if available)
    const configDefaults = hre.config.superaudit || {};
    
    // Parse command line arguments manually (CLI overrides config)
    const argv = process.argv;
    const args = {
      playbook: getArgValue(argv, "--playbook") || configDefaults.playbook,
      playbookCid: getArgValue(argv, "--playbook-cid"),
      playbookId: getArgValue(argv, "--playbook-id"),
      mode: getArgValue(argv, "--mode") || configDefaults.mode,
      rules: getArgValue(argv, "--rules") || (configDefaults.rules ? configDefaults.rules.join(",") : undefined),
      format: getArgValue(argv, "--format") || configDefaults.format,
      output: getArgValue(argv, "--output") || configDefaults.output,
      showSamples: hasFlag(argv, "--show-samples"),
      listPlaybooks: hasFlag(argv, "--list-playbooks"),
      uploadPlaybook: getArgValue(argv, "--upload-playbook"),
      aiEnabled: hasFlag(argv, "--ai") || configDefaults.ai?.enabled || process.env.SUPERAUDIT_AI_ENABLED === "true"
    };

    // Handle special commands
    if (args.showSamples) {
      showSamplePlaybooks();
      return;
    }
    
    // Handle --list-playbooks
    if (args.listPlaybooks) {
      const registry = getPlaybookRegistry();
      const allPlaybooks = registry.getAll();
      console.log("📋 Registered Playbooks:\n");
      for (const pb of allPlaybooks) {
        console.log(`  🔸 ${pb.id}`);
        console.log(`     Name: ${pb.meta.name}`);
        console.log(`     Author: ${pb.meta.author || 'unknown'}`);
        console.log(`     Source: ${pb.source.type}`);
        if (pb.source.cid) {
          console.log(`     CID: ${pb.source.cid}`);
        }
        console.log();
      }
      console.log(`Total: ${allPlaybooks.length} playbook(s)`);
      return;
    }
    
    // Handle --upload-playbook
    if (args.uploadPlaybook) {
      if (!existsSync(args.uploadPlaybook)) {
        throw new Error(`Playbook file not found: ${args.uploadPlaybook}`);
      }
      
      console.log(`📤 Uploading playbook to shared community storage...\n`);
      console.log(`   File: ${args.uploadPlaybook}\n`);
      
      const progressCallback = (progressData: any) => {
        const percentage = 100 - ((progressData?.total / progressData?.uploaded) * 100 || 0);
        process.stdout.write(`\r   Upload progress: ${percentage.toFixed(2)}%`);
      };
      
      const registry = getPlaybookRegistry();
      const registered = await registry.uploadAndRegisterToLighthouse(
        args.uploadPlaybook,
        undefined,
        progressCallback
      );
      
      console.log(`\n\n✅ Playbook uploaded to community storage!`);
      console.log(`   ID: ${registered.id}`);
      console.log(`   Name: ${registered.meta.name}`);
      console.log(`   CID: ${registered.source.cid}`);
      console.log(`   URL: ${registered.source.location}`);
      console.log(`\n💡 Anyone can now use this playbook with:`);
      console.log(`   npx hardhat superaudit --playbook-cid ${registered.source.cid}`);
      return;
    }

    // Determine analysis mode and rules using manually parsed args
    let { rules, analysisMode } = await determineAnalysisRules(args);
    
    // Initialize AI enhancement if enabled
    let llmClient: LLMClient | undefined;
    let aiEnhancedRules: AIEnhancedRule[] = [];
    
    if (args.aiEnabled) {
      const aiConfig = getAIConfig();
      
      if (aiConfig.apiKey) {
        console.log(`🤖 AI Enhancement: ENABLED (${aiConfig.provider})`);
        llmClient = new LLMClient(aiConfig);
        
        // Wrap rules with AI enhancement
        aiEnhancedRules = rules.map(rule => new AIEnhancedRule(rule, llmClient!, true));
        rules = aiEnhancedRules as any[];
      } else {
        console.log(`⚠️ AI Enhancement: DISABLED (No API key found)`);
      }
    }
    
    console.log(`📊 Analysis Mode: ${analysisMode.toUpperCase()}`);
    console.log(`🔧 Rules: ${rules.length} active rule(s)\n`);

    // Get the contracts directory from Hardhat config
    let contractsPath: string;
    if (typeof hre.config.paths.sources === 'string') {
      contractsPath = hre.config.paths.sources;
    } else {
      contractsPath = (hre.config.paths.sources as any).sources || './contracts';
    }
    console.log(`📂 Scanning contracts in: ${contractsPath}`);

    // Parse all Solidity files
    let parseResults;
    try {
      parseResults = await parseAllSourceFiles(contractsPath);
    } catch (error) {
      if (error instanceof ParseError) {
        console.error(`❌ Parse error: ${error.message}`);
        process.exit(1);
      } else {
        console.error(`❌ Failed to parse source files: ${error}`);
        process.exit(1);
      }
    }

    if (parseResults.length === 0) {
      console.log("⚠️ No Solidity files found to analyze");
      return;
    }

    console.log(`✅ Successfully parsed ${parseResults.length} contract(s)\n`);

    // Create and run analysis
    const startTime = Date.now();
    const reporter = new Reporter();
    const ruleEngine = new RuleEngine(rules, reporter);

    console.log("🚀 Starting comprehensive security analysis...");
    
    // Show rule breakdown
    const basicRuleCount = rules.filter(rule => BASIC_RULES.some(br => br.id === rule.id)).length;
    const advancedRuleCount = rules.filter(rule => ADVANCED_RULES.some(ar => ar.id === rule.id)).length;
    const playbookRuleCount = rules.length - basicRuleCount - advancedRuleCount;

    if (basicRuleCount > 0) {
      console.log(`   ⚡ ${basicRuleCount} basic AST rules (fast)`);
    }
    if (advancedRuleCount > 0) {
      console.log(`   🧠 ${advancedRuleCount} CFG-based rules (advanced)`);
    }
    if (playbookRuleCount > 0) {
      console.log(`   📋 ${playbookRuleCount} playbook rules (custom)`);
    }
    console.log();

    // Analyze all parsed files
    let allIssues = ruleEngine.analyzeMultiple(parseResults);
    const analysisTime = Date.now() - startTime;

    // Enhance issues with AI if enabled
    if (args.aiEnabled && llmClient && aiEnhancedRules.length > 0) {
      console.log(`\n🤖 Enhancing findings with AI analysis...`);
      const aiStartTime = Date.now();
      
      // Create context map for AI enhancement
      const contextMap = new Map();
      parseResults.forEach(result => {
        const issuesForFile = allIssues.filter(i => i.file === result.filePath);
        issuesForFile.forEach(issue => {
          contextMap.set(issue, {
            ast: result.ast,
            sourceCode: result.sourceCode,
            filePath: result.filePath,
            issues: []
          });
        });
      });

      // Enhance issues with each AI-enhanced rule
      for (const aiRule of aiEnhancedRules) {
        allIssues = await aiRule.enhanceIssues(allIssues, contextMap);
      }
      
      const aiTime = Date.now() - aiStartTime;
      console.log(`✅ AI enhancement complete (${aiTime}ms)\n`);
      
      // Update reporter with AI-enhanced issues
      reporter.clear();
      reporter.addIssues(allIssues);
    }

    // Output results based on format
    switch (args.format) {
      case "json":
        outputJSON(reporter.getSummary(), allIssues, analysisTime, args.output);
        break;
      case "sarif":
        outputSARIF(allIssues, parseResults[0]?.filePath || "", args.output);
        break;
      default:
        outputConsole(reporter, analysisTime, analysisMode, args.output);
    }

    // Exit with appropriate code
    const summary = reporter.getSummary();
    if (reporter.hasErrors()) {
      console.log("\n💥 Critical issues detected - review required");
      process.exit(1);
    } else if (summary.totalIssues > 0) {
      console.log("\n⚠️ Issues found - please review");
    } else {
      console.log("\n🎉 No security issues detected!");
    }

  } catch (error) {
    console.error(`❌ Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

/**
 * Utility functions for parsing command line arguments
 */
function getArgValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index !== -1 && index + 1 < argv.length ? argv[index + 1] : undefined;
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

/**
 * Determine which rules to run based on arguments
 */
async function determineAnalysisRules(args: any): Promise<{
  rules: any[], 
  analysisMode: string
}> {
  // If playbook CID is specified, load from Lighthouse (shared community storage)
  if (args.playbookCid) {
    console.log(`📥 Loading playbook from community storage...`);
    console.log(`   CID: ${args.playbookCid}\n`);
    const registry = getPlaybookRegistry();
    const registered = await registry.registerFromLighthouse(args.playbookCid);
    const playbookRules = await loadRulesFromRegistry(registered.id);
    console.log(`✅ Loaded "${registered.meta.name}" from IPFS\n`);
    return { rules: [...BASIC_RULES, ...playbookRules], analysisMode: "community-playbook" };
  }
  
  // If playbook ID is specified, load from registry
  if (args.playbookId) {
    console.log(`📋 Loading playbook from registry: ${args.playbookId}`);
    const playbookRules = await loadRulesFromRegistry(args.playbookId);
    return { rules: [...BASIC_RULES, ...playbookRules], analysisMode: "registry" };
  }
  
  // If playbook file is specified, load rules from playbook
  if (args.playbook) {
    if (!existsSync(args.playbook)) {
      throw new Error(`Playbook file not found: ${args.playbook}`);
    }
    
    console.log(`📋 Loading playbook: ${args.playbook}`);
    const playbookRules = await loadPlaybookRules(args.playbook);
    return { rules: [...BASIC_RULES, ...playbookRules], analysisMode: "playbook" };
  }

  // If specific rules are requested
  if (args.rules) {
    const requestedRuleIds = args.rules.split(",").map((id: string) => id.trim());
    const allRules = [...BASIC_RULES, ...ADVANCED_RULES];
    const filteredRules = allRules.filter(rule => requestedRuleIds.includes(rule.id));
    
    if (filteredRules.length === 0) {
      throw new Error(`No rules found matching: ${args.rules}`);
    }
    
    return { rules: filteredRules, analysisMode: "custom" };
  }

  // Determine mode-based rules
  switch (args.mode) {
    case "basic":
      return { rules: BASIC_RULES, analysisMode: "basic" };
    case "advanced":
      return { rules: [...BASIC_RULES, ...ADVANCED_RULES], analysisMode: "advanced" };
    case "full":
    default:
      return { rules: DEFAULT_RULES, analysisMode: "full" };
  }
}

/**
 * Show sample playbooks to help users get started
 */
function showSamplePlaybooks(): void {
  console.log("📋 SuperAudit Sample Playbooks\n");
  
  const samples = getSamplePlaybooks();
  
  for (const [name, content] of Object.entries(samples)) {
    console.log(`🔸 ${name}`);
    console.log("─".repeat(50));
    console.log(content);
    console.log("\n" + "─".repeat(50) + "\n");
  }

  console.log("💡 Usage:");
  console.log("  1. Save a sample playbook to a .yaml file");
  console.log("  2. Run: npx hardhat analyze --playbook path/to/playbook.yaml");
  console.log("  3. Customize the playbook for your specific needs\n");
}

/**
 * Output results in console format
 */
function outputConsole(reporter: Reporter, analysisTime: number, mode: string, outputFile?: string): void {
  const output = generateConsoleReport(reporter, analysisTime, mode);
  
  if (outputFile) {
    const filePath = outputFile.endsWith('.txt') ? outputFile : `${outputFile}.txt`;
    writeFileSync(filePath, stripAnsiCodes(output));
    console.log(output);
    console.log(`\n📄 Report saved to: ${filePath}`);
  } else {
    console.log(output);
  }
}

/**
 * Generate console report as a string
 */
function generateConsoleReport(reporter: Reporter, analysisTime: number, mode: string): string {
  let output = '';
  
  // Capture the reporter output
  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (...args: any[]) => {
    logs.push(args.join(' '));
  };
  
  reporter.printReport();
  
  console.log = originalLog;
  output = logs.join('\n');
  
  const summary = reporter.getSummary();
  output += `\n\n📈 Analysis Performance:`;
  output += `\n   Mode: ${mode.toUpperCase()}`;
  output += `\n   Time: ${analysisTime}ms`;
  output += `\n   Issues: ${summary.totalIssues}`;
  
  if (summary.totalIssues > 0) {
    output += `\n\n🏁 Analysis complete: Found ${summary.totalIssues} issue(s)`;
    if (summary.errorCount > 0) {
      output += `\n   🔴 Critical/High: ${summary.errorCount}`;
    }
    if (summary.warningCount > 0) {
      output += `\n   🟡 Medium: ${summary.warningCount}`;
    }
    if (summary.infoCount > 0) {
      output += `\n   🔵 Low/Info: ${summary.infoCount}`;
    }
  }
  
  return output;
}

/**
 * Strip ANSI color codes from string
 */
function stripAnsiCodes(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Output results in JSON format
 */
function outputJSON(summary: any, issues: any[], analysisTime: number, outputFile?: string): void {
  const result = {
    summary,
    issues,
    analysisTime,
    timestamp: new Date().toISOString()
  };
  
  const jsonOutput = JSON.stringify(result, null, 2);
  
  if (outputFile) {
    const filePath = outputFile.endsWith('.json') ? outputFile : `${outputFile}.json`;
    writeFileSync(filePath, jsonOutput);
    console.log(jsonOutput);
    console.log(`\n📄 JSON report saved to: ${filePath}`);
  } else {
    console.log(jsonOutput);
  }
}

/**
 * Output results in SARIF format (basic implementation)
 */
function outputSARIF(issues: any[], sourceFile: string, outputFile?: string): void {
  const sarif = {
    version: "2.1.0",
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    runs: [{
      tool: {
        driver: {
          name: "SuperAudit",
          version: "1.0.0",
          informationUri: "https://github.com/superaudit/hardhat-plugin"
        }
      },
      results: issues.map(issue => ({
        ruleId: issue.ruleId,
        message: { text: issue.message },
        level: issue.severity === "error" ? "error" : "warning",
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: issue.file },
            region: {
              startLine: issue.line,
              startColumn: issue.column
            }
          }
        }]
      }))
    }]
  };
  
  const sarifOutput = JSON.stringify(sarif, null, 2);
  
  if (outputFile) {
    const filePath = outputFile.endsWith('.sarif') ? outputFile : `${outputFile}.sarif`;
    writeFileSync(filePath, sarifOutput);
    console.log(sarifOutput);
    console.log(`\n📄 SARIF report saved to: ${filePath}`);
  } else {
    console.log(sarifOutput);
  }
}

/**
 * Get AI configuration from environment variables
 */
function getAIConfig() {
  const provider = (process.env.SUPERAUDIT_AI_PROVIDER || "openai") as "openai" | "anthropic" | "local";
  const apiKey = provider === "openai" 
    ? process.env.OPENAI_API_KEY 
    : provider === "anthropic"
    ? process.env.ANTHROPIC_API_KEY
    : undefined;

  return {
    provider,
    apiKey,
    model: process.env.SUPERAUDIT_AI_MODEL,
    temperature: parseFloat(process.env.SUPERAUDIT_AI_TEMPERATURE || "0.3"),
    maxTokens: parseInt(process.env.SUPERAUDIT_AI_MAX_TOKENS || "1000")
  };
}
