import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { parseAllSourceFiles, ParseError } from "../parser.js";
import { RuleEngine } from "../rules/engine.js";
import { Reporter } from "../reporter.js";
import { DEFAULT_RULES, BASIC_RULES, ADVANCED_RULES } from "../rules/index.js";
import { loadPlaybookRules, validatePlaybook, getSamplePlaybooks } from "../playbooks/index.js";
import { LLMClient } from "../ai/llm-client.js";
import { AIEnhancedRule } from "../rules/ai-enhanced-rule.js";
import { existsSync } from "fs";
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
    // Parse command line arguments manually for more flexibility
    const argv = process.argv;
    const args = {
      playbook: getArgValue(argv, "--playbook"),
      mode: getArgValue(argv, "--mode"),
      rules: getArgValue(argv, "--rules"),
      format: getArgValue(argv, "--format"),
      showSamples: hasFlag(argv, "--show-samples"),
      aiEnabled: hasFlag(argv, "--ai") || process.env.SUPERAUDIT_AI_ENABLED === "true"
    };

    // Handle special commands
    if (args.showSamples) {
      showSamplePlaybooks();
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
    }

    // Output results based on format
    switch (args.format) {
      case "json":
        outputJSON(reporter.getSummary(), allIssues, analysisTime);
        break;
      case "sarif":
        outputSARIF(allIssues, parseResults[0]?.filePath || "");
        break;
      default:
        outputConsole(reporter, analysisTime, analysisMode);
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
  // If playbook is specified, load rules from playbook
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
function outputConsole(reporter: Reporter, analysisTime: number, mode: string): void {
  reporter.printReport();
  
  const summary = reporter.getSummary();
  console.log(`\n📈 Analysis Performance:`);
  console.log(`   Mode: ${mode.toUpperCase()}`);
  console.log(`   Time: ${analysisTime}ms`);
  console.log(`   Issues: ${summary.totalIssues}`);
  
  if (summary.totalIssues > 0) {
    console.log(`\n🏁 Analysis complete: Found ${summary.totalIssues} issue(s)`);
    if (summary.errorCount > 0) {
      console.log(`   🔴 Critical/High: ${summary.errorCount}`);
    }
    if (summary.warningCount > 0) {
      console.log(`   🟡 Medium: ${summary.warningCount}`);
    }
    if (summary.infoCount > 0) {
      console.log(`   🔵 Low/Info: ${summary.infoCount}`);
    }
  }
}

/**
 * Output results in JSON format
 */
function outputJSON(summary: any, issues: any[], analysisTime: number): void {
  const result = {
    summary,
    issues,
    analysisTime,
    timestamp: new Date().toISOString()
  };
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Output results in SARIF format (basic implementation)
 */
function outputSARIF(issues: any[], sourceFile: string): void {
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
  
  console.log(JSON.stringify(sarif, null, 2));
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
