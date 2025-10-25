/**
 * Playbook Registry Module
 *
 * Centralized registry for managing, discovering, and validating audit playbooks.
 * Provides functionality to:
 * - Register playbooks from various sources (file, string, remote)
 * - Search and filter playbooks by tags, author, version
 * - Validate playbook integrity and compatibility
 * - Cache parsed playbooks for performance
 * - Track playbook metadata and usage statistics
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join, basename, extname } from "path";
import { PlaybookParser } from "./parser.js";
import {
  getLighthouse,
  isLighthouseInitialized,
  type LighthousePlaybookMetadata,
} from "./lighthouse-storage.js";
import type { Playbook, ParsedPlaybook, PlaybookMeta } from "./types.js";

/**
 * Represents a registered playbook entry with metadata
 */
export interface RegisteredPlaybook {
  id: string; // Unique identifier for the playbook
  source: PlaybookSource; // Where the playbook came from
  meta: PlaybookMeta; // Playbook metadata
  parsedPlaybook?: ParsedPlaybook; // Cached parsed playbook
  registeredAt: Date; // When it was registered
  lastUsed?: Date; // Last time it was used
  usageCount: number; // How many times it's been used
  validated: boolean; // Whether it passed validation
  validationErrors?: string[]; // Any validation errors
}

/**
 * Source information for a playbook
 */
export interface PlaybookSource {
  type: "file" | "string" | "remote" | "builtin" | "lighthouse";
  location: string; // File path, URL, CID, or identifier
  hash?: string; // Content hash for integrity checking
  cid?: string; // IPFS CID for Lighthouse-stored playbooks
}

/**
 * Search criteria for finding playbooks
 */
export interface PlaybookSearchCriteria {
  tags?: string[]; // Filter by tags
  author?: string; // Filter by author
  name?: string; // Filter by name (partial match)
  minVersion?: string; // Minimum version
  severity?: string[]; // Filter by checks with specific severity
  aiEnabled?: boolean; // Filter by AI enablement
}

/**
 * Statistics about playbook usage
 */
export interface PlaybookStats {
  totalPlaybooks: number;
  bySource: Record<string, number>;
  byAuthor: Record<string, number>;
  byTags: Record<string, number>;
  mostUsed: RegisteredPlaybook[];
  recentlyAdded: RegisteredPlaybook[];
}

/**
 * Playbook Registry Class
 *
 * Singleton registry for managing all playbooks in the system
 */
export class PlaybookRegistry {
  private static instance: PlaybookRegistry;
  private playbooks: Map<string, RegisteredPlaybook>;
  private tagIndex: Map<string, Set<string>>; // tag -> playbook IDs
  private authorIndex: Map<string, Set<string>>; // author -> playbook IDs

  private constructor() {
    this.playbooks = new Map();
    this.tagIndex = new Map();
    this.authorIndex = new Map();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): PlaybookRegistry {
    if (!PlaybookRegistry.instance) {
      PlaybookRegistry.instance = new PlaybookRegistry();
    }
    return PlaybookRegistry.instance;
  }

  /**
   * Get the lighthouse storage instance
   */
  async getLighthouseStorage(): Promise<any> {
    // Import the lighthouse functions dynamically
    const { getLighthouse } = await import("./lighthouse-storage.js");
    return getLighthouse();
  }

  /**
   * Check if content is encrypted by looking for non-printable characters
   */
  private isEncryptedContent(content: string): boolean {
    // Check if content contains non-printable characters or binary data
    const nonPrintableRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/;

    // If content is very short or contains binary characters, it's likely encrypted
    if (content.length < 50 || nonPrintableRegex.test(content)) {
      return true;
    }

    // Check if it looks like YAML (starts with common YAML patterns)
    const yamlStartPatterns = [
      /^name:\s*/,
      /^version:\s*/,
      /^author:\s*/,
      /^description:\s*/,
      /^rules:\s*/,
      /^meta:\s*/,
      /^---/,
      /^\s*#/,
    ];

    const looksLikeYaml = yamlStartPatterns.some((pattern) =>
      pattern.test(content.trim()),
    );

    // If it doesn't look like YAML and has binary characters, it's encrypted
    return !looksLikeYaml && nonPrintableRegex.test(content);
  }

