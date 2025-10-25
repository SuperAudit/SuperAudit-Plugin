# Lighthouse Integration - Quick Reference

## 🚀 Quick Start (3 Steps)

```bash
# 1. Set API key in .env
LIGHTHOUSE_API_KEY=your_key_here

# 2. Upload playbook
npx hardhat superaudit --upload-playbook ./playbook.yaml

# 3. Share the CID!
# Output: CID: QmXxx...
```

## 📝 Essential Commands

```bash
# Upload to Lighthouse
npx hardhat superaudit --upload-playbook ./playbook.yaml

# Register from CID
npx hardhat superaudit --register-from-lighthouse QmXxx...

# Sync all uploads
npx hardhat superaudit --sync-lighthouse

# Use Lighthouse playbook
npx hardhat superaudit --playbook lighthouse-QmXxx...
```

## 💻 Code Examples

### Upload and Register
```typescript
const registry = getPlaybookRegistry();
const registered = await registry.uploadAndRegisterToLighthouse(
  "./playbook.yaml"
);
console.log(`CID: ${registered.source.cid}`);
```

### Register from CID
```typescript
const registered = await registry.registerFromLighthouse("QmXxx...");
console.log(`Registered: ${registered.meta.name}`);
```

### Sync All
```typescript
const synced = await registry.syncFromLighthouse();
console.log(`Synced: ${synced.length} playbooks`);
```

### Direct Lighthouse Usage
```typescript
import { getLighthouse } from "./playbooks/index.js";

const lighthouse = getLighthouse();

// Upload
const metadata = await lighthouse.uploadPlaybook("./playbook.yaml");

// Download
const content = await lighthouse.downloadPlaybook("QmXxx...");

// List
const uploads = await lighthouse.listUploads();
```

## 🔑 API Reference

### Registry Methods
```typescript
// Upload and register
await registry.uploadAndRegisterToLighthouse(path, id?, progress?)

// Register from CID
await registry.registerFromLighthouse(cid, id?)

// Sync uploads
await registry.syncFromLighthouse()
```

### Lighthouse Methods
```typescript
// Upload
await lighthouse.uploadPlaybook(path, progress?)
await lighthouse.uploadPlaybookFromString(yaml, filename, progress?)

// Download
await lighthouse.downloadPlaybook(cid)
await lighthouse.getPlaybookMetadata(cid)

// Manage
await lighthouse.listUploads()
await lighthouse.isCIDAccessible(cid)
lighthouse.getGatewayUrl(cid)
lighthouse.clearCache()
```

## 📂 File Structure
```
packages/plugin/src/playbooks/
├── lighthouse-storage.ts         # Core implementation
├── lighthouse-example.ts          # Working demo
├── LIGHTHOUSE_INTEGRATION.md     # Full documentation
└── registry.ts                   # Registry with Lighthouse methods
```

## 🎯 Common Workflows

### Share Playbook
```typescript
// 1. Upload
const registered = await registry.uploadAndRegisterToLighthouse("./playbook.yaml");

// 2. Get CID
const cid = registered.source.cid;

// 3. Share CID with team
console.log(`Share: ${cid}`);

// 4. Team registers
await registry.registerFromLighthouse(cid);
```

### Auto-Sync Team Playbooks
```typescript
// On initialization
await initializePlaybookRegistry(); // Auto-syncs

// Or manual
await registry.syncFromLighthouse();
```

## ⚙️ Configuration

### Environment (.env)
```bash
LIGHTHOUSE_API_KEY=your_api_key_here
```

### Programmatic
```typescript
import { initializeLighthouse } from "./playbooks/index.js";

const lighthouse = initializeLighthouse("your_api_key");
```

## 🐛 Troubleshooting

### Lighthouse not initialized
```typescript
if (!isLighthouseInitialized()) {
  console.log("Set LIGHTHOUSE_API_KEY in .env");
}
```

### Upload failed
- Check API key is valid
- Verify file exists
- Check file size (<24GB)
- Ensure internet connection

### Download failed
- Verify CID is correct
- Check internet connection
- Clear cache and retry:
  ```typescript
  lighthouse.clearCache();
  ```

### CID not accessible
```typescript
const accessible = await lighthouse.isCIDAccessible("QmXxx...");
if (!accessible) {
  // Wait a few minutes for IPFS propagation
}
```

## 📖 Documentation

- **Full Guide**: `LIGHTHOUSE_INTEGRATION.md`
- **Demo Script**: `lighthouse-example.ts`
- **Registry Docs**: `REGISTRY.md`

## 🧪 Test It

```bash
# Run example demo
cd packages/plugin
npx ts-node src/playbooks/lighthouse-example.ts
```

## 🎁 Features

✅ Upload to IPFS
✅ Download from CID  
✅ Auto-sync uploads
✅ Progress tracking
✅ Local caching
✅ CID verification
✅ Registry integration
✅ CLI commands

## 🔗 Links

- [Lighthouse Docs](https://docs.lighthouse.storage/)
- [Get API Key](https://files.lighthouse.storage/)
- [IPFS Docs](https://docs.ipfs.tech/)

## 📞 Quick Help

```typescript
// Check initialization
import { isLighthouseInitialized } from "./playbooks/index.js";
console.log(isLighthouseInitialized());

// Get instance
import { getLighthouse } from "./playbooks/index.js";
const lighthouse = getLighthouse();

// Get registry
import { getPlaybookRegistry } from "./playbooks/index.js";
const registry = getPlaybookRegistry();
```

---

**Status**: ✅ Ready to use
**API Key**: Configured in `.env`
**Demo**: `lighthouse-example.ts`
