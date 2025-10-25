/**
 * Example: Using Lighthouse Storage with Playbook Registry
 * 
 * This example demonstrates how to use Lighthouse (IPFS) storage
 * for uploading, retrieving, and managing playbooks.
 * 
 * Prerequisites:
 * - LIGHTHOUSE_API_KEY set in .env file
 * - @lighthouse-web3/sdk installed
 */

import dotenv from "dotenv";
import { join } from "path";
import { tmpdir } from "os";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import {
  initializeRegistry,
  getPlaybookRegistry,
  initializeLighthouse,
  initializeLighthouseFromEnv,
  getLighthouse,
  isLighthouseInitialized,
  loadRulesFromRegistry,
  getSamplePlaybooks,
} from "./index.js";

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, "../../.env") });

async function main() {
  console.log("🚀 Lighthouse Integration Example\n");

  // Check for API key
  if (!process.env.LIGHTHOUSE_API_KEY) {
    console.error("❌ LIGHTHOUSE_API_KEY not found in environment");
    console.log("   Please add it to your .env file");
    process.exit(1);
  }

  // 1. Initialize Registry with Lighthouse
  console.log("1️⃣  Initializing Registry with Lighthouse...");
  
  // Initialize Lighthouse
  initializeLighthouseFromEnv();
  
  // Initialize registry with builtins
  const builtins = getSamplePlaybooks();
  await initializeRegistry(builtins);
  
  if (isLighthouseInitialized()) {
    console.log("✅ Lighthouse initialized\n");
  } else {
    console.error("❌ Lighthouse failed to initialize\n");
    process.exit(1);
  }

  const registry = getPlaybookRegistry();
  const lighthouse = getLighthouse();

  // 2. Create a sample playbook
  console.log("2️⃣  Creating sample playbook...");
  const samplePlaybook = `
version: "1.0"
meta:
  name: "Lighthouse Test Playbook"
  author: "SuperAudit Demo"
  description: "A test playbook for Lighthouse integration"
  tags: ["test", "demo", "lighthouse"]
  version: "1.0.0"
  ai:
    enabled: true
    provider: "openai"

targets:
  contracts: ["Test*"]

checks:
  - id: "test-check-1"
    rule: "pattern.test()"
    severity: "low"
    description: "Test rule for demonstration"
    
  - id: "test-check-2"
    rule: "access.publicFunction(critical=true)"
    severity: "high"
    description: "Check for critical public functions"
`.trim();

  const tempFile = join(tmpdir(), "lighthouse-test-playbook.yaml");
  writeFileSync(tempFile, samplePlaybook);
  console.log(`   Created: ${tempFile}\n`);

  // 3. Upload to Lighthouse
  console.log("3️⃣  Uploading playbook to Lighthouse...");
  
  const progressCallback = (progressData: any) => {
    if (progressData?.total && progressData?.uploaded) {
      const percentage = ((progressData.uploaded / progressData.total) * 100).toFixed(2);
      console.log(`   Progress: ${percentage}%`);
    }
  };

  try {
    const metadata = await lighthouse.uploadPlaybook(tempFile, progressCallback);
    
    console.log("\n✅ Upload successful!");
    console.log(`   CID: ${metadata.cid}`);
    console.log(`   Name: ${metadata.name}`);
    console.log(`   Size: ${metadata.size} bytes`);
    console.log(`   URL: ${metadata.lighthouseUrl}\n`);

    // 4. Register the uploaded playbook
    console.log("4️⃣  Registering from Lighthouse CID...");
    const registered = await registry.registerFromLighthouse(
      metadata.cid,
      "lighthouse-test"
    );
    
    console.log("✅ Registered from Lighthouse");
    console.log(`   ID: ${registered.id}`);
    console.log(`   Name: ${registered.meta.name}`);
    console.log(`   Author: ${registered.meta.author}`);
    console.log(`   Validated: ${registered.validated}\n`);

    // 5. Load rules from the registered playbook
    console.log("5️⃣  Loading rules from registered playbook...");
    const rules = await loadRulesFromRegistry("lighthouse-test");
    console.log(`✅ Loaded ${rules.length} rule(s)\n`);

    // 6. Demonstrate direct upload and register
    console.log("6️⃣  Upload and register in one step...");
    const directRegistered = await registry.uploadAndRegisterToLighthouse(
      tempFile,
      "lighthouse-test-direct",
      progressCallback
    );
    
    console.log("\n✅ Uploaded and registered in one step");
    console.log(`   ID: ${directRegistered.id}`);
    console.log(`   CID: ${directRegistered.source.cid}`);
    console.log(`   URL: ${directRegistered.source.location}\n`);

    // 7. List all uploads
    console.log("7️⃣  Listing all Lighthouse uploads...");
    try {
      const uploads = await lighthouse.listUploads();
      console.log(`Found ${uploads.length} YAML file(s) on Lighthouse:`);
      for (const upload of uploads.slice(0, 5)) {
        console.log(`   - ${upload.name} (${upload.cid.substring(0, 12)}...)`);
      }
      console.log();
    } catch (error) {
      console.log("   (Unable to list uploads - API limitation)\n");
    }

    // 8. Sync from Lighthouse
    console.log("8️⃣  Syncing playbooks from Lighthouse...");
    const synced = await registry.syncFromLighthouse();
    console.log(`✅ Synced ${synced.length} new playbook(s)\n`);

    // 9. Show all registered playbooks
    console.log("9️⃣  All registered playbooks:");
    const allPlaybooks = registry.getAll();
    console.log(`Total: ${allPlaybooks.length} playbook(s)`);
    
    // Show Lighthouse-stored ones
    const lighthousePlaybooks = allPlaybooks.filter(
      pb => pb.source.type === "lighthouse"
    );
    console.log(`\nLighthouse-stored: ${lighthousePlaybooks.length}`);
    for (const pb of lighthousePlaybooks) {
      console.log(`   - ${pb.meta.name} (${pb.id})`);
      console.log(`     CID: ${pb.source.cid}`);
      console.log(`     URL: ${pb.source.location}`);
    }
    console.log();

    // 10. Demonstrate CID accessibility check
    console.log("🔟 Checking CID accessibility...");
    const accessible = await lighthouse.isCIDAccessible(metadata.cid);
    console.log(`   CID ${metadata.cid.substring(0, 12)}... is ${accessible ? "accessible ✅" : "not accessible ❌"}\n`);

    // 11. Get playbook metadata
    console.log("1️⃣1️⃣  Getting playbook metadata...");
    const playbookMeta = await lighthouse.getPlaybookMetadata(metadata.cid);
    console.log(`   Name: ${playbookMeta.name}`);
    console.log(`   Author: ${playbookMeta.author}`);
    console.log(`   Description: ${playbookMeta.description}`);
    console.log(`   Tags: ${playbookMeta.tags?.join(", ")}`);
    console.log();

    // 12. Show usage statistics
    console.log("1️⃣2️⃣  Usage Statistics:");
    const stats = registry.getStats();
    console.log(`   Total playbooks: ${stats.totalPlaybooks}`);
    console.log(`   By source type:`);
    for (const [type, count] of Object.entries(stats.bySource)) {
      console.log(`     ${type}: ${count}`);
    }
    console.log();

    // 13. Summary
    console.log("=" .repeat(60));
    console.log("✅ Demo Completed Successfully!");
    console.log("=" .repeat(60));
    console.log("\n📝 Summary:");
    console.log(`   - Uploaded playbook to IPFS`);
    console.log(`   - CID: ${metadata.cid}`);
    console.log(`   - Gateway URL: ${metadata.lighthouseUrl}`);
    console.log(`   - Registered ${lighthousePlaybooks.length} Lighthouse playbook(s)`);
    console.log(`   - Loaded ${rules.length} rule(s) from playbook`);
    console.log();
    console.log("🎯 Next Steps:");
    console.log(`   1. Share the CID with others: ${metadata.cid}`);
    console.log(`   2. They can register it: await registry.registerFromLighthouse("${metadata.cid}")`);
    console.log(`   3. Or use CLI: npx hardhat superaudit --register-from-lighthouse ${metadata.cid}`);
    console.log();

  } catch (error) {
    console.error("❌ Error during demo:", error);
    throw error;
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Demo failed:", error);
    process.exit(1);
  });
}

export { main as runLighthouseDemo };
