#!/usr/bin/env node
/**
 * Lighthouse Playbook Upload Demo
 * 
 * This script demonstrates uploading a playbook to Lighthouse/IPFS
 * and then loading it back for analysis.
 */

import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  initializeRegistry,
  getPlaybookRegistry,
  initializeLighthouseFromEnv,
  getSamplePlaybooks,
} from "../plugin/src/playbooks/index.js";

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, ".env") });

async function main() {
  console.log("🚀 Lighthouse Playbook Upload Demo\n");

  // Initialize
  const lighthouse = initializeLighthouseFromEnv();
  if (!lighthouse) {
    console.error("❌ Lighthouse not initialized. Set LIGHTHOUSE_API_KEY in .env file.");
    process.exit(1);
  }
  console.log("✅ Lighthouse initialized\n");

  const builtins = getSamplePlaybooks();
  await initializeRegistry(builtins);
  const registry = getPlaybookRegistry();

  // Upload a playbook
  const playbookPath = join(__dirname, "playbooks/erc20-token-security.yaml");
  console.log(`📤 Uploading playbook: ${playbookPath}\n`);

  const progressCallback = (progressData) => {
    const percentage = 100 - ((progressData?.total / progressData?.uploaded) * 100 || 0);
    process.stdout.write(`\r   Progress: ${percentage.toFixed(2)}%`);
  };

  try {
    const registered = await registry.uploadAndRegisterToLighthouse(
      playbookPath,
      undefined,
      progressCallback
    );

    console.log(`\n\n✅ Upload successful!`);
    console.log(`   ID: ${registered.id}`);
    console.log(`   Name: ${registered.meta.name}`);
    console.log(`   CID: ${registered.source.cid}`);
    console.log(`   URL: ${registered.source.location}`);
    console.log(`\n📋 To use this playbook in analysis:`);
    console.log(`   npx hardhat superaudit --playbook-cid ${registered.source.cid}`);
    console.log(`   or`);
    console.log(`   npx hardhat superaudit --playbook-id ${registered.id}`);

  } catch (error) {
    console.error(`\n\n❌ Upload failed:`, error.message);
    process.exit(1);
  }
}

main().catch(console.error);
