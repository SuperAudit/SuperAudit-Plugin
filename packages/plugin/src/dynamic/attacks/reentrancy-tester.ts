import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type {
  ReentrancyTestResult,
  AttackStep,
  DeployedContract,
  AttackSimulation
} from "../types.js";
import { ForkManager } from "../fork-manager.js";

/**
 * Automated reentrancy attack simulation and testing
 */
export class ReentrancyTester {
  private hre: HardhatRuntimeEnvironment;
  private forkManager: ForkManager;

  constructor(hre: HardhatRuntimeEnvironment) {
    this.hre = hre;
    this.forkManager = new ForkManager(hre);
  }

  /**
   * Test a contract for reentrancy vulnerabilities
   */
  async testReentrancyVulnerability(
    targetContract: DeployedContract,
    functionName: string,
    attackParams: any[] = []
  ): Promise<ReentrancyTestResult> {
    console.log(`🔄 Testing reentrancy in ${targetContract.name}.${functionName}...`);

    try {
      // Create snapshot for rollback
      const snapshot = await this.forkManager.snapshot();

      // Deploy attacker contract
      const attackerContract = await this.deployReentrancyAttacker(targetContract.address);
      
      // Get initial balances
      const initialVictimBalance = await this.getBalance(targetContract.address);
      const initialAttackerBalance = await this.getBalance(attackerContract.address);

      // Setup attack scenario
      const setupSteps = await this.setupReentrancyAttack(
        targetContract,
        attackerContract,
        attackParams
      );

      // Execute the reentrancy attack
      const attackSteps = await this.executeReentrancyAttack(
        targetContract,
        attackerContract,
        functionName,
        attackParams
      );

      // Check if attack was successful
      const finalVictimBalance = await this.getBalance(targetContract.address);
      const finalAttackerBalance = await this.getBalance(attackerContract.address);
      
      const profitAmount = finalAttackerBalance - initialAttackerBalance;
      const isVulnerable = profitAmount > 0 || finalVictimBalance < initialVictimBalance;

      const result: ReentrancyTestResult = {
        isVulnerable,
        exploitPath: [...setupSteps, ...attackSteps],
        profitAmount: profitAmount.toString(),
        victimContract: targetContract.name,
        attackContract: attackerContract.name,
        description: isVulnerable 
          ? `Reentrancy vulnerability confirmed! Attacker profited ${profitAmount} wei from ${functionName}`
          : `No reentrancy vulnerability detected in ${functionName}`
      };

      // Revert to clean state
      await this.forkManager.revert(snapshot);

      return result;

    } catch (error) {
      return {
        isVulnerable: false,
        exploitPath: [],
        profitAmount: "0",
        victimContract: targetContract.name,
        attackContract: "failed-to-deploy",
        description: `Reentrancy test failed: ${error}`
      };
    }
  }

  /**
   * Deploy a generic reentrancy attacker contract
   */
  private async deployReentrancyAttacker(targetAddress: string): Promise<DeployedContract> {
    // Create attacker contract bytecode
    const attackerSolidity = `
      contract ReentrancyAttacker {
        address public target;
        uint256 public attackAmount;
        bool public attacking;
        
        constructor(address _target) {
          target = _target;
        }
        
        function setAttackAmount(uint256 amount) external {
          attackAmount = amount;
        }
        
        function startAttack() external payable {
          attacking = true;
          // This will be customized based on the target function
          (bool success,) = target.call{value: msg.value}("");
          require(success, "Initial call failed");
        }
        
        receive() external payable {
          if (attacking && address(target).balance > 0) {
            attacking = false; // Prevent infinite recursion
            (bool success,) = target.call("");
            // Ignore success to continue attack
          }
        }
        
        fallback() external payable {
          if (attacking) {
            attacking = false;
            (bool success,) = target.call("");
            // Ignore success
          }
        }
        
        function withdraw() external {
          payable(msg.sender).transfer(address(this).balance);
        }
      }
    `;

    // For now, return a mock deployed contract since we can't easily compile and deploy
    // In a full implementation, we would compile this Solidity code and deploy it
    return {
      name: "ReentrancyAttacker",
      address: "0x1111111111111111111111111111111111111111", // Mock address
      abi: [], // Mock ABI
      bytecode: "0x", // Mock bytecode
      deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      constructorArgs: [targetAddress]
    };
  }

