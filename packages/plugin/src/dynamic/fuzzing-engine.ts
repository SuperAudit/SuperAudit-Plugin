import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type {
  FuzzingConfig,
  FuzzingResults,
  FuzzingViolation,
  CoverageInfo,
  DeployedContract,
  ContractInteraction,
  InteractionResult,
  ExecutionTrace,
  InputGenerator,
  FuzzingStrategy
} from "./types.js";
import { ForkManager } from "./fork-manager.js";

/**
 * Fuzzing engine for property-based testing and vulnerability discovery
 */
export class FuzzingEngine {
  private hre: HardhatRuntimeEnvironment;
  private forkManager: ForkManager;
  private inputGenerator: BasicInputGenerator;

  constructor(hre: HardhatRuntimeEnvironment) {
    this.hre = hre;
    this.forkManager = new ForkManager(hre);
    this.inputGenerator = new BasicInputGenerator();
  }

  /**
   * Run a fuzzing campaign on target contracts
   */
  async runFuzzingCampaign(
    contracts: DeployedContract[],
    config: FuzzingConfig
  ): Promise<FuzzingResults> {
    const startTime = Date.now();
    const results: FuzzingResults = {
      totalRuns: 0,
      failedRuns: 0,
      coverage: this.initializeCoverage(),
      violations: [],
      exploits: [],
      executionTime: 0
    };

    console.log(`🎲 Starting fuzzing campaign: ${config.runs} runs, depth ${config.depth}`);

    try {
      for (let run = 0; run < config.runs; run++) {
        if (Date.now() - startTime > config.timeout * 1000) {
          console.log("⏰ Fuzzing timeout reached");
          break;
        }

        const violation = await this.executeFuzzingRun(contracts, config, run);
        results.totalRuns++;

        if (violation) {
          results.violations.push(violation);
          results.failedRuns++;
          
          console.log(`🚨 Violation found in run ${run}: ${violation.description}`);
          
          // For critical violations, we might want to stop early
          if (violation.severity === "critical") {
            console.log("🛑 Critical violation found, stopping fuzzing");
            break;
          }
        }

        // Update progress occasionally
        if (run % 100 === 0 && run > 0) {
          console.log(`   Progress: ${run}/${config.runs} runs completed`);
        }
      }

      results.executionTime = Date.now() - startTime;
      console.log(`✅ Fuzzing complete: ${results.totalRuns} runs, ${results.failedRuns} violations`);
      
      return results;

    } catch (error) {
      results.executionTime = Date.now() - startTime;
      throw new Error(`Fuzzing campaign failed: ${error}`);
    }
  }

  /**
   * Execute a single fuzzing run
   */
  private async executeFuzzingRun(
    contracts: DeployedContract[],
    config: FuzzingConfig,
    runId: number
  ): Promise<FuzzingViolation | null> {
    try {
      // Create a snapshot to rollback after each run
      const snapshot = await this.forkManager.snapshot();

      // Generate a sequence of random interactions
      const interactions = this.generateInteractionSequence(contracts, config.depth);

      // Execute the sequence
      for (const interaction of interactions) {
        const result = await this.forkManager.executeInteraction(interaction);
        
        // Check for violations
        const violation = this.checkForViolations(interaction, result, runId);
        if (violation) {
          await this.forkManager.revert(snapshot);
          return violation;
        }
      }

      // Revert to clean state for next run
      await this.forkManager.revert(snapshot);
      return null;

    } catch (error) {
      // Execution error might indicate a violation
      return {
        type: "revert",
        function: "unknown",
        input: runId,
        trace: { steps: [], gasUsed: 0, success: false, revertReason: String(error) },
        severity: "medium",
        description: `Execution error in fuzzing run ${runId}: ${error}`
      };
    }
  }

  /**
   * Generate a random sequence of contract interactions
   */
  private generateInteractionSequence(
    contracts: DeployedContract[], 
    maxDepth: number
  ): ContractInteraction[] {
    const sequence: ContractInteraction[] = [];
    const seqLength = Math.floor(Math.random() * maxDepth) + 1;

    for (let i = 0; i < seqLength; i++) {
      // Pick a random contract and method
      const contract = contracts[Math.floor(Math.random() * contracts.length)];
      const methods = this.getPublicMethods(contract);
      
      if (methods.length === 0) continue;
      
      const method = methods[Math.floor(Math.random() * methods.length)];
      const params = this.generateMethodParams(method);

      sequence.push({
        contract,
        method: method.name,
        params,
        value: Math.random() > 0.9 ? `${Math.random() * 10}` : undefined,
        gasLimit: 500000
      });
    }

    return sequence;
  }

