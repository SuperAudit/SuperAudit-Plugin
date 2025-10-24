import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { initializeLighthouseFromEnv } from "../playbooks/index.js";
import * as dotenv from "dotenv";

dotenv.config();

export default async function downloadPlaybookTask(
  taskArguments: any,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("📥 Downloading Playbook from Community Storage\n");

  try {
    // Initialize
    const lighthouseManager = initializeLighthouseFromEnv();

    // Get CID from environment variable or first positional argument after task name
    let cid = process.env.PLAYBOOK_CID;
    
    if (!cid) {
      // Try to get from process.argv after filtering out known Hardhat arguments
      const argv = process.argv.filter(arg => !arg.startsWith('--') && !arg.includes('hardhat'));
      const taskIndex = argv.findIndex(arg => arg.includes('download-playbook'));
      cid = taskIndex !== -1 && taskIndex + 1 < argv.length ? argv[taskIndex + 1] : undefined;
    }

    if (!cid) {
      console.error("❌ Error: CID is required\n");
      console.log("💡 Usage (Option 1 - Environment Variable):");
      console.log("   PLAYBOOK_CID=bafkreih... npx hardhat download-playbook\n");
      console.log("💡 Usage (Option 2 - Direct Command):");
      console.log("   Use the download-playbook.js script:");
      console.log("   node download-playbook.js bafkreih...");
      process.exit(1);
    }

    console.log(`📦 CID: ${cid}\n`);
    console.log("⏳ Downloading from IPFS...\n");

    const yamlContent = await lighthouseManager.downloadPlaybook(cid);
    const yaml = await import("yaml");
    const playbook = yaml.parse(yamlContent);

    console.log(`✅ Playbook downloaded successfully!\n`);
    console.log(`📋 Details:`);
    console.log(`   Name: ${playbook.name}`);
    console.log(`   Author: ${playbook.author || 'unknown'}`);
    console.log(`   Version: ${playbook.version}`);
    console.log(`   Tags: ${playbook.tags?.join(', ') || 'none'}`);
    console.log(`   Checks: ${playbook.checks?.length || 0}\n`);

    if (playbook.description) {
      console.log(`📝 Description:`);
      console.log(`   ${playbook.description}\n`);
    }

    console.log(`💡 Use this playbook in analysis:`);
    console.log(`   npx hardhat superaudit --playbook-cid ${cid}`);

  } catch (error) {
    console.error(`\n❌ Download failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
