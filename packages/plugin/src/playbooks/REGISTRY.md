# Playbook Registry Module

A centralized registry system for managing, discovering, and validating audit playbooks in SuperAudit.

## Overview

The Playbook Registry provides a robust system for:
- **Registering** playbooks from various sources (files, strings, directories, built-ins)
- **Searching** and filtering playbooks by tags, author, severity, and other criteria
- **Validating** playbook integrity and compatibility
- **Caching** parsed playbooks for improved performance
- **Tracking** usage statistics and metadata
- **Managing** playbook lifecycle (register, update, unregister)

## Architecture

### Core Components

1. **PlaybookRegistry** - Singleton registry class managing all playbooks
2. **RegisteredPlaybook** - Metadata wrapper for registered playbooks
3. **PlaybookSource** - Source tracking (file, string, remote, builtin)
4. **Registry Utils** - Helper functions for common registry operations

### Files

```
playbooks/
├── registry.ts          # Core registry implementation
├── registry-utils.ts    # Utility functions
├── types.ts            # Type definitions
├── parser.ts           # YAML parser
└── index.ts            # Public exports
```

## Usage Examples

### Basic Usage

```typescript
import { 
  getPlaybookRegistry, 
  loadRulesFromRegistry 
} from "./playbooks/index.js";

// Get singleton instance
const registry = getPlaybookRegistry();

// Register a playbook from file
await registry.registerFromFile("./playbooks/defi-security.yaml");

// Load rules from registered playbook
const rules = await loadRulesFromRegistry("defi-security");

// Use rules in analysis
const results = await runAnalysis(contracts, rules);
```

### Registering Playbooks

```typescript
// From file
const playbook1 = await registry.registerFromFile(
  "./playbooks/erc20-security.yaml"
);

// From YAML string
const yamlContent = `
version: "1.0"
meta:
  name: "Custom Security Check"
  author: "Your Name"
  ...
`;
const playbook2 = await registry.registerFromString(
  yamlContent, 
  "custom-security"
);

// From directory (recursive)
const playbooks = await registry.registerFromDirectory(
  "./playbooks",
  true  // recursive
);

// Builtin playbook
await registry.registerBuiltin(
  "default-security",
  builtinPlaybookYaml
);
```

### Searching and Filtering

```typescript
// Search by tags
const defiPlaybooks = registry.search({
  tags: ["defi", "vault"]
});

// Search by author
const teamPlaybooks = registry.search({
  author: "SuperAudit Team"
});

// Search by multiple criteria
const criticalERC20 = registry.search({
  tags: ["erc20"],
  severity: ["critical", "high"],
  aiEnabled: true
});

// Get playbooks by specific tag
const reentrancyPlaybooks = registry.getByTag("reentrancy");

// Get all playbooks by author
const authorPlaybooks = registry.getByAuthor("SuperAudit Team");
```

### Working with Registered Playbooks

```typescript
// Get playbook by ID
const playbook = registry.get("erc20-security");

// Get and mark as used (updates usage count)
const playbook = registry.getAndUse("erc20-security");

// Check if registered
if (registry.has("custom-playbook")) {
  console.log("Playbook exists");
}

// Validate playbook
const { valid, errors } = registry.validate("custom-playbook");
if (!valid) {
  console.error("Validation errors:", errors);
}

// Unregister playbook
registry.unregister("old-playbook");
```

### Statistics and Analytics

```typescript
import { formatRegistryStats } from "./playbooks/index.js";

// Get registry statistics
const stats = registry.getStats();
console.log(`Total playbooks: ${stats.totalPlaybooks}`);
console.log(`Most used:`, stats.mostUsed);

// Format and display stats
const statsDisplay = formatRegistryStats(stats);
console.log(statsDisplay);

// Get all unique tags
const tags = registry.getAllTags();
console.log("Available tags:", tags);

// Get all authors
const authors = registry.getAllAuthors();
```

### Advanced Features

```typescript
import {
  loadRulesFromMultiplePlaybooks,
  findAndLoadPlaybooks,
  getRecommendedPlaybooks,
  mergePlaybooks
} from "./playbooks/index.js";

// Load rules from multiple playbooks
const rules = await loadRulesFromMultiplePlaybooks([
  "erc20-security",
  "access-control",
  "defi-vault"
]);

// Find and load playbooks matching criteria
const { playbooks, rules } = await findAndLoadPlaybooks({
  tags: ["defi"],
  severity: ["critical", "high"]
});

// Get recommended playbooks based on contract patterns
const contractNames = ["VaultToken", "LendingPool", "RewardManager"];
const recommended = getRecommendedPlaybooks(contractNames);

// Merge multiple playbooks into one
const merged = await mergePlaybooks(
  ["erc20-security", "access-control"],
  "erc20-with-access",
  {
    name: "ERC20 with Access Control",
    author: "Custom"
  }
);
```

### Persistence

```typescript
// Export registry state
const state = registry.export();
const json = JSON.stringify(state);
// Save to file or database

// Import registry state
const savedState = JSON.parse(json);
registry.import(savedState);
```

### Initialization with Builtins

