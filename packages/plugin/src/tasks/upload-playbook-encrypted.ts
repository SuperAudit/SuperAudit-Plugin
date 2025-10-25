import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import {
  initializeRegistry,
  getPlaybookRegistry,
  initializeLighthouseFromEnv,
  getSamplePlaybooks,
} from "../playbooks/index.js";
import * as dotenv from "dotenv";

dotenv.config();

interface UploadPlaybookEncryptedTaskArguments {
  file: string;
  publicKey?: string;
  privateKey?: string;
  paymentAmount?: string;
  creatorPublicKey: string;
}

export default async function uploadPlaybookEncryptedTask(
  taskArguments: UploadPlaybookEncryptedTaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("🔐 Uploading Encrypted Playbook to Lighthouse\n");

  try {
    // Initialize
    initializeLighthouseFromEnv();
    const builtins = getSamplePlaybooks();
    await initializeRegistry(builtins);

    // Get file path from task arguments or environment variable
    let filePath = taskArguments.file || process.env.PLAYBOOK_FILE;

    if (!filePath) {
      console.error("❌ Error: playbook file path is required\n");
      console.log("💡 Usage:");
      console.log(
        "   npx hardhat upload-playbook-encrypted --file ./playbooks/my-playbook.yaml --creatorPublicKey 0x...\n",
      );
      console.log(
        "💡 Optional: --publicKey, --privateKey (uses platform keys by default)",
      );
      console.log("💡 Or with environment variable:");
      console.log(
        "   PLAYBOOK_FILE=./playbooks/my-playbook.yaml npx hardhat upload-playbook-encrypted --creatorPublicKey 0x...\n",
      );
      process.exit(1);
    }

    // Get platform keys for Lighthouse operations
    const platformPublicKey =
      taskArguments.publicKey || process.env.PLATFORM_PUBLIC_KEY;
    const platformPrivateKey =
      taskArguments.privateKey || process.env.PLATFORM_PRIVATE_KEY;

    if (!platformPublicKey) {
      console.error("❌ Error: platform public key is required\n");
      console.log(
        "💡 Set PLATFORM_PUBLIC_KEY environment variable or use --publicKey\n",
      );
      process.exit(1);
    }

    if (!platformPrivateKey) {
      console.error("❌ Error: platform private key is required\n");
      console.log(
        "💡 Set PLATFORM_PRIVATE_KEY environment variable or use --privateKey\n",
      );
      process.exit(1);
    }

    // Get creator's public key for payment
    const creatorPublicKey = taskArguments.creatorPublicKey;

    if (!creatorPublicKey) {
      console.error("❌ Error: creator public key is required for payment\n");
      console.log("💡 Usage: --creatorPublicKey 0x...\n");
      process.exit(1);
    }

    // Resolve to absolute path
    const absolutePath = resolve(process.cwd(), filePath);

    if (!existsSync(absolutePath)) {
      throw new Error(`Playbook file not found: ${absolutePath}`);
    }

    console.log(`📄 File: ${absolutePath}`);
    console.log(
      `🔑 Platform Public Key: ${platformPublicKey.substring(0, 10)}...`,
    );
    console.log(
      `🔐 Platform Private Key: ${platformPrivateKey.substring(0, 10)}...`,
    );
    console.log(
      `💰 Creator Public Key: ${creatorPublicKey.substring(0, 10)}...\n`,
    );

    const progressCallback = (progressData: any) => {
      const percentage =
        100 - ((progressData?.total / progressData?.uploaded) * 100 || 0);
      process.stdout.write(`\r   Progress: ${percentage.toFixed(2)}%`);
    };

    const registry = getPlaybookRegistry();
    const lighthouse = await registry.getLighthouseStorage();

    // Upload with encryption using platform keys
    const registered = await lighthouse.uploadPlaybookEncrypted(
      absolutePath,
      platformPublicKey,
      platformPrivateKey,
      progressCallback,
    );

    // Store creator payment info in mock JSON database
    const paymentAmount =
      taskArguments.paymentAmount || process.env.PAYMENT_AMOUNT || "0.01";

    const paymentInfo = {
      cid: registered.cid,
      creatorPublicKey: creatorPublicKey,
      paymentAmount: paymentAmount,
      platformPublicKey: platformPublicKey,
      uploadedAt: new Date().toISOString(),
    };

    // Save to mock JSON database
    const dbPath = "./playbook-payments.json";
    let paymentDatabase: Record<string, any> = {};
    if (existsSync(dbPath)) {
      try {
        paymentDatabase = JSON.parse(readFileSync(dbPath, "utf8"));
      } catch (error) {
        console.log("📋 Creating new payment database");
      }
    }

    paymentDatabase[registered.cid] = paymentInfo;
    writeFileSync(dbPath, JSON.stringify(paymentDatabase, null, 2));

    console.log(`\n\n✅ Encrypted playbook uploaded to Lighthouse!\n`);
    console.log(`📋 Details:`);
    console.log(`   ID: ${registered.name.toLowerCase().replace(/\s+/g, "-")}`);
    console.log(`   Name: ${registered.name}`);
    console.log(`   Author: ${registered.author}`);
    console.log(`   CID: ${registered.cid}`);
    console.log(`   URL: ${registered.lighthouseUrl}`);
    console.log(`   Encrypted: ${registered.encrypted ? "Yes" : "No"}`);
    console.log(`   Platform Public Key: ${registered.publicKey}\n`);

    console.log(`💰 Payment Configuration:`);
    console.log(`   Creator Public Key: ${creatorPublicKey}`);
    console.log(`   Payment Amount: ${paymentAmount} ETH\n`);

    console.log(`💡 Share this CID with others:`);
    console.log(`   ${registered.cid}\n`);
    console.log(
      `🔐 Users must pay ${paymentAmount} ETH to access this playbook`,
    );
    console.log(`🔗 To use this playbook:`);
    console.log(`   npx hardhat superaudit --playbook-cid ${registered.cid}`);
    console.log(
      `   (Users will be prompted for payment when they run this command)`,
    );
    console.log(`\n📄 Payment info saved to: ${dbPath}`);
  } catch (error) {
    console.error(
      `\n❌ Encrypted upload failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
