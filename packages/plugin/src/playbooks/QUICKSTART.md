# Playbook Registry - Quick Start Guide

Get started with the Playbook Registry in 5 minutes!

## Installation

The registry is already included in the SuperAudit plugin. No additional installation needed.

## Basic Usage (3 Steps)

### Step 1: Initialize the Registry

```typescript
import { initializePlaybookRegistry, getSamplePlaybooks } from "./playbooks/index.js";

// At application startup
await initializePlaybookRegistry();

// Optional: Load with custom builtins
const builtins = {
  ...getSamplePlaybooks(),
  "my-custom": myCustomPlaybookYaml
};
await initializeRegistry(builtins);
```

### Step 2: Register Your Playbooks

```typescript
import { getPlaybookRegistry } from "./playbooks/index.js";

const registry = getPlaybookRegistry();

// From a file
await registry.registerFromFile("./playbooks/my-security.yaml");

// From a directory (auto-discover all .yaml/.yml files)
await registry.registerFromDirectory("./playbooks", true); // true = recursive
```

### Step 3: Use the Playbooks

```typescript
import { loadRulesFromRegistry } from "./playbooks/index.js";

// Load rules from a registered playbook
const rules = await loadRulesFromRegistry("my-security");

// Use rules in analysis
const results = await analyzeContracts(contracts, rules);
```

## Common Tasks

### List All Playbooks

```typescript
const registry = getPlaybookRegistry();
const allPlaybooks = registry.getAll();

console.log(`Total playbooks: ${allPlaybooks.length}`);
for (const pb of allPlaybooks) {
  console.log(`- ${pb.meta.name} (${pb.id})`);
}
```

### Search by Tags

```typescript
const registry = getPlaybookRegistry();

// Find all DeFi-related playbooks
const defiPlaybooks = registry.search({ 
  tags: ["defi", "vault"] 
});

console.log(`Found ${defiPlaybooks.length} DeFi playbooks`);
```

### Get Recommended Playbooks

```typescript
import { getRecommendedPlaybooks } from "./playbooks/index.js";

// Based on your contract names
const contracts = ["VaultToken", "LendingPool", "RewardStaking"];
const recommended = getRecommendedPlaybooks(contracts);

console.log("Recommended playbooks:");
for (const pb of recommended.slice(0, 3)) {
  console.log(`- ${pb.meta.name}`);
}
```

### Load Multiple Playbooks at Once

```typescript
import { loadRulesFromMultiplePlaybooks } from "./playbooks/index.js";

const playbookIds = ["erc20-security", "access-control", "defi-vault"];
const allRules = await loadRulesFromMultiplePlaybooks(playbookIds);

console.log(`Loaded ${allRules.length} rules from ${playbookIds.length} playbooks`);
```

### Check Playbook Validity

```typescript
const registry = getPlaybookRegistry();

// Check a specific playbook
const { valid, errors } = registry.validate("my-playbook");
if (!valid) {
  console.error("Validation errors:", errors);
}

// Validate all registered playbooks
import { validateAllPlaybooks } from "./playbooks/index.js";

const validation = validateAllPlaybooks();
console.log(`Valid: ${validation.valid}, Invalid: ${validation.invalid}`);
```

### View Statistics

```typescript
import { formatRegistryStats } from "./playbooks/index.js";

const registry = getPlaybookRegistry();
const stats = registry.getStats();

console.log(formatRegistryStats(stats));
```

## Integration with Hardhat Task

Add to your `tasks/analyze.ts`:

```typescript
import { 
  initializePlaybookRegistry,
  getPlaybookRegistry,
  loadRulesFromRegistry,
  registerProjectPlaybooks
} from "../playbooks/index.js";

task("superaudit", "Run security analysis")
  .addParam("playbook", "Playbook ID or file path", undefined, types.string, true)
  .addFlag("listPlaybooks", "List all registered playbooks")
  .setAction(async (taskArgs, hre) => {
    // Initialize registry
    await initializePlaybookRegistry();
    
    // Auto-discover project playbooks
    await registerProjectPlaybooks(hre.config.paths.root);
    
    // List playbooks if requested
    if (taskArgs.listPlaybooks) {
      const registry = getPlaybookRegistry();
      const playbooks = registry.getAll();
      
      console.log("\nAvailable Playbooks:");
      for (const pb of playbooks) {
        console.log(`  - ${pb.id}: ${pb.meta.name}`);
      }
      return;
    }
    
    // Load playbook
    let rules;
    if (taskArgs.playbook) {
      const registry = getPlaybookRegistry();
      
      // Try as registry ID first
      if (registry.has(taskArgs.playbook)) {
        rules = await loadRulesFromRegistry(taskArgs.playbook);
      }
      // Otherwise, treat as file path and register
      else if (existsSync(taskArgs.playbook)) {
        await registry.registerFromFile(taskArgs.playbook);
        const id = /* generate ID from path */;
        rules = await loadRulesFromRegistry(id);
      }
    }
    
    // Continue with analysis...
  });
```