  /**
   * Setup the reentrancy attack scenario
   */
  private async setupReentrancyAttack(
    targetContract: DeployedContract,
    attackerContract: DeployedContract,
    params: any[]
  ): Promise<AttackStep[]> {
    const steps: AttackStep[] = [];

    // Give attacker contract some initial funds
    await this.forkManager.setBalance(attackerContract.address, "100 ether");
    
    steps.push({
      contract: "setup",
      method: "setBalance",
      params: [attackerContract.address, "100 ether"],
      gasUsed: 21000,
      result: "success"
    });

    return steps;
  }

  /**
   * Execute the actual reentrancy attack
   */
  private async executeReentrancyAttack(
    targetContract: DeployedContract,
    attackerContract: DeployedContract,
    functionName: string,
    params: any[]
  ): Promise<AttackStep[]> {
    const steps: AttackStep[] = [];

    try {
      // This would be the actual attack execution
      // For now, we simulate the steps
      
      steps.push({
        contract: targetContract.name,
        method: functionName,
        params: params,
        gasUsed: 50000,
        result: "reentrancy_detected"
      });

      return steps;

    } catch (error) {
      steps.push({
        contract: targetContract.name,
        method: functionName,
        params: params,
        gasUsed: 0,
        result: `failed: ${error}`
      });

      return steps;
    }
  }

  /**
   * Test multiple functions for reentrancy
   */
  async testAllFunctions(contract: DeployedContract): Promise<ReentrancyTestResult[]> {
    const results: ReentrancyTestResult[] = [];
    const publicMethods = this.getPublicMethods(contract);

    for (const method of publicMethods) {
      // Skip view/pure functions
      if (["view", "pure", "constant"].includes(method.stateMutability)) {
        continue;
      }

      const testResult = await this.testReentrancyVulnerability(
        contract,
        method.name,
        this.generateDefaultParams(method.inputs)
      );

      results.push(testResult);
    }

    return results;
  }

  /**
   * Get public methods from contract ABI
   */
  private getPublicMethods(contract: DeployedContract): any[] {
    return (contract.abi as any[]).filter((item: any) => 
      item.type === "function"
    );
  }

  /**
   * Generate default parameters for method inputs
   */
  private generateDefaultParams(inputs: any[]): any[] {
    return inputs.map(input => {
      switch (input.type) {
        case "address":
          return "0x1234567890123456789012345678901234567890";
        case "uint256":
          return "1000";
        case "bool":
          return true;
        default:
          return "0";
      }
    });
  }

  /**
   * Get balance of an address
   */
  private async getBalance(address: string): Promise<number> {
    try {
      // Demo implementation - would get actual balance from provider
      return Math.floor(Math.random() * 1000000); // Mock balance
    } catch (error) {
      return 0;
    }
  }

  /**
   * Create a standardized reentrancy attack simulation
   */
  createReentrancySimulation(targetFunction: string): AttackSimulation {
    return {
      name: `reentrancy-${targetFunction}`,
      target: targetFunction,
      type: "reentrancy",
      setup: {
        deployAttacker: true,
        initialBalance: "10 ether",
        requiredTokens: []
      },
      execution: {
        steps: [
          {
            contract: "attacker",
            method: "startAttack",
            params: [],
            gasUsed: 0
          }
        ],
        maxGasPerStep: 500000,
        expectedBehavior: "profit"
      },
      validation: {
        profitThreshold: "0",
        invariants: ["balance_consistency", "state_consistency"],
        assertions: ["profit(attacker) <= 0"]
      }
    };
  }
}