  /**
   * Register a playbook from a file
   */
  async registerFromFile(
    filePath: string,
    id?: string,
  ): Promise<RegisteredPlaybook> {
    if (!existsSync(filePath)) {
      throw new Error(`Playbook file not found: ${filePath}`);
    }

    try {
      const parsedPlaybook = PlaybookParser.parseFromFile(filePath);
      const playbookId = id || this.generateIdFromPath(filePath);

      const registered: RegisteredPlaybook = {
        id: playbookId,
        source: {
          type: "file",
          location: filePath,
        },
        meta: parsedPlaybook.meta,
        parsedPlaybook,
        registeredAt: new Date(),
        usageCount: 0,
        validated: true,
      };

      this.addToRegistry(registered);
      return registered;
    } catch (error) {
      const registered: RegisteredPlaybook = {
        id: id || this.generateIdFromPath(filePath),
        source: {
          type: "file",
          location: filePath,
        },
        meta: {
          name: basename(filePath),
          author: "unknown",
        },
        registeredAt: new Date(),
        usageCount: 0,
        validated: false,
        validationErrors: [
          error instanceof Error ? error.message : String(error),
        ],
      };

      this.addToRegistry(registered);
      return registered;
    }
  }

  /**
   * Register a playbook from YAML string
   */
  async registerFromString(
    yamlContent: string,
    id: string,
    location: string = "inline",
  ): Promise<RegisteredPlaybook> {
    try {
      const parsedPlaybook = PlaybookParser.parseFromString(yamlContent);

      const registered: RegisteredPlaybook = {
        id,
        source: {
          type: "string",
          location,
        },
        meta: parsedPlaybook.meta,
        parsedPlaybook,
        registeredAt: new Date(),
        usageCount: 0,
        validated: true,
      };

      this.addToRegistry(registered);
      return registered;
    } catch (error) {
      const registered: RegisteredPlaybook = {
        id,
        source: {
          type: "string",
          location,
        },
        meta: {
          name: id,
          author: "unknown",
        },
        registeredAt: new Date(),
        usageCount: 0,
        validated: false,
        validationErrors: [
          error instanceof Error ? error.message : String(error),
        ],
      };

      this.addToRegistry(registered);
      return registered;
    }
  }

  /**
   * Register all playbooks from a directory
   */
  async registerFromDirectory(
    dirPath: string,
    recursive: boolean = false,
  ): Promise<RegisteredPlaybook[]> {
    if (!existsSync(dirPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const registered: RegisteredPlaybook[] = [];
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory() && recursive) {
        const subResults = await this.registerFromDirectory(
          fullPath,
          recursive,
        );
        registered.push(...subResults);
      } else if (stat.isFile() && this.isPlaybookFile(entry)) {
        try {
          const playbook = await this.registerFromFile(fullPath);
          registered.push(playbook);
        } catch (error) {
          console.warn(`Failed to register playbook ${fullPath}:`, error);
        }
      }
    }

    return registered;
  }

  /**
   * Register a built-in playbook
   */
  async registerBuiltin(
    id: string,
    yamlContent: string,
    meta?: Partial<PlaybookMeta>,
  ): Promise<RegisteredPlaybook> {
    try {
      const parsedPlaybook = PlaybookParser.parseFromString(yamlContent);

      const registered: RegisteredPlaybook = {
        id,
        source: {
          type: "builtin",
          location: `builtin:${id}`,
        },
        meta: { ...parsedPlaybook.meta, ...meta },
        parsedPlaybook,
        registeredAt: new Date(),
        usageCount: 0,
        validated: true,
      };

      this.addToRegistry(registered);
      return registered;
    } catch (error) {
      throw new Error(`Failed to register builtin playbook ${id}: ${error}`);
    }
  }

  /**
   * Upload and register a playbook to Lighthouse (IPFS)
   */
  async uploadAndRegisterToLighthouse(
    filePath: string,
    id?: string,
    progressCallback?: (progress: any) => void,
  ): Promise<RegisteredPlaybook> {
    if (!isLighthouseInitialized()) {
      throw new Error(
        "Lighthouse not initialized. Set LIGHTHOUSE_API_KEY environment variable.",
      );
    }

    if (!existsSync(filePath)) {
      throw new Error(`Playbook file not found: ${filePath}`);
    }

    try {
      const lighthouse = getLighthouse();

      // Upload to Lighthouse
      const metadata = await lighthouse.uploadPlaybook(
        filePath,
        progressCallback,
      );

      // Parse the playbook
      const parsedPlaybook = PlaybookParser.parseFromFile(filePath);

      const playbookId = id || this.generateIdFromPath(filePath);

      const registered: RegisteredPlaybook = {
        id: playbookId,
        source: {
          type: "lighthouse",
          location: metadata.lighthouseUrl,
          cid: metadata.cid,
        },
        meta: {
          ...parsedPlaybook.meta,
          lighthouseResource: metadata.cid,
        },
        parsedPlaybook,
        registeredAt: new Date(),
        usageCount: 0,
        validated: true,
      };

      this.addToRegistry(registered);

      console.log(`✅ Playbook uploaded to Lighthouse and registered`);
      console.log(`   ID: ${playbookId}`);
      console.log(`   CID: ${metadata.cid}`);
      console.log(`   URL: ${metadata.lighthouseUrl}`);

      return registered;
    } catch (error) {
      throw new Error(`Failed to upload and register playbook: ${error}`);
    }
  }