## CLI Examples

Once integrated, you can use:

```bash
# Initialize and list builtin playbooks
npx hardhat superaudit --list-playbooks

# Use a registered playbook by ID
npx hardhat superaudit --playbook erc20-security

# Register and use a new playbook
npx hardhat superaudit --register-playbook ./my-playbook.yaml
npx hardhat superaudit --playbook my-playbook

# Search for playbooks
npx hardhat superaudit --search-playbooks "defi,reentrancy"

# Show registry stats
npx hardhat superaudit --registry-stats
```

## Creating Custom Playbooks

Create a YAML file (e.g., `my-playbook.yaml`):

```yaml
version: "1.0"
meta:
  name: "My Custom Security Checks"
  author: "Your Name"
  description: "Custom security analysis for my project"
  tags: ["custom", "my-project"]
  version: "1.0.0"

targets:
  contracts: ["MyContract*"]

checks:
  - id: "my-check-1"
    rule: "pattern.uncheckedReturn(functions=['transfer'])"
    severity: "high"
    description: "Check transfer return values"
```

Register it:

```typescript
const registry = getPlaybookRegistry();
await registry.registerFromFile("./my-playbook.yaml");

// Now use it
const rules = await loadRulesFromRegistry("my-playbook");
```

## Best Practices

### 1. Initialize Early
```typescript
// Do this at startup
await initializePlaybookRegistry();

// Not in every function that needs it
```

### 2. Use IDs for Consistency
```typescript
// Good: Use consistent IDs
const rules = await loadRulesFromRegistry("erc20-security");

// Avoid: Hardcoding file paths everywhere
const rules = await loadPlaybookRules("../../playbooks/erc20.yaml");
```

### 3. Track Usage
```typescript
// Use getAndUse() to track statistics
const playbook = registry.getAndUse("my-playbook");

// Instead of just get()
const playbook = registry.get("my-playbook");
```

### 4. Handle Errors Gracefully
```typescript
try {
  const rules = await loadRulesFromRegistry("my-playbook");
} catch (error) {
  console.error("Failed to load playbook:", error);
  // Fallback to default rules
  const rules = getDefaultRules();
}
```

### 5. Validate Before Use
```typescript
const { valid, errors } = registry.validate("my-playbook");
if (valid) {
  const rules = await loadRulesFromRegistry("my-playbook");
  // Use rules
} else {
  console.error("Invalid playbook:", errors);
}
```

## Troubleshooting

### Problem: Playbook not found
```typescript
// Check if registered
if (!registry.has("my-playbook")) {
  console.log("Playbook not registered");
  console.log("Available:", registry.getAllTags());
}
```

### Problem: Validation errors
```typescript
const playbook = registry.get("my-playbook");
if (!playbook.validated) {
  console.log("Errors:", playbook.validationErrors);
}
```

### Problem: No playbooks loaded
```typescript
const stats = registry.getStats();
if (stats.totalPlaybooks === 0) {
  console.log("No playbooks registered");
  await initializePlaybookRegistry(); // Initialize builtins
}
```

## Testing

### Unit Test Example
```typescript
import { getPlaybookRegistry } from "./playbooks/index.js";

describe("My Feature with Registry", () => {
  let registry;

  beforeEach(() => {
    registry = getPlaybookRegistry();
    registry.clear(); // Clean state for each test
  });

  it("should load rules from playbook", async () => {
    await registry.registerFromString(testPlaybookYaml, "test");
    const rules = await loadRulesFromRegistry("test");
    expect(rules.length).toBeGreaterThan(0);
  });
});
```

### Integration Test Example
```typescript
import { initializePlaybookRegistry, registerProjectPlaybooks } from "./playbooks/index.js";

describe("Registry Integration", () => {
  beforeAll(async () => {
    await initializePlaybookRegistry();
  });

  it("should discover project playbooks", async () => {
    const count = await registerProjectPlaybooks("./test-project");
    expect(count).toBeGreaterThan(0);
  });
});
```

## Next Steps

1. **Read the full documentation**: [`REGISTRY.md`](./REGISTRY.md)
2. **Understand the architecture**: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
3. **Run the example**: `npx ts-node packages/plugin/src/playbooks/registry-example.ts`
4. **Integrate into your task**: See [`registry-integration.ts`](./registry-integration.ts)

## Need Help?

- Check the [Implementation Summary](./IMPLEMENTATION_SUMMARY.md) for detailed info
- Look at [example code](./registry-example.ts) for working examples
- Review [integration examples](./registry-integration.ts) for task integration

## Summary

The Playbook Registry provides:
- ✅ Centralized playbook management
- ✅ Easy registration from files/strings/directories
- ✅ Powerful search and discovery
- ✅ Usage tracking and analytics
- ✅ Validation and error handling
- ✅ Simple, intuitive API

Start using it in 3 lines:
```typescript
await initializePlaybookRegistry();
const registry = getPlaybookRegistry();
const rules = await loadRulesFromRegistry("erc20-security");
```

Happy auditing! 🔒
