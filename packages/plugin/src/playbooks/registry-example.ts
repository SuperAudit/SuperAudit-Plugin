/**
 * Example test/demo script for the Playbook Registry
 * 
 * Run with: npx ts-node packages/plugin/src/playbooks/registry-example.ts
 */

import {
  getPlaybookRegistry,
  initializeRegistry,
  getSamplePlaybooks,
  formatPlaybookList,
  formatRegistryStats,
  loadRulesFromRegistry,
} from "./index.js";

async function main() {
  console.log("🚀 Playbook Registry Demo\n");

  // 1. Initialize registry with builtin playbooks
  console.log("1️⃣  Initializing registry with builtin playbooks...");
  const builtins = getSamplePlaybooks();
  await initializeRegistry(builtins);
  console.log("✅ Registry initialized\n");

  // 2. Get registry instance
  const registry = getPlaybookRegistry();

  // 3. Show all registered playbooks
  console.log("2️⃣  Registered playbooks:");
  console.log("-".repeat(60));
  const allPlaybooks = registry.getAll();
  console.log(formatPlaybookList(allPlaybooks));

  // 4. Show registry statistics
  console.log("\n3️⃣  Registry Statistics:");
  console.log("-".repeat(60));
  const stats = registry.getStats();
  console.log(formatRegistryStats(stats));

  // 5. Search playbooks by tags
  console.log("\n4️⃣  Searching playbooks with tag 'defi':");
  console.log("-".repeat(60));
  const defiPlaybooks = registry.search({ tags: ["defi"] });
  console.log(`Found ${defiPlaybooks.length} playbook(s):`);
  for (const pb of defiPlaybooks) {
    console.log(`  - ${pb.meta.name} (${pb.id})`);
  }

  // 6. Get playbooks by author
  console.log("\n5️⃣  Playbooks by 'SuperAudit Team':");
  console.log("-".repeat(60));
  const teamPlaybooks = registry.getByAuthor("SuperAudit Team");
  console.log(`Found ${teamPlaybooks.length} playbook(s):`);
  for (const pb of teamPlaybooks) {
    console.log(`  - ${pb.meta.name}`);
  }

  // 7. Get all unique tags
  console.log("\n6️⃣  All available tags:");
  console.log("-".repeat(60));
  const tags = registry.getAllTags();
  console.log(tags.join(", "));

  // 8. Load rules from a playbook
  console.log("\n7️⃣  Loading rules from 'defi-vault-security' playbook:");
  console.log("-".repeat(60));
  try {
    const rules = await loadRulesFromRegistry("defi-vault-security");
    console.log(`Loaded ${rules.length} rule(s)`);
    
    // Show first few rules
    console.log("\nFirst 3 rules:");
    for (const rule of rules.slice(0, 3)) {
      console.log(`  - ${rule.id}: ${rule.severity}`);
    }
  } catch (error) {
    console.error("Error loading rules:", error);
  }

  // 9. Register a custom playbook from string
  console.log("\n8️⃣  Registering a custom playbook:");
  console.log("-".repeat(60));
  const customYaml = `
version: "1.0"
meta:
  name: "Custom Test Playbook"
  author: "Demo User"
  description: "A test playbook for demonstration"
  tags: ["test", "demo", "custom"]
  version: "1.0.0"

targets:
  contracts: ["Test*"]

checks:
  - id: "test-rule-1"
    rule: "pattern.test()"
    severity: "low"
    description: "Test rule"
  `.trim();

  try {
    const customPlaybook = await registry.registerFromString(
      customYaml,
      "custom-test",
      "demo"
    );
    console.log(`✅ Registered: ${customPlaybook.id}`);
    console.log(`   Name: ${customPlaybook.meta.name}`);
    console.log(`   Validated: ${customPlaybook.validated}`);
  } catch (error) {
    console.error("Error registering custom playbook:", error);
  }

  // 10. Search again to show the new playbook
  console.log("\n9️⃣  All playbooks after custom registration:");
  console.log("-".repeat(60));
  const updatedPlaybooks = registry.getAll();
  console.log(`Total: ${updatedPlaybooks.length} playbook(s)`);
  for (const pb of updatedPlaybooks) {
    console.log(`  - ${pb.id} (${pb.source.type})`);
  }

  // 11. Advanced search
  console.log("\n🔟 Advanced search - playbooks with 'defi' OR 'vault' tags:");
  console.log("-".repeat(60));
  const advancedSearch = registry.search({
    tags: ["defi", "vault"],
  });
  console.log(`Found ${advancedSearch.length} playbook(s):`);
  for (const pb of advancedSearch) {
    console.log(`  - ${pb.meta.name}`);
    console.log(`    Tags: ${pb.meta.tags?.join(", ") || "none"}`);
  }

  // 12. Validation check
  console.log("\n1️⃣1️⃣ Validating all playbooks:");
  console.log("-".repeat(60));
  for (const pb of registry.getAll()) {
    const { valid, errors } = registry.validate(pb.id);
    const status = valid ? "✅" : "❌";
    console.log(`${status} ${pb.id}: ${valid ? "Valid" : errors.join(", ")}`);
  }

  // 13. Usage tracking demonstration
  console.log("\n1️⃣2️⃣ Usage tracking:");
  console.log("-".repeat(60));
  console.log("Simulating playbook usage...");
  
  // Use some playbooks
  registry.getAndUse("defi-vault-security");
  registry.getAndUse("defi-vault-security");
  registry.getAndUse("erc20-security");
  
  // Show usage stats
  const statsAfterUsage = registry.getStats();
  console.log("\nMost used playbooks:");
  for (const pb of statsAfterUsage.mostUsed.slice(0, 3)) {
    console.log(`  - ${pb.meta.name}: ${pb.usageCount} time(s)`);
  }

  // 14. Export registry state
  console.log("\n1️⃣3️⃣ Export/Import demonstration:");
  console.log("-".repeat(60));
  const exportedState = registry.export();
  console.log(`✅ Exported registry with ${exportedState.playbooks.length} playbook(s)`);
  console.log(`   Export timestamp: ${exportedState.exportedAt}`);
  
  // Clear and re-import
  console.log("\nClearing registry...");
  registry.clear();
  console.log(`   Playbooks after clear: ${registry.getAll().length}`);
  
  console.log("\nRe-importing...");
  registry.import(exportedState);
  console.log(`   Playbooks after import: ${registry.getAll().length}`);

  console.log("\n✅ Demo completed!");
  console.log("\n" + "=".repeat(60));
  console.log("Summary:");
  console.log(`  Total playbooks: ${registry.getAll().length}`);
  console.log(`  Unique tags: ${registry.getAllTags().length}`);
  console.log(`  Unique authors: ${registry.getAllAuthors().length}`);
  console.log("=".repeat(60));
}

// Run the demo
main().catch((error) => {
  console.error("Demo failed:", error);
  process.exit(1);
});