  /**
   * Register a playbook from Lighthouse by CID
   */
  async registerFromLighthouse(
    cid: string,
    id?: string,
  ): Promise<RegisteredPlaybook> {
    if (!isLighthouseInitialized()) {
      throw new Error(
        "Lighthouse not initialized. Set LIGHTHOUSE_API_KEY environment variable.",
      );
    }

    try {
      const lighthouse = getLighthouse();

      // Download the playbook content from IPFS
      console.log(`📥 Fetching playbook from Lighthouse: ${cid}`);
      const yamlContent = await lighthouse.downloadPlaybook(cid);

      // Check if the content is encrypted (contains non-printable characters)
      const isEncrypted = this.isEncryptedContent(yamlContent);

      if (isEncrypted) {
        console.log(`🔐 Detected encrypted playbook: ${cid}`);
        console.log(
          `   This playbook requires decryption with the correct private key`,
        );
        console.log(`   Use the --decrypt-key option when running analysis`);

        // Create a special encrypted playbook entry
        const playbookId = id || `lighthouse-${cid.substring(0, 8)}`;
        const lighthouseUrl = lighthouse.getGatewayUrl(cid);

        const registered: RegisteredPlaybook = {
          id: playbookId,
          source: {
            type: "lighthouse",
            location: lighthouseUrl,
            cid,
          },
          meta: {
            name: `Encrypted Playbook (${cid.substring(0, 8)})`,
            author: "Unknown",
            description:
              "This playbook is encrypted and requires a private key for decryption",
            version: "1.0.0",
            tags: ["encrypted"],
            lighthouseResource: cid,
          },
          registeredAt: new Date(),
          usageCount: 0,
          validated: false,
          validationErrors: ["Encrypted playbook - requires decryption key"],
        };

        this.addToRegistry(registered);

        console.log(`✅ Encrypted playbook registered from Lighthouse`);
        console.log(`   ID: ${playbookId}`);
        console.log(`   CID: ${cid}`);
        console.log(`   Status: Encrypted (requires private key)`);

        return registered;
      }

      // Parse the playbook (only if not encrypted)
      const parsedPlaybook = PlaybookParser.parseFromString(yamlContent);

      const playbookId = id || `lighthouse-${cid.substring(0, 8)}`;
      const lighthouseUrl = lighthouse.getGatewayUrl(cid);

      const registered: RegisteredPlaybook = {
        id: playbookId,
        source: {
          type: "lighthouse",
          location: lighthouseUrl,
          cid,
        },
        meta: {
          ...parsedPlaybook.meta,
          lighthouseResource: cid,
        },
        parsedPlaybook,
        registeredAt: new Date(),
        usageCount: 0,
        validated: true,
      };

      this.addToRegistry(registered);

      console.log(`✅ Playbook registered from Lighthouse`);
      console.log(`   ID: ${playbookId}`);
      console.log(`   CID: ${cid}`);

      return registered;
    } catch (error) {
      const registered: RegisteredPlaybook = {
        id: id || `lighthouse-${cid.substring(0, 8)}`,
        source: {
          type: "lighthouse",
          location: `ipfs://${cid}`,
          cid,
        },
        meta: {
          name: `Lighthouse Playbook (${cid.substring(0, 8)})`,
          author: "unknown",
          lighthouseResource: cid,
        },
        registeredAt: new Date(),
        usageCount: 0,
        validated: false,
        validationErrors: [
          error instanceof Error ? error.message : String(error),
        ],
      };

      this.addToRegistry(registered);
      return registered;
    }
  }

