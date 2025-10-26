import { HardhatUserConfig } from "hardhat/config";
import superauditPlugin from "hardhat-superaudit";

export default {
  plugins: [superauditPlugin],
  solidity: "0.8.29",
  
  // SuperAudit configuration (optional - can also use CLI flags)
  superaudit: {
    mode: "full",  // Options: "basic", "advanced", "full"
    format: "console",  // Options: "console", "json", "sarif" - can be overridden by CLI
    output: "./audit-report.txt",  // Optional: save report to file
    playbook: "./playbooks/erc20-token-security.yaml",  // ERC20 token security audit
    // Alternative playbooks:
    // playbook: "./vault-security.yaml",  // For vault contracts
    // playbook: "./playbooks/ai-defi-security.yaml",  // AI-enhanced DeFi audit
    // rules: ["no-tx-origin", "reentrancy-paths"],  // Optional: specific rules
    ai: {
      enabled: true,  // AI-powered analysis enabled
      provider: "openai",  // Options: "openai", "anthropic", "local"
      model: "gpt-4o-mini",  // Fast and cheap model
      temperature: 0.3,
      maxTokens: 1000
    }
  },
} satisfies HardhatUserConfig;