```typescript
import { initializeRegistry, getSamplePlaybooks } from "./playbooks/index.js";

// Initialize with builtin playbooks
const builtins = getSamplePlaybooks();
await initializeRegistry(builtins);

// Now registry contains all builtin playbooks
const registry = getPlaybookRegistry();
console.log(`Loaded ${registry.getAll().length} builtin playbooks`);
```

## Integration with SuperAudit Task

The registry can be integrated into the main SuperAudit analysis task:

```typescript
// In tasks/analyze.ts
import { getPlaybookRegistry, loadRulesFromRegistry } from "../playbooks/index.js";

async function determineAnalysisRules(args: any) {
  const registry = getPlaybookRegistry();
  
  // If playbook ID is provided, load from registry
  if (args.playbook) {
    // Check if it's a registered playbook ID
    if (registry.has(args.playbook)) {
      console.log(`📋 Loading playbook from registry: ${args.playbook}`);
      const rules = await loadRulesFromRegistry(args.playbook);
      return { rules, analysisMode: "playbook" };
    }
    
    // Otherwise, treat as file path and register it
    if (existsSync(args.playbook)) {
      console.log(`📋 Registering and loading playbook: ${args.playbook}`);
      await registry.registerFromFile(args.playbook);
      const id = generateIdFromPath(args.playbook);
      const rules = await loadRulesFromRegistry(id);
      return { rules, analysisMode: "playbook" };
    }
    
    throw new Error(`Playbook not found: ${args.playbook}`);
  }
  
  // ... rest of logic
}
```

## CLI Commands (Proposed)

```bash
# List all registered playbooks
npx hardhat superaudit --list-playbooks

# Show registry statistics
npx hardhat superaudit --registry-stats

# Search playbooks by tag
npx hardhat superaudit --search-playbooks "defi,reentrancy"

# Register a new playbook
npx hardhat superaudit --register-playbook ./my-playbook.yaml

# Validate all registered playbooks
npx hardhat superaudit --validate-playbooks

# Show detailed info about a playbook
npx hardhat superaudit --playbook-info erc20-security
```

## Type Definitions

### RegisteredPlaybook

```typescript
interface RegisteredPlaybook {
  id: string;                    // Unique identifier
  source: PlaybookSource;        // Source information
  meta: PlaybookMeta;           // Playbook metadata
  parsedPlaybook?: ParsedPlaybook; // Cached parsed version
  registeredAt: Date;           // Registration timestamp
  lastUsed?: Date;              // Last usage timestamp
  usageCount: number;           // Usage counter
  validated: boolean;           // Validation status
  validationErrors?: string[];  // Validation errors if any
}
```

### PlaybookSource

```typescript
interface PlaybookSource {
  type: "file" | "string" | "remote" | "builtin";
  location: string;             // Path, URL, or identifier
  hash?: string;                // Content hash
}
```

### PlaybookSearchCriteria

```typescript
interface PlaybookSearchCriteria {
  tags?: string[];              // Filter by tags
  author?: string;              // Filter by author
  name?: string;                // Filter by name (partial)
  minVersion?: string;          // Minimum version
  severity?: string[];          // Filter by severity levels
  aiEnabled?: boolean;          // Filter by AI enablement
}
```

## Best Practices

1. **Initialize Early**: Initialize the registry with builtin playbooks at startup
2. **Use IDs Consistently**: Use consistent IDs for playbooks across your application
3. **Validate Before Use**: Always validate playbooks before using them in analysis
4. **Cache Results**: The registry caches parsed playbooks - reuse registered playbooks
5. **Track Usage**: Use `getAndUse()` instead of `get()` to track usage statistics
6. **Error Handling**: Always handle validation errors gracefully
7. **Regular Updates**: Periodically check for outdated playbooks and re-register

## Future Enhancements

- **Remote Playbooks**: Support loading from IPFS, URLs, or package registries
- **Versioning**: Support multiple versions of the same playbook
- **Dependencies**: Allow playbooks to depend on other playbooks
- **Hot Reload**: Watch for file changes and auto-reload
- **Marketplace Integration**: Connect to playbook marketplace
- **Signatures**: Verify playbook signatures for security
- **Encryption**: Support encrypted playbooks with Lighthouse
- **Auto-Discovery**: Automatically discover playbooks in project directories

## Testing

```typescript
import { getPlaybookRegistry } from "./playbooks/index.js";

describe("PlaybookRegistry", () => {
  let registry;
  
  beforeEach(() => {
    registry = getPlaybookRegistry();
    registry.clear(); // Clear for isolated tests
  });
  
  it("should register a playbook from file", async () => {
    const playbook = await registry.registerFromFile("./test.yaml");
    expect(registry.has(playbook.id)).toBe(true);
  });
  
  it("should search playbooks by tags", async () => {
    await registry.registerFromFile("./erc20.yaml");
    const results = registry.search({ tags: ["erc20"] });
    expect(results.length).toBeGreaterThan(0);
  });
  
  // More tests...
});
```

## Contributing

When adding new features to the registry:

1. Update type definitions in `types.ts`
2. Add core functionality to `registry.ts`
3. Add helper functions to `registry-utils.ts`
4. Export from `index.ts`
5. Update this README with examples
6. Add tests for new functionality

## License

Same as SuperAudit-Plugin project license.