  /**
   * Sync and register playbooks from Lighthouse uploads
   */
  async syncFromLighthouse(): Promise<RegisteredPlaybook[]> {
    if (!isLighthouseInitialized()) {
      console.warn("⚠️  Lighthouse not initialized, skipping sync");
      return [];
    }

    try {
      const lighthouse = getLighthouse();
      console.log("🔄 Syncing playbooks from Lighthouse...");

      const uploads = await lighthouse.listUploads();
      const registered: RegisteredPlaybook[] = [];

      for (const upload of uploads) {
        try {
          // Check if already registered
          const existing = Array.from(this.playbooks.values()).find(
            (pb) => pb.source.cid === upload.cid,
          );

          if (existing) {
            console.log(
              `   ⏭️  Already registered: ${upload.name} (${upload.cid.substring(0, 8)})`,
            );
            continue;
          }

          // Register from CID
          const id = this.generateIdFromName(upload.name);
          const playbook = await this.registerFromLighthouse(upload.cid, id);
          registered.push(playbook);

          console.log(`   ✅ Synced: ${upload.name}`);
        } catch (error) {
          console.warn(`   ⚠️  Failed to sync ${upload.name}:`, error);
        }
      }

      console.log(`✅ Synced ${registered.length} playbook(s) from Lighthouse`);
      return registered;
    } catch (error) {
      console.error("Failed to sync from Lighthouse:", error);
      return [];
    }
  }

  /**
   * Get a registered playbook by ID
   */
  get(id: string): RegisteredPlaybook | undefined {
    return this.playbooks.get(id);
  }

  /**
   * Get a playbook and mark it as used
   */
  getAndUse(id: string): RegisteredPlaybook | undefined {
    const playbook = this.playbooks.get(id);
    if (playbook) {
      playbook.usageCount++;
      playbook.lastUsed = new Date();
    }
    return playbook;
  }

  /**
   * Check if a playbook is registered
   */
  has(id: string): boolean {
    return this.playbooks.has(id);
  }

  /**
   * Unregister a playbook
   */
  unregister(id: string): boolean {
    const playbook = this.playbooks.get(id);
    if (!playbook) {
      return false;
    }

    // Remove from tag index
    if (playbook.meta.tags) {
      for (const tag of playbook.meta.tags) {
        const tagSet = this.tagIndex.get(tag);
        if (tagSet) {
          tagSet.delete(id);
          if (tagSet.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      }
    }

    // Remove from author index
    const authorSet = this.authorIndex.get(playbook.meta.author);
    if (authorSet) {
      authorSet.delete(id);
      if (authorSet.size === 0) {
        this.authorIndex.delete(playbook.meta.author);
      }
    }

    return this.playbooks.delete(id);
  }

  /**
   * Get all registered playbooks
   */
  getAll(): RegisteredPlaybook[] {
    return Array.from(this.playbooks.values());
  }

  /**
   * Search for playbooks matching criteria
   */
  search(criteria: PlaybookSearchCriteria): RegisteredPlaybook[] {
    let results = this.getAll();

    // Filter by tags
    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter(
        (pb) =>
          pb.meta.tags &&
          criteria.tags!.some((tag) => pb.meta.tags!.includes(tag)),
      );
    }

    // Filter by author
    if (criteria.author) {
      results = results.filter((pb) =>
        pb.meta.author.toLowerCase().includes(criteria.author!.toLowerCase()),
      );
    }

    // Filter by name
    if (criteria.name) {
      results = results.filter((pb) =>
        pb.meta.name.toLowerCase().includes(criteria.name!.toLowerCase()),
      );
    }

    // Filter by AI enabled
    if (criteria.aiEnabled !== undefined) {
      results = results.filter(
        (pb) => pb.meta.ai?.enabled === criteria.aiEnabled,
      );
    }

    // Filter by severity (checks if playbook has checks with the severity)
    if (criteria.severity && criteria.severity.length > 0) {
      results = results.filter((pb) => {
        if (!pb.parsedPlaybook) return false;
        return pb.parsedPlaybook.staticRules.some((rule) =>
          criteria.severity!.includes(rule.severity),
        );
      });
    }

    return results;
  }

  /**
   * Get playbooks by tag
   */
  getByTag(tag: string): RegisteredPlaybook[] {
    const ids = this.tagIndex.get(tag);
    if (!ids) return [];

    return Array.from(ids)
      .map((id) => this.playbooks.get(id))
      .filter((pb): pb is RegisteredPlaybook => pb !== undefined);
  }

  /**
   * Get playbooks by author
   */
  getByAuthor(author: string): RegisteredPlaybook[] {
    const ids = this.authorIndex.get(author);
    if (!ids) return [];

    return Array.from(ids)
      .map((id) => this.playbooks.get(id))
      .filter((pb): pb is RegisteredPlaybook => pb !== undefined);
  }

  /**
   * Get all unique tags
   */
  getAllTags(): string[] {
    return Array.from(this.tagIndex.keys()).sort();
  }

  /**
   * Get all unique authors
   */
  getAllAuthors(): string[] {
    return Array.from(this.authorIndex.keys()).sort();
  }

  /**
   * Get registry statistics
   */
  getStats(): PlaybookStats {
    const playbooks = this.getAll();

    const bySource: Record<string, number> = {};
    const byAuthor: Record<string, number> = {};
    const byTags: Record<string, number> = {};

    for (const pb of playbooks) {
      // Count by source
      bySource[pb.source.type] = (bySource[pb.source.type] || 0) + 1;

      // Count by author
      byAuthor[pb.meta.author] = (byAuthor[pb.meta.author] || 0) + 1;

      // Count by tags
      if (pb.meta.tags) {
        for (const tag of pb.meta.tags) {
          byTags[tag] = (byTags[tag] || 0) + 1;
        }
      }
    }

    // Most used (top 10)
    const mostUsed = playbooks
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);

    // Recently added (top 10)
    const recentlyAdded = playbooks
      .sort((a, b) => b.registeredAt.getTime() - a.registeredAt.getTime())
      .slice(0, 10);

    return {
      totalPlaybooks: playbooks.length,
      bySource,
      byAuthor,
      byTags,
      mostUsed,
      recentlyAdded,
    };
  }

