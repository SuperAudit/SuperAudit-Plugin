import { ethers } from "ethers";
import * as crypto from "crypto";

export interface PaymentConfig {
  creatorPublicKey: string;
  paymentAmount: string; // in ETH
  contractAddress?: string; // Optional smart contract for payment verification
  network: string;
}

export interface UserPayment {
  userPublicKey: string;
  userPrivateKey: string;
  paymentTxHash: string;
  paymentAmount: string;
  timestamp: Date;
  verified: boolean;
}

export interface EncryptedUserList {
  users: UserPayment[];
  encrypted: boolean;
  lastUpdated: Date;
  playbookCid: string;
}

export class PaymentManager {
  private provider: ethers.Provider;
  private paymentConfig: PaymentConfig;

  constructor(paymentConfig: PaymentConfig) {
    this.paymentConfig = paymentConfig;
    this.provider = new ethers.JsonRpcProvider(paymentConfig.network);
  }

  /**
   * Prompt user for their private and public keys (for Lighthouse decryption)
   */
  async promptUserKeys(): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    const { createInterface } = await import("readline");
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("🔐 Please provide your wallet keys for access:");
    console.log("   This will be used to decrypt files from Lighthouse\n");

    const publicKey = await new Promise<string>((resolve) => {
      rl.question("   Enter your public key (0x...): ", (answer: string) => {
        resolve(answer.trim());
      });
    });

    const privateKey = await new Promise<string>((resolve) => {
      rl.question("   Enter your private key (0x...): ", (answer: string) => {
        rl.close();
        resolve(answer.trim());
      });
    });

    if (!publicKey || !publicKey.startsWith("0x")) {
      throw new Error("Invalid public key format. Must start with 0x");
    }

    if (!privateKey || !privateKey.startsWith("0x")) {
      throw new Error("Invalid private key format. Must start with 0x");
    }

