import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import {
  initializeRegistry,
  getPlaybookRegistry,
  initializeLighthouseFromEnv,
  getSamplePlaybooks,
} from "../playbooks/index.js";
import * as dotenv from "dotenv";

dotenv.config();

export default async function syncPlaybooksTask(
  taskArguments: any,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("🔄 Syncing Community Playbooks\n");

  try {
    // Initialize
    initializeLighthouseFromEnv();
    const builtins = getSamplePlaybooks();
    await initializeRegistry(builtins);

    const registry = getPlaybookRegistry();
    const synced = await registry.syncFromLighthouse();
    const syncedCount = synced.length;

    if (syncedCount === 0) {
      console.log("✅ No new playbooks to sync.\n");
      console.log("💡 All community playbooks are up to date!");
      return;
    }

    console.log(`✅ Synced ${syncedCount} new playbook(s) from community storage!\n`);
    console.log(`📊 Total registered playbooks: ${registry.getAll().length}\n`);
    console.log(`💡 View all playbooks:`);
    console.log(`   npx hardhat list-playbooks`);

  } catch (error) {
    console.error(`\n❌ Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