  /**
   * Validate a playbook
   */
  validate(id: string): { valid: boolean; errors: string[] } {
    const playbook = this.playbooks.get(id);
    if (!playbook) {
      return { valid: false, errors: ["Playbook not found"] };
    }

    if (!playbook.validated) {
      return {
        valid: false,
        errors: playbook.validationErrors || ["Unknown validation error"],
      };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Clear all registered playbooks
   */
  clear(): void {
    this.playbooks.clear();
    this.tagIndex.clear();
    this.authorIndex.clear();
  }

  /**
   * Export registry state (for persistence)
   */
  export(): any {
    return {
      playbooks: Array.from(this.playbooks.entries()),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import registry state (for loading)
   */
  import(data: any): void {
    this.clear();

    if (data.playbooks && Array.isArray(data.playbooks)) {
      for (const [id, playbook] of data.playbooks) {
        // Convert date strings back to Date objects
        const registered = {
          ...playbook,
          registeredAt: new Date(playbook.registeredAt),
          lastUsed: playbook.lastUsed ? new Date(playbook.lastUsed) : undefined,
        };
        this.addToRegistry(registered);
      }
    }
  }

  // Private helper methods

  private addToRegistry(playbook: RegisteredPlaybook): void {
    this.playbooks.set(playbook.id, playbook);

    // Add to tag index
    if (playbook.meta.tags) {
      for (const tag of playbook.meta.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(playbook.id);
      }
    }

    // Add to author index
    if (!this.authorIndex.has(playbook.meta.author)) {
      this.authorIndex.set(playbook.meta.author, new Set());
    }
    this.authorIndex.get(playbook.meta.author)!.add(playbook.id);
  }

  private generateIdFromPath(filePath: string): string {
    const name = basename(filePath, extname(filePath));
    return name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  }

  private generateIdFromName(filename: string): string {
    const name = basename(filename, extname(filename));
    return name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  }

  private isPlaybookFile(filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    return ext === ".yaml" || ext === ".yml";
  }
}

/**
 * Convenience function to get the singleton registry instance
 */
export function getPlaybookRegistry(): PlaybookRegistry {
  return PlaybookRegistry.getInstance();
}

/**
 * Initialize registry with default/builtin playbooks
 */
export async function initializeRegistry(
  builtinPlaybooks?: Record<string, string>,
): Promise<void> {
  const registry = getPlaybookRegistry();

  if (builtinPlaybooks) {
    for (const [id, content] of Object.entries(builtinPlaybooks)) {
      try {
        await registry.registerBuiltin(id, content);
      } catch (error) {
        console.warn(`Failed to register builtin playbook ${id}:`, error);
      }
    }
  }
}