  /**
   * Get public/external methods from contract ABI
   */
  private getPublicMethods(contract: DeployedContract): any[] {
    // Filter for public/external functions, excluding view/pure for state-changing fuzzing
    return (contract.abi as any[]).filter((item: any) => 
      item.type === "function" && 
      ["public", "external", "nonpayable", "payable"].includes(item.stateMutability)
    );
  }

  /**
   * Generate parameters for a method based on its ABI
   */
  private generateMethodParams(method: any): any[] {
    return method.inputs.map((input: any) => {
      switch (input.type) {
        case "address":
          return this.inputGenerator.generateAddress();
        case "uint256":
          return this.inputGenerator.generateUint256();
        case "bytes":
          return this.inputGenerator.generateBytes();
        case "bool":
          return this.inputGenerator.generateBool();
        default:
          return "0x0"; // Default for unknown types
      }
    });
  }

  /**
   * Check interaction result for violations
   */
  private checkForViolations(
    interaction: ContractInteraction,
    result: InteractionResult,
    runId: number
  ): FuzzingViolation | null {
    // Check for unexpected reverts
    if (!result.success && result.error && !result.error.includes("revert")) {
      return {
        type: "panic",
        function: interaction.method,
        input: interaction.params,
        trace: result.trace || { steps: [], gasUsed: result.gasUsed, success: false },
        severity: "high",
        description: `Panic/Error in ${interaction.method}: ${result.error}`
      };
    }

    // Check for excessive gas usage
    if (result.gasUsed > 1000000) {
      return {
        type: "gas", 
        function: interaction.method,
        input: interaction.params,
        trace: result.trace || { steps: [], gasUsed: result.gasUsed, success: true },
        severity: "medium",
        description: `High gas usage in ${interaction.method}: ${result.gasUsed} gas`
      };
    }

    // TODO: Add more sophisticated violation checks
    // - State invariant violations
    // - Unexpected state changes
    // - Event emission patterns
    // - Cross-contract interaction issues

    return null;
  }

  /**
   * Initialize coverage tracking
   */
  private initializeCoverage(): CoverageInfo {
    return {
      totalLines: 0,
      coveredLines: 0,
      totalBranches: 0,
      coveredBranches: 0,
      coveragePercentage: 0,
      uncoveredLines: []
    };
  }
}

/**
 * Basic input generator for fuzzing
 */
class BasicInputGenerator implements InputGenerator {
  private readonly addresses = [
    "0x0000000000000000000000000000000000000000", // Zero address
    "0x000000000000000000000000000000000000dEaD", // Burn address
    "0x1234567890123456789012345678901234567890", // Random address
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // Vitalik's address
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap router
  ];

  generateAddress(): string {
    if (Math.random() > 0.7) {
      return this.addresses[Math.floor(Math.random() * this.addresses.length)];
    }
    
    // Generate random address
    const bytes = Array.from({ length: 20 }, () => 
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    );
    return `0x${bytes.join('')}`;
  }

  generateUint256(min: string = "0", max: string = "1000000"): string {
    const minVal = BigInt(min);
    const maxVal = BigInt(max);
    const range = maxVal - minVal;
    
    if (range <= 0n) return min;
    
    // Generate interesting values more often
    const rand = Math.random();
    if (rand < 0.1) return "0";           // Zero
    if (rand < 0.2) return "1";           // One  
    if (rand < 0.3) return max;           // Maximum
    if (rand < 0.4) return String(maxVal - 1n); // Max - 1
    
    // Random value in range
    const randomVal = minVal + BigInt(Math.floor(Math.random() * Number(range)));
    return randomVal.toString();
  }

  generateBytes(length: number = 32): string {
    const bytes = Array.from({ length }, () => 
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    );
    return `0x${bytes.join('')}`;
  }

  generateBool(): boolean {
    return Math.random() > 0.5;
  }

  generateArray<T>(generator: () => T, maxLength: number = 5): T[] {
    const length = Math.floor(Math.random() * maxLength);
    return Array.from({ length }, generator);
  }
}
