/**
 * Lighthouse Storage Integration for Playbook Registry
 *
 * This module provides integration with Lighthouse (IPFS) storage for:
 * - Uploading playbook YAML files to IPFS
 * - Retrieving playbooks from IPFS by CID
 * - Listing uploaded playbooks
 * - Managing decentralized playbook storage
 *
 * NOTE: Uses a default shared Lighthouse API key for the SuperAudit community.
 * Users can optionally provide their own API key via LIGHTHOUSE_API_KEY env var.
 */

import lighthouse from "@lighthouse-web3/sdk";
import kavach from "@lighthouse-web3/kavach";
import { ethers } from "ethers";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import axios from "axios";
import type { PlaybookMeta } from "./types.js";

// Default shared Lighthouse API key for the SuperAudit community
// This allows users to upload/download playbooks without needing their own API key
const DEFAULT_LIGHTHOUSE_API_KEY = "7845931a.9b7fbfc7989847c7ba6d4bac4c21b162";

/**
 * Configuration for Lighthouse storage
 */
export interface LighthouseConfig {
  apiKey: string;
  gatewayUrl?: string;
}

/**
 * Response from Lighthouse upload
 */
export interface LighthouseUploadResponse {
  data: {
    Name: string;
    Hash: string; // CID (IPFS hash)
    Size: string;
  };
}

/**
 * Metadata for a playbook stored on Lighthouse
 */
export interface LighthousePlaybookMetadata {
  cid: string; // IPFS CID
  name: string;
  author: string;
  description?: string;
  tags?: string[];
  version?: string;
  uploadedAt: string;
  size: number;
  lighthouseUrl: string;
  encrypted?: boolean; // Whether the file is encrypted
  publicKey?: string; // Public key used for encryption
}

/**
 * Lighthouse Storage Manager for Playbooks
 */
export class LighthouseStorageManager {
  private apiKey: string;
  private gatewayUrl: string;
  private cacheDir: string;

