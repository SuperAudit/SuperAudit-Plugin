import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { initializeLighthouseFromEnv } from "../playbooks/index.js";
import * as dotenv from "dotenv";

dotenv.config();

export default async function lighthouseInfoTask(
  taskArguments: any,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("ℹ️  Lighthouse Community Storage Information\n");

  try {
    const lighthouseManager = initializeLighthouseFromEnv();
    const hasCustomKey = !!process.env.LIGHTHOUSE_API_KEY;

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🌐 Storage Status`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    if (hasCustomKey) {
      console.log(`✅ Using your custom Lighthouse API key`);
      console.log(`   (from LIGHTHOUSE_API_KEY environment variable)\n`);
    } else {
      console.log(`🌍 Using shared SuperAudit community storage`);
      console.log(`   (no API key required!)\n`);
    }

    console.log(`📊 Storage Details:`);
    console.log(`   Network: IPFS (Lighthouse)`);
    console.log(`   Gateway: https://gateway.lighthouse.storage`);
    console.log(`   Protocol: Decentralized, permanent storage\n`);

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📚 Available Commands`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    console.log(`Upload a playbook:`);
    console.log(`   npx hardhat upload-playbook --file ./playbook.yaml\n`);

    console.log(`Download a playbook by CID:`);
    console.log(`   npx hardhat download-playbook --cid <CID>\n`);

    console.log(`List all registered playbooks:`);
    console.log(`   npx hardhat list-playbooks\n`);

    console.log(`Sync community playbooks:`);
    console.log(`   npx hardhat sync-playbooks\n`);

    console.log(`Run analysis with a specific playbook:`);
    console.log(`   npx hardhat superaudit --playbook-id <ID>`);
    console.log(`   npx hardhat superaudit --playbook-cid <CID>\n`);

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`💡 Tips`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    if (!hasCustomKey) {
      console.log(`• All uploads are shared with the community`);
      console.log(`• No API key setup required`);
      console.log(`• Your playbooks are permanently stored on IPFS`);
      console.log(`• Share CIDs with others for collaboration\n`);
      
      console.log(`🔑 Want your own storage?`);
      console.log(`   Get a free API key: https://lighthouse.storage`);
      console.log(`   Add to .env: LIGHTHOUSE_API_KEY=your_key\n`);
    } else {
      console.log(`• Using your private Lighthouse storage`);
      console.log(`• You can upload unlimited playbooks`);
      console.log(`• Share CIDs to collaborate with others\n`);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