    // Validate that the private key corresponds to the public key
    try {
      const wallet = new ethers.Wallet(privateKey);
      if (wallet.address.toLowerCase() !== publicKey.toLowerCase()) {
        throw new Error("Private key does not match the provided public key");
      }
    } catch (error) {
      throw new Error(
        `Invalid key pair: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    console.log("✅ Keys validated successfully\n");
    return { publicKey, privateKey };
  }

  /**
   * Display payment information and prompt for payment method
   */
  async promptPayment(): Promise<string> {
    const { createInterface } = await import("readline");
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("💰 Payment Required for Access");
    console.log("================================");
    console.log(`   Amount: ${this.paymentConfig.paymentAmount} ETH`);
    console.log(`   Creator: ${this.paymentConfig.creatorPublicKey}`);
    console.log(`   Network: ${this.paymentConfig.network}\n`);

    const paymentMethod = await new Promise<string>((resolve) => {
      rl.question(
        "   Choose payment method (1=Auto, 2=Manual): ",
        (answer: string) => {
          resolve(answer.trim());
        },
      );
    });

    if (paymentMethod === "1") {
      // Automatic payment
      return await this.sendPaymentTransaction();
    } else if (paymentMethod === "2") {
      // Manual payment - ask for transaction hash
      const txHash = await new Promise<string>((resolve) => {
        rl.question(
          "   Enter the transaction hash after payment: ",
          (answer: string) => {
            rl.close();
            resolve(answer.trim());
          },
        );
      });

      if (!txHash || !txHash.startsWith("0x")) {
        throw new Error("Invalid transaction hash format. Must start with 0x");
      }

      return txHash;
    } else {
      throw new Error("Invalid choice. Please select 1 or 2");
    }
  }

  /**
   * Send payment transaction automatically
   */
  async sendPaymentTransaction(): Promise<string> {
    const { createInterface } = await import("readline");
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n🔐 Automatic Payment Setup");
    console.log("==========================");

    const paymentPrivateKey = await new Promise<string>((resolve) => {
      rl.question(
        "   Enter your payment private key (0x...): ",
        (answer: string) => {
          rl.close();
          resolve(answer.trim());
        },
      );
    });

    if (!paymentPrivateKey || !paymentPrivateKey.startsWith("0x")) {
      throw new Error("Invalid payment private key format. Must start with 0x");
    }

    try {
      console.log("📤 Sending payment transaction...");

      const wallet = new ethers.Wallet(paymentPrivateKey, this.provider);
      const tx = await wallet.sendTransaction({
        to: this.paymentConfig.creatorPublicKey,
        value: ethers.parseEther(this.paymentConfig.paymentAmount),
      });

      console.log(`⏳ Transaction sent: ${tx.hash}`);
      console.log("⏳ Waiting for confirmation...");

      const receipt = await tx.wait();

      if (receipt && receipt.status === 1) {
        console.log("✅ Payment transaction confirmed!");
        return tx.hash;
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error) {
      throw new Error(
        `Payment transaction failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Verify payment transaction
   */
  async verifyPayment(txHash: string, userPublicKey: string): Promise<boolean> {
    try {
      console.log("🔍 Verifying payment transaction...");

      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        throw new Error("Transaction not found");
      }

      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt || receipt.status !== 1) {
        throw new Error("Transaction failed or not confirmed");
      }

      // Check if payment is to the creator's address
      const creatorAddress = this.paymentConfig.creatorPublicKey.toLowerCase();
      const toAddress = tx.to?.toLowerCase();

      if (toAddress !== creatorAddress) {
        throw new Error(
          `Payment not sent to creator address. Expected: ${creatorAddress}, Got: ${toAddress}`,
        );
      }

      // Check payment amount
      const paymentAmount = ethers.formatEther(tx.value);
      const expectedAmount = this.paymentConfig.paymentAmount;

      if (
        Math.abs(parseFloat(paymentAmount) - parseFloat(expectedAmount)) > 0.001
      ) {
        throw new Error(
          `Incorrect payment amount. Expected: ${expectedAmount} ETH, Got: ${paymentAmount} ETH`,
        );
      }

      console.log("✅ Payment verified successfully");
      return true;
    } catch (error) {
      console.error(
        `❌ Payment verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Add user to encrypted access list
   */
  async addUserToAccessList(
    userPublicKey: string,
    userPrivateKey: string,
    paymentTxHash: string,
    encryptedUserList: EncryptedUserList,
  ): Promise<EncryptedUserList> {
    const userPayment: UserPayment = {
      userPublicKey,
      userPrivateKey,
      paymentTxHash,
      paymentAmount: this.paymentConfig.paymentAmount,
      timestamp: new Date(),
      verified: true,
    };

    // Add user to the list
    const updatedList: EncryptedUserList = {
      ...encryptedUserList,
      users: [...encryptedUserList.users, userPayment],
      lastUpdated: new Date(),
    };

    console.log(
      `✅ User ${userPublicKey.substring(0, 10)}... added to access list`,
    );
    return updatedList;
  }

  /**
   * Check if user has access
   */
  hasAccess(
    userPublicKey: string,
    encryptedUserList: EncryptedUserList,
  ): boolean {
    return encryptedUserList.users.some(
      (user) =>
        user.userPublicKey.toLowerCase() === userPublicKey.toLowerCase() &&
        user.verified,
    );
  }

  /**
   * Get user's private key for decryption
   */
  getUserPrivateKey(
    userPublicKey: string,
    encryptedUserList: EncryptedUserList,
  ): string | null {
    const user = encryptedUserList.users.find(
      (user) =>
        user.userPublicKey.toLowerCase() === userPublicKey.toLowerCase() &&
        user.verified,
    );
    return user ? user.userPrivateKey : null;
  }

  /**
   * Encrypt the user list
   */
  encryptUserList(userList: EncryptedUserList, encryptionKey: string): string {
    const jsonString = JSON.stringify(userList);
    const key = crypto.scryptSync(encryptionKey, "salt", 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(jsonString, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  /**
   * Decrypt the user list
   */
  decryptUserList(
    encryptedData: string,
    encryptionKey: string,
  ): EncryptedUserList {
    const [ivHex, encrypted] = encryptedData.split(":");
    const key = crypto.scryptSync(encryptionKey, "salt", 32);
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted);
  }
}
