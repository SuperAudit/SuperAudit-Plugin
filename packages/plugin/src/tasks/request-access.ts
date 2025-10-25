import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import {
  PaymentManager,
  type PaymentConfig,
  type EncryptedUserList,
} from "../payment/index.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import * as dotenv from "dotenv";

dotenv.config();

interface RequestAccessTaskArguments {
  playbookCid: string;
  creatorPublicKey: string;
  paymentAmount: string;
  rpcUrl: string;
  userListFile?: string;
}

export default async function requestAccessTask(
  taskArguments: RequestAccessTaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("🔐 Requesting Access to Encrypted Playbook\n");

  try {
    // Validate required arguments
    if (!taskArguments.playbookCid) {
      console.error("❌ Error: playbook CID is required\n");
      console.log("💡 Usage:");
      console.log(
        "   npx hardhat request-access --playbook-cid <cid> --creator-public-key <key> --payment-amount <amount> --network <network>\n",
      );
      process.exit(1);
    }

    if (!taskArguments.creatorPublicKey) {
      console.error("❌ Error: creator public key is required\n");
      process.exit(1);
    }

    if (!taskArguments.paymentAmount) {
      console.error("❌ Error: payment amount is required\n");
      process.exit(1);
    }

    if (!taskArguments.rpcUrl) {
      console.error("❌ Error: rpcUrl is required\n");
      process.exit(1);
    }

    // Set up payment configuration
    const paymentConfig: PaymentConfig = {
      creatorPublicKey: taskArguments.creatorPublicKey,
      paymentAmount: taskArguments.paymentAmount,
      network: taskArguments.rpcUrl,
    };

    const paymentManager = new PaymentManager(paymentConfig);

    // Prompt user for their keys
    const { publicKey: userPublicKey, privateKey: userPrivateKey } =
      await paymentManager.promptUserKeys();

    // Load or create encrypted user list
    const userListPath =
      taskArguments.userListFile ||
      `./encrypted-users-${taskArguments.playbookCid.substring(0, 8)}.json`;
    let encryptedUserList: EncryptedUserList;

    if (existsSync(userListPath)) {
      try {
        const encryptedData = readFileSync(userListPath, "utf8");
        // For simplicity, using a fixed encryption key - in production, this should be more secure
        const encryptionKey =
          process.env.ENCRYPTION_KEY || "default-encryption-key-32-chars";
        encryptedUserList = paymentManager.decryptUserList(
          encryptedData,
          encryptionKey,
        );
        console.log(
          `📋 Loaded existing user list with ${encryptedUserList.users.length} users`,
        );
      } catch (error) {
        console.log("📋 Creating new user list");
        encryptedUserList = {
          users: [],
          encrypted: true,
          lastUpdated: new Date(),
          playbookCid: taskArguments.playbookCid,
        };
      }
    } else {
      console.log("📋 Creating new user list");
      encryptedUserList = {
        users: [],
        encrypted: true,
        lastUpdated: new Date(),
        playbookCid: taskArguments.playbookCid,
      };
    }

    // Check if user already has access
    if (paymentManager.hasAccess(userPublicKey, encryptedUserList)) {
      console.log("✅ You already have access to this playbook!");
      console.log("🔓 You can now decrypt and use the playbook");
      return;
    }

    // Prompt for payment
    const paymentTxHash = await paymentManager.promptPayment();

    // Verify payment
    const paymentVerified = await paymentManager.verifyPayment(
      paymentTxHash,
      userPublicKey,
    );

    if (!paymentVerified) {
      console.error("❌ Payment verification failed. Access denied.");
      process.exit(1);
    }

    // Add user to access list
    const updatedUserList = await paymentManager.addUserToAccessList(
      userPublicKey,
      userPrivateKey,
      paymentTxHash,
      encryptedUserList,
    );

    // Save encrypted user list
    const encryptionKey =
      process.env.ENCRYPTION_KEY || "default-encryption-key-32-chars";
    const encryptedData = paymentManager.encryptUserList(
      updatedUserList,
      encryptionKey,
    );
    writeFileSync(userListPath, encryptedData);

    console.log("\n✅ Access granted successfully!");
    console.log(`📋 User list saved to: ${userListPath}`);
    console.log("🔓 You can now decrypt and use the playbook");
    console.log("\n💡 To use the playbook:");
    console.log(
      `   npx hardhat superaudit --playbook-cid ${taskArguments.playbookCid}`,
    );
  } catch (error) {
    console.error(
      `\n❌ Access request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
