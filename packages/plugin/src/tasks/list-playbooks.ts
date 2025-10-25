import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import {
  initializeRegistry,
  getPlaybookRegistry,
  initializeLighthouseFromEnv,
  getSamplePlaybooks,
} from "../playbooks/index.js";
import * as dotenv from "dotenv";

dotenv.config();

export default async function listPlaybooksTask(
  taskArguments: any,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("📚 Available Playbooks\n");

  try {
    // Initialize
    initializeLighthouseFromEnv();
    const builtins = getSamplePlaybooks();
    await initializeRegistry(builtins);

    const registry = getPlaybookRegistry();
    const playbooks = registry.getAll();

    if (playbooks.length === 0) {
      console.log("📭 No playbooks registered yet.\n");
      console.log("💡 Upload your first playbook:");
      console.log("   npx hardhat upload-playbook --file ./path/to/playbook.yaml");
      return;
    }

    console.log(`Found ${playbooks.length} playbook(s):\n`);

    for (const playbook of playbooks) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 ${playbook.meta.name} (${playbook.id})`);
      console.log(`   Author: ${playbook.meta.author || 'unknown'}`);
      console.log(`   Version: ${playbook.meta.version}`);
      
      if (playbook.meta.tags && playbook.meta.tags.length > 0) {
        console.log(`   Tags: ${playbook.meta.tags.join(', ')}`);
      }

      if (playbook.meta.description) {
        console.log(`   Description: ${playbook.meta.description}`);
      }

      console.log(`   Source: ${playbook.source.type}`);
      
      if (playbook.source.type === 'lighthouse' && playbook.source.cid) {
        console.log(`   CID: ${playbook.source.cid}`);
        console.log(`   📎 ${playbook.source.location}`);
      }

      console.log();
    }

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`💡 Use a playbook in analysis:`);
    console.log(`   npx hardhat superaudit --playbook-id <ID>`);
    console.log(`   npx hardhat superaudit --playbook-cid <CID>`);

  } catch (error) {
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