  constructor(config: LighthouseConfig) {
    if (!config.apiKey) {
      throw new Error("Lighthouse API key is required");
    }
    this.apiKey = config.apiKey;
    this.gatewayUrl =
      config.gatewayUrl || "https://gateway.lighthouse.storage/ipfs";

    // Setup cache directory
    this.cacheDir = join(tmpdir(), ".superaudit-lighthouse-cache");
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Upload a playbook YAML file to Lighthouse/IPFS
   */
  async uploadPlaybook(
    filePath: string,
    progressCallback?: (progress: any) => void,
  ): Promise<LighthousePlaybookMetadata> {
    try {
      if (!existsSync(filePath)) {
        throw new Error(`Playbook file not found: ${filePath}`);
      }

      console.log(`📤 Uploading playbook to Lighthouse: ${filePath}`);

      // Upload to Lighthouse
      // SDK signature: upload(path, apiKey, dealParameters?, progressCallback?)
      const uploadResponse = (await lighthouse.upload(
        filePath,
        this.apiKey,
        undefined, // dealParameters
        progressCallback,
      )) as LighthouseUploadResponse;

      const cid = uploadResponse.data.Hash;
      const size = parseInt(uploadResponse.data.Size);
      const lighthouseUrl = `${this.gatewayUrl}/${cid}`;

      console.log(`✅ Uploaded to IPFS: ${cid}`);
      console.log(`   Gateway URL: ${lighthouseUrl}`);

      // Parse the playbook to extract metadata
      const content = readFileSync(filePath, "utf8");
      const metadata = this.extractMetadataFromYaml(content);

      return {
        cid,
        name: metadata.name || uploadResponse.data.Name,
        author: metadata.author || "Unknown",
        description: metadata.description,
        tags: metadata.tags,
        version: metadata.version,
        uploadedAt: new Date().toISOString(),
        size,
        lighthouseUrl,
      };
    } catch (error) {
      console.error("Failed to upload playbook to Lighthouse:", error);
      throw new Error(`Lighthouse upload failed: ${error}`);
    }
  }

  /**
   * Sign authentication message for encrypted uploads
   */
  private async signAuthMessage(privateKey: string): Promise<string> {
    const signer = new ethers.Wallet(privateKey);
    const authMessage = await kavach.getAuthMessage(signer.address);
    const signedMessage = await signer.signMessage(authMessage.message || "");
    const { JWT, error } = await kavach.getJWT(signer.address, signedMessage);

    if (error) {
      throw new Error(`Failed to get JWT: ${error}`);
    }

    return JWT;
  }

  /**
   * Sign authentication message for decryption (using Lighthouse API directly)
   */
  private async signAuthMessageForDecrypt(
    publicKey: string,
    privateKey: string,
  ): Promise<string> {
    const provider = new ethers.JsonRpcProvider();
    const signer = new ethers.Wallet(privateKey, provider);
    const messageRequested = (await lighthouse.getAuthMessage(publicKey)).data
      .message;
    const signedMessage = await signer.signMessage(messageRequested || "");
    return signedMessage;
  }

  /**
   * Upload a playbook YAML file to Lighthouse/IPFS with encryption
   */
  async uploadPlaybookEncrypted(
    filePath: string,
    publicKey: string,
    privateKey: string,
    progressCallback?: (progress: any) => void,
  ): Promise<LighthousePlaybookMetadata> {
    try {
      if (!existsSync(filePath)) {
        throw new Error(`Playbook file not found: ${filePath}`);
      }

      console.log(`🔐 Uploading encrypted playbook to Lighthouse: ${filePath}`);

      // Get signed message for authentication
      const signedMessage = await this.signAuthMessage(privateKey);

      // Upload to Lighthouse with encryption
      const uploadResponse = await lighthouse.uploadEncrypted(
        filePath,
        this.apiKey,
        publicKey,
        signedMessage,
      );

      const cid = uploadResponse.data[0].Hash;
      const size = parseInt(uploadResponse.data[0].Size);
      const lighthouseUrl = `${this.gatewayUrl}/${cid}`;

      console.log(`✅ Uploaded encrypted file to IPFS: ${cid}`);
      console.log(`   Gateway URL: ${lighthouseUrl}`);

      // Parse the playbook to extract metadata
      const content = readFileSync(filePath, "utf8");
      const metadata = this.extractMetadataFromYaml(content);

      return {
        cid,
        name: metadata.name || uploadResponse.data[0].Name,
        author: metadata.author || "Unknown",
        description: metadata.description,
        tags: metadata.tags,
        version: metadata.version,
        uploadedAt: new Date().toISOString(),
        size,
        lighthouseUrl,
        encrypted: true,
        publicKey,
      };
    } catch (error) {
      console.error(
        "Failed to upload encrypted playbook to Lighthouse:",
        error,
      );
      throw new Error(`Lighthouse encrypted upload failed: ${error}`);
    }
  }

  /**
   * Share an encrypted file with another user (using platform's keys)
   */
  async shareEncryptedFile(cid: string, userPublicKey: string): Promise<any> {
    try {
      console.log(`🔐 Sharing encrypted file with user...`);
      console.log(`   CID: ${cid}`);
      console.log(`   User: ${userPublicKey.substring(0, 10)}...`);

      // Use platform's private key (from environment or default)
      const platformPrivateKey =
        process.env.PLATFORM_PRIVATE_KEY ||
        "6b3ddd5a7dd39a5066cfcd6a05fbb932d6642e149c6259cd1033acadef46ab3b";
      const platformPublicKey =
        process.env.PLATFORM_PUBLIC_KEY ||
        "0xad484485127b501b63274ed34b594c8fc3f22504";

      // Get signed message for authentication
      const signedMessage = await this.signAuthMessage(platformPrivateKey);

      // Share the file using Lighthouse API
      const shareResponse = await lighthouse.shareFile(
        platformPublicKey,
        [userPublicKey],
        cid,
        signedMessage,
      );

      console.log(`✅ File shared successfully`);
      console.log(`   Shared to: ${userPublicKey}`);
      console.log(`   Status: ${shareResponse.data.status}`);

      return shareResponse;
    } catch (error) {
      console.error("Failed to share encrypted file:", error);
      throw new Error(`File sharing failed: ${error}`);
    }
  }

  /**
   * Download and decrypt an encrypted playbook
   */
  async downloadEncryptedPlaybook(
    cid: string,
    userPublicKey: string,
    userPrivateKey: string,
  ): Promise<string> {
    try {
      console.log(`🔓 Downloading and decrypting encrypted playbook...`);
      console.log(`   CID: ${cid}`);
      console.log(`   User: ${userPublicKey.substring(0, 10)}...`);

      // Get signed message for authentication
      const signedMessage = await this.signAuthMessageForDecrypt(
        userPublicKey,
        userPrivateKey,
      );

      // Get file encryption key
      const fileEncryptionKey = await lighthouse.fetchEncryptionKey(
        cid,
        userPublicKey,
        signedMessage,
      );

      // Decrypt the file using the encryption key
      const decryptedContent = await lighthouse.decryptFile(
        cid,
        fileEncryptionKey.data.key || "",
      );

      console.log(`✅ Playbook decrypted successfully`);
      // Convert Buffer/Uint8Array/ArrayBuffer to string if needed
      let contentString: string;
      if (Buffer.isBuffer(decryptedContent)) {
        contentString = decryptedContent.toString("utf8");
      } else if (decryptedContent instanceof Uint8Array) {
        contentString = Buffer.from(decryptedContent).toString("utf8");
      } else if (decryptedContent instanceof ArrayBuffer) {
        contentString = Buffer.from(decryptedContent).toString("utf8");
      } else if (typeof decryptedContent === "string") {
        contentString = decryptedContent;
      } else {
        // Try to convert to string
        contentString = String(decryptedContent);
      }

      // Debug: Log first 200 characters of decrypted content
      console.log(
        `📄 Decrypted content preview: ${contentString.substring(0, 200)}...`,
      );

      return contentString;
    } catch (error) {
      console.error("Failed to decrypt playbook:", error);
      throw new Error(`Playbook decryption failed: ${error}`);
    }
  }

  /**
   * Upload a playbook from YAML string content
   */
  async uploadPlaybookFromString(
    yamlContent: string,
    filename: string,
    progressCallback?: (progress: any) => void,
  ): Promise<LighthousePlaybookMetadata> {
    try {
      // Write to temporary file
      const tempFilePath = join(this.cacheDir, filename);
      writeFileSync(tempFilePath, yamlContent, "utf8");

      // Upload the temporary file
      const result = await this.uploadPlaybook(tempFilePath, progressCallback);

      return result;
    } catch (error) {
      throw new Error(`Failed to upload playbook string: ${error}`);
    }
  }

  /**
   * Download a playbook from Lighthouse/IPFS by CID
   */
  async downloadPlaybook(cid: string): Promise<string> {
    try {
      console.log(`📥 Downloading playbook from IPFS: ${cid}`);

      // Check cache first
      const cachedPath = join(this.cacheDir, `${cid}.yaml`);
      if (existsSync(cachedPath)) {
        console.log(`   ✓ Using cached version`);
        return readFileSync(cachedPath, "utf8");
      }

      // Download from gateway
      const url = `${this.gatewayUrl}/${cid}`;
      console.log(`   Fetching from: ${url}`);

      const response = await axios.get(url, {
        timeout: 30000, // 30 second timeout
        responseType: "text",
      });

      const yamlContent = response.data;

      // Cache the downloaded content
      writeFileSync(cachedPath, yamlContent, "utf8");
      console.log(`   ✓ Cached locally`);

      return yamlContent;
    } catch (error) {
      console.error("Failed to download playbook from Lighthouse:", error);
      throw new Error(`Failed to download from IPFS (${cid}): ${error}`);
    }
  }

  /**
   * Get playbook metadata from CID without downloading full content
   */
  async getPlaybookMetadata(
    cid: string,
  ): Promise<Partial<LighthousePlaybookMetadata>> {
    try {
      const content = await this.downloadPlaybook(cid);
      const metadata = this.extractMetadataFromYaml(content);

      return {
        cid,
        name: metadata.name,
        author: metadata.author,
        description: metadata.description,
        tags: metadata.tags,
        version: metadata.version,
        lighthouseUrl: `${this.gatewayUrl}/${cid}`,
      };
    } catch (error) {
      throw new Error(`Failed to get metadata for CID ${cid}: ${error}`);
    }
  }

  /**
   * Get uploads associated with the API key
   * Note: This requires the Lighthouse API endpoint to list user uploads
   */
  async listUploads(): Promise<LighthousePlaybookMetadata[]> {
    try {
      // Lighthouse API endpoint for listing uploads
      const response = await axios.get(
        `https://api.lighthouse.storage/api/user/files_uploaded`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      );

      const files = response.data.data || [];
      const playbooks: LighthousePlaybookMetadata[] = [];

      for (const file of files) {
        // Filter for YAML files only
        if (file.fileName.endsWith(".yaml") || file.fileName.endsWith(".yml")) {
          playbooks.push({
            cid: file.cid,
            name: file.fileName,
            author: "Unknown", // API doesn't provide author info
            uploadedAt: file.createdAt,
            size: parseInt(file.fileSizeInBytes),
            lighthouseUrl: `${this.gatewayUrl}/${file.cid}`,
          });
        }
      }

      return playbooks;
    } catch (error) {
      console.warn("Failed to list uploads from Lighthouse:", error);
      return [];
    }
  }

  /**
   * Check if a CID is accessible
   */
  async isCIDAccessible(cid: string): Promise<boolean> {
    try {
      const url = `${this.gatewayUrl}/${cid}`;
      const response = await axios.head(url, { timeout: 10000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the gateway URL for a CID
   */
  getGatewayUrl(cid: string): string {
    return `${this.gatewayUrl}/${cid}`;
  }

  /**
   * Clear the local cache
   */
  clearCache(): void {
    if (existsSync(this.cacheDir)) {
      const files = require("fs").readdirSync(this.cacheDir);
      for (const file of files) {
        require("fs").unlinkSync(join(this.cacheDir, file));
      }
      console.log("✓ Cache cleared");
    }
  }

  /**
   * Extract metadata from YAML content
   * Simple parser that looks for the meta section
   */
  private extractMetadataFromYaml(yamlContent: string): Partial<PlaybookMeta> {
    const metadata: Partial<PlaybookMeta> = {};

    try {
      // Simple regex-based extraction (for quick metadata without full parsing)
      const nameMatch = yamlContent.match(/name:\s*["']?([^"'\n]+)["']?/);
      const authorMatch = yamlContent.match(/author:\s*["']?([^"'\n]+)["']?/);
      const descriptionMatch = yamlContent.match(
        /description:\s*["']?([^"'\n]+)["']?/,
      );
      const versionMatch = yamlContent.match(/version:\s*["']?([^"'\n]+)["']?/);
      const tagsMatch = yamlContent.match(/tags:\s*\[(.*?)\]/s);

      if (nameMatch) metadata.name = nameMatch[1].trim();
      if (authorMatch) metadata.author = authorMatch[1].trim();
      if (descriptionMatch) metadata.description = descriptionMatch[1].trim();
      if (versionMatch) metadata.version = versionMatch[1].trim();

      if (tagsMatch) {
        metadata.tags = tagsMatch[1]
          .split(",")
          .map((tag) => tag.replace(/["']/g, "").trim())
          .filter((tag) => tag.length > 0);
      }
    } catch (error) {
      console.warn("Failed to extract metadata from YAML:", error);
    }

    return metadata;
  }
}

/**
 * Singleton instance of Lighthouse storage manager
 */
let lighthouseInstance: LighthouseStorageManager | null = null;

/**
 * Initialize the Lighthouse storage manager
 */
export function initializeLighthouse(apiKey: string): LighthouseStorageManager {
  if (!lighthouseInstance) {
    lighthouseInstance = new LighthouseStorageManager({ apiKey });
  }
  return lighthouseInstance;
}

/**
 * Get the Lighthouse storage manager instance
 */
export function getLighthouse(): LighthouseStorageManager {
  if (!lighthouseInstance) {
    throw new Error(
      "Lighthouse not initialized. Call initializeLighthouse(apiKey) first.",
    );
  }
  return lighthouseInstance;
}

/**
 * Check if Lighthouse is initialized
 */
export function isLighthouseInitialized(): boolean {
  return lighthouseInstance !== null;
}

/**
 * Initialize Lighthouse from environment variable or use default shared API key
 *
 * This function will:
 * 1. Check for user's own LIGHTHOUSE_API_KEY in environment
 * 2. Fall back to the default shared SuperAudit community API key
 *
 * This ensures users can upload/download playbooks without needing their own API key.
 */
export function initializeLighthouseFromEnv(): LighthouseStorageManager {
  // Check for user's own API key first
  const userApiKey = process.env.LIGHTHOUSE_API_KEY;

  if (userApiKey) {
    console.log("🔑 Using custom Lighthouse API key from environment");
    return initializeLighthouse(userApiKey);
  }

  // Use default shared API key for the community
  console.log("🌐 Using shared SuperAudit community Lighthouse storage");
  return initializeLighthouse(DEFAULT_LIGHTHOUSE_API_KEY);
}
