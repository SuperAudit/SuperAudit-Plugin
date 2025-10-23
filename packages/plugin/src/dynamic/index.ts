// Export all dynamic analysis components
export * from "./types.js";
export { ForkManager } from "./fork-manager.js";
export { FuzzingEngine } from "./fuzzing-engine.js";
export { ReentrancyTester } from "./attacks/reentrancy-tester.js";

// Convenience functions for dynamic analysis
import { ForkManager } from "./fork-manager.js";
import { FuzzingEngine } from "./fuzzing-engine.js";
import { ReentrancyTester } from "./attacks/reentrancy-tester.js";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { 
  FuzzingConfig, 
  DeployedContract, 
  ReentrancyTestResult,
  FuzzingResults
} from "./types.js";

/**
 * Main dynamic analysis orchestrator
 */
export class DynamicAnalyzer {
  private hre: HardhatRuntimeEnvironment;
  private forkManager: ForkManager;
  private fuzzingEngine: FuzzingEngine;
  private reentrancyTester: ReentrancyTester;

  constructor(hre: HardhatRuntimeEnvironment) {
    this.hre = hre;
    this.forkManager = new ForkManager(hre);
    this.fuzzingEngine = new FuzzingEngine(hre);
    this.reentrancyTester = new ReentrancyTester(hre);
  }

  /**
   * Run comprehensive dynamic analysis on deployed contracts
   */
  async analyzeContracts(
    contracts: DeployedContract[],
    config: Partial<FuzzingConfig> = {}
  ): Promise<{
    fuzzingResults: FuzzingResults;
    reentrancyResults: ReentrancyTestResult[];
  }> {
    console.log("🚀 Starting dynamic analysis...\n");

    const fuzzingConfig: FuzzingConfig = {
      runs: config.runs || 100,
      depth: config.depth || 3,
      strategy: config.strategy || "coverage",
      timeout: config.timeout || 60, // 1 minute default
      seed: config.seed
    };

    // Run fuzzing analysis
    console.log("1️⃣ Running fuzzing campaign...");
    const fuzzingResults = await this.fuzzingEngine.runFuzzingCampaign(contracts, fuzzingConfig);

    // Run reentrancy tests
    console.log("\n2️⃣ Testing for reentrancy vulnerabilities...");
    const reentrancyResults: ReentrancyTestResult[] = [];
    for (const contract of contracts) {
      const contractResults = await this.reentrancyTester.testAllFunctions(contract);
      reentrancyResults.push(...contractResults);
    }

    console.log("\n✅ Dynamic analysis complete!");
    
    return {
      fuzzingResults,
      reentrancyResults
    };
  }

  /**
   * Quick reentrancy check for specific function
   */
  async quickReentrancyTest(
    contractAddress: string,
    functionName: string
  ): Promise<ReentrancyTestResult> {
    // This would be implemented to do a quick single-function test
    // For now, return a mock result
    return {
      isVulnerable: false,
      exploitPath: [],
      profitAmount: "0", 
      victimContract: contractAddress,
      attackContract: "quick-tester",
      description: `Quick reentrancy test for ${functionName} - not implemented in MVP`
    };
  }

  /**
   * Get access to the fork manager for custom testing
   */
  getForkManager(): ForkManager {
    return this.forkManager;
  }

  /**
   * Get access to the fuzzing engine
   */
  getFuzzingEngine(): FuzzingEngine {
    return this.fuzzingEngine;
  }

  /**
   * Get access to the reentrancy tester
   */
  getReentrancyTester(): ReentrancyTester {
    return this.reentrancyTester;
  }
}
