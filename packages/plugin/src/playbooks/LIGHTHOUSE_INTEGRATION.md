# Lighthouse Storage Integration Guide

## Overview

The Playbook Registry now supports decentralized storage using **Lighthouse** (IPFS). This allows you to:
- ✅ Upload playbooks to IPFS for permanent, decentralized storage
- ✅ Share playbooks via IPFS CID
- ✅ Retrieve playbooks from IPFS
- ✅ Sync playbooks from your Lighthouse account
- ✅ Build a decentralized playbook marketplace

## Setup

### 1. Get Lighthouse API Key

Visit [Lighthouse Files Dapp](https://files.lighthouse.storage/) to create an API key.

### 2. Set Environment Variable

Add your API key to `.env`:

```bash
LIGHTHOUSE_API_KEY=your_api_key_here
```

### 3. Initialize

The registry will automatically initialize Lighthouse if the API key is present:

```typescript
import { initializePlaybookRegistry } from "./playbooks/index.js";

// This will initialize both registry and Lighthouse
await initializePlaybookRegistry();
```

## Usage

### Upload a Playbook to Lighthouse

```typescript
import { getPlaybookRegistry } from "./playbooks/index.js";

const registry = getPlaybookRegistry();

// Upload and register in one step
const registered = await registry.uploadAndRegisterToLighthouse(
  "./playbooks/my-security.yaml",
  "my-security-id", // optional ID
  (progress) => {
    console.log(`Upload: ${progress.percentage}%`);
  }
);

console.log(`CID: ${registered.source.cid}`);
console.log(`URL: ${registered.source.location}`);
```

### Register a Playbook from IPFS CID

```typescript
import { getPlaybookRegistry } from "./playbooks/index.js";

const registry = getPlaybookRegistry();

// Register from existing CID
const cid = "QmXxx..."; // IPFS CID
const registered = await registry.registerFromLighthouse(cid, "playbook-id");

console.log(`Registered: ${registered.meta.name}`);
```

### Sync All Playbooks from Lighthouse

```typescript
import { getPlaybookRegistry } from "./playbooks/index.js";

const registry = getPlaybookRegistry();

// Sync all YAML files from your Lighthouse account
const synced = await registry.syncFromLighthouse();

console.log(`Synced ${synced.length} playbooks`);
```

### Use Lighthouse Storage Directly

```typescript
import { getLighthouse, initializeLighthouse } from "./playbooks/index.js";

// Initialize
const lighthouse = initializeLighthouse("your_api_key");

// Upload
const metadata = await lighthouse.uploadPlaybook("./playbook.yaml");
console.log(`Uploaded: ${metadata.cid}`);

// Download
const yamlContent = await lighthouse.downloadPlaybook("QmXxx...");

// List all uploads
const uploads = await lighthouse.listUploads();
```

## CLI Commands

Once integrated into your task, you can use:

### Upload to Lighthouse

```bash
npx hardhat superaudit --upload-playbook ./playbooks/my-security.yaml
```

Output:
```
📤 Uploading playbook to Lighthouse: ./playbooks/my-security.yaml
   Upload progress: 100.00%
✅ Uploaded to IPFS: QmXxx...
   Gateway URL: https://gateway.lighthouse.storage/ipfs/QmXxx...
✅ Uploaded and registered playbook
   ID: my-security
   Name: My Security Playbook
   CID: QmXxx...
   URL: https://gateway.lighthouse.storage/ipfs/QmXxx...
```

### Register from Lighthouse CID

```bash
npx hardhat superaudit --register-from-lighthouse QmXxx...
```

Output:
```
📥 Fetching playbook from IPFS: QmXxx...
   Fetching from: https://gateway.lighthouse.storage/ipfs/QmXxx...
   ✓ Cached locally
✅ Playbook registered from Lighthouse
   ID: lighthouse-QmXxx...
   Name: DeFi Vault Security
   CID: QmXxx...
```

### Sync from Lighthouse

```bash
npx hardhat superaudit --sync-lighthouse
```

Output:
```
🔄 Syncing playbooks from Lighthouse...
   ⏭️  Already registered: erc20-security.yaml
   ✅ Synced: vault-security.yaml
   ✅ Synced: access-control.yaml
✅ Synced 2 playbook(s) from Lighthouse
```

### Use Lighthouse-stored Playbook

```bash
# Use by CID (if registered)
npx hardhat superaudit --playbook lighthouse-QmXxx...

# Or by custom ID
npx hardhat superaudit --playbook my-security
```

## API Reference

### LighthouseStorageManager

```typescript
class LighthouseStorageManager {
  // Upload playbook file
  async uploadPlaybook(
    filePath: string,
    progressCallback?: (progress: any) => void
  ): Promise<LighthousePlaybookMetadata>

  // Upload playbook from string
  async uploadPlaybookFromString(
    yamlContent: string,
    filename: string,
    progressCallback?: (progress: any) => void
  ): Promise<LighthousePlaybookMetadata>

  // Download playbook by CID
  async downloadPlaybook(cid: string): Promise<string>

  // Get metadata without downloading full content
  async getPlaybookMetadata(cid: string): Promise<Partial<LighthousePlaybookMetadata>>

  // List all uploads
  async listUploads(): Promise<LighthousePlaybookMetadata[]>

  // Check if CID is accessible
  async isCIDAccessible(cid: string): Promise<boolean>

  // Get gateway URL
  getGatewayUrl(cid: string): string

  // Clear local cache
  clearCache(): void
}
```

### PlaybookRegistry Lighthouse Methods

```typescript
class PlaybookRegistry {
  // Upload and register
  async uploadAndRegisterToLighthouse(
    filePath: string,
    id?: string,
    progressCallback?: (progress: any) => void
  ): Promise<RegisteredPlaybook>

  // Register from CID
  async registerFromLighthouse(
    cid: string,
    id?: string
  ): Promise<RegisteredPlaybook>

  // Sync all uploads
  async syncFromLighthouse(): Promise<RegisteredPlaybook[]>
}
```

## Data Types

### LighthousePlaybookMetadata

```typescript
interface LighthousePlaybookMetadata {
  cid: string;              // IPFS CID
  name: string;             // Filename
  author: string;           // Playbook author
  description?: string;     // Description
  tags?: string[];          // Tags
  version?: string;         // Version
  uploadedAt: string;       // Upload timestamp
  size: number;             // File size in bytes
  lighthouseUrl: string;    // Gateway URL
}
```

### PlaybookSource (Updated)

```typescript
interface PlaybookSource {
  type: "file" | "string" | "remote" | "builtin" | "lighthouse";
  location: string;         // URL, path, or gateway URL
  hash?: string;            // Content hash
  cid?: string;             // IPFS CID (for lighthouse type)
}
```

## Workflow Examples

### Developer Workflow: Create and Share

```typescript
// 1. Create playbook locally
const yamlContent = `
version: "1.0"
meta:
  name: "Custom Security"
  author: "Your Name"
  ...
`;
writeFileSync("./custom-security.yaml", yamlContent);

// 2. Upload to Lighthouse
const registry = getPlaybookRegistry();
const registered = await registry.uploadAndRegisterToLighthouse(
  "./custom-security.yaml"
);

// 3. Share the CID
console.log(`Share this CID: ${registered.source.cid}`);
// Output: QmXxx...

// 4. Others can register it
// On another machine:
await registry.registerFromLighthouse("QmXxx...");
```

### Team Workflow: Centralized Playbook Library

```bash
# Team lead uploads playbooks
npx hardhat superaudit --upload-playbook ./playbooks/team-standard.yaml

# CID: QmAbc123...

# Team members sync
npx hardhat superaudit --sync-lighthouse

# Use the playbook
npx hardhat superaudit --playbook team-standard
```

### Marketplace Workflow: Public Playbook Registry

```typescript
// Marketplace can list available playbooks
const lighthouse = getLighthouse();
const allPlaybooks = await lighthouse.listUploads();

// Users browse and select
console.log("Available playbooks:");
for (const pb of allPlaybooks) {
  console.log(`- ${pb.name} (${pb.cid})`);
}

// User registers selected playbook
const cid = "QmXxx..."; // Selected from marketplace
await registry.registerFromLighthouse(cid);

// Use it
const rules = await loadRulesFromRegistry(cid);
```

## Features

### ✅ Decentralization
- Playbooks stored on IPFS (permanent, censorship-resistant)
- No central server dependency
- Content-addressable (CID-based)

### ✅ Sharing
- Share via CID (short, immutable identifier)
- No need to send large files
- Version control through CIDs

### ✅ Caching
- Downloaded playbooks cached locally
- Reduces network calls
- Faster subsequent access

### ✅ Discovery
- List all uploads from your account
- Auto-sync feature
- Search by tags/metadata

### ✅ Integration
- Seamless registry integration
- Works with existing registry features
- Backward compatible

## Security Considerations

### Content Integrity
- IPFS CIDs are cryptographic hashes
- Content cannot be modified without changing CID
- Tamper-proof distribution

### Access Control
- API key required for uploads
- Public read access via gateway
- Can implement encryption if needed

### Best Practices
1. **Verify Sources**: Only register playbooks from trusted CIDs
2. **Review Content**: Always review playbook content before use
3. **Test Locally**: Test playbooks locally before uploading
4. **Version Control**: Use different CIDs for different versions
5. **Metadata**: Include complete metadata in playbooks

## Troubleshooting

### Lighthouse not initialized
```
Error: Lighthouse not initialized. Set LIGHTHOUSE_API_KEY environment variable.
```

**Solution**: Add `LIGHTHOUSE_API_KEY` to your `.env` file.

### Upload failed
```
Error: Lighthouse upload failed: ...
```

**Solutions**:
- Check your API key is valid
- Verify file exists and is readable
- Check file size (max 24GB)
- Ensure internet connection

### Download failed
```
Error: Failed to download from IPFS (QmXxx...): ...
```

**Solutions**:
- Verify CID is correct
- Check internet connection
- Try a different gateway
- Clear cache and retry

### CID not accessible
```typescript
const accessible = await lighthouse.isCIDAccessible("QmXxx...");
if (!accessible) {
  console.log("CID not accessible");
}
```

**Solutions**:
- Wait a few minutes (IPFS propagation)
- Try a different gateway
- Verify upload was successful

## Advanced Usage

### Custom Gateway

```typescript
const lighthouse = new LighthouseStorageManager({
  apiKey: "your_key",
  gatewayUrl: "https://your-custom-gateway.com/ipfs"
});
```

### Progress Tracking

```typescript
const progressCallback = (progressData) => {
  const percentage = 100 - ((progressData?.total / progressData?.uploaded) * 100 || 0);
  console.log(`⬆️  Upload: ${percentage.toFixed(2)}%`);
  
  // Update UI, progress bar, etc.
};

await registry.uploadAndRegisterToLighthouse(
  "./playbook.yaml",
  undefined,
  progressCallback
);
```

### Bulk Operations

```typescript
// Upload multiple playbooks
const files = ["./playbook1.yaml", "./playbook2.yaml", "./playbook3.yaml"];

for (const file of files) {
  const registered = await registry.uploadAndRegisterToLighthouse(file);
  console.log(`✅ ${registered.meta.name}: ${registered.source.cid}`);
}

// Sync and register all
await registry.syncFromLighthouse();
```

### Cache Management

```typescript
import { getLighthouse } from "./playbooks/index.js";

const lighthouse = getLighthouse();

// Clear cache to force fresh downloads
lighthouse.clearCache();

// Download will fetch fresh
const content = await lighthouse.downloadPlaybook("QmXxx...");
```

## Future Enhancements

### Planned Features
- 🔄 Encrypted playbooks
- 🔄 Paid playbooks (Lighthouse access control)
- 🔄 Versioning system
- 🔄 Dependency resolution
- 🔄 Playbook signatures
- 🔄 Marketplace UI
- 🔄 Auto-updates
- 🔄 Collaborative editing

## Resources

- [Lighthouse Documentation](https://docs.lighthouse.storage/)
- [IPFS Documentation](https://docs.ipfs.tech/)
- [Lighthouse Files Dapp](https://files.lighthouse.storage/)
- [Lighthouse SDK GitHub](https://github.com/lighthouse-web3/lighthouse-package)

## Summary

The Lighthouse integration provides:
- ✅ Decentralized storage for playbooks
- ✅ Easy sharing via CID
- ✅ Permanent, tamper-proof storage
- ✅ Auto-sync capabilities
- ✅ Foundation for marketplace
- ✅ Fully integrated with registry

**Get started:**
1. Add `LIGHTHOUSE_API_KEY` to `.env`
2. Run `npx hardhat superaudit --upload-playbook ./my-playbook.yaml`
3. Share the CID with others
4. They can register with `--register-from-lighthouse <CID>`

Happy auditing on the decentralized web! 🌐🔒
