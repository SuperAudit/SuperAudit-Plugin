/**
 * Utility functions for working with the Playbook Registry
 */

import { getPlaybookRegistry } from "./registry.js";
import type { 
  RegisteredPlaybook, 
  PlaybookSearchCriteria,
  PlaybookStats 
} from "./registry.js";
import type { Rule } from "../types.js";
import { DSLInterpreter } from "./dsl/interpreter.js";

/**
 * Load rules from a registered playbook by ID
 */
export async function loadRulesFromRegistry(playbookId: string): Promise<Rule[]> {
  const registry = getPlaybookRegistry();
  const playbook = registry.getAndUse(playbookId);

  if (!playbook) {
    throw new Error(`Playbook not found in registry: ${playbookId}`);
  }

  if (!playbook.validated) {
    throw new Error(
      `Playbook ${playbookId} failed validation: ${playbook.validationErrors?.join(", ")}`
    );
  }

  if (!playbook.parsedPlaybook) {
    throw new Error(`Playbook ${playbookId} has not been parsed`);
  }

  const interpreter = new DSLInterpreter();
  return interpreter.createRulesFromDSL(playbook.parsedPlaybook.staticRules);
}

/**
 * Load rules from multiple registered playbooks
 */
export async function loadRulesFromMultiplePlaybooks(
  playbookIds: string[]
): Promise<Rule[]> {
  const allRules: Rule[] = [];

  for (const id of playbookIds) {
    try {
      const rules = await loadRulesFromRegistry(id);
      allRules.push(...rules);
    } catch (error) {
      console.warn(`Failed to load rules from playbook ${id}:`, error);
    }
  }

  return allRules;
}

/**
 * Find and load playbooks matching search criteria
 */
export async function findAndLoadPlaybooks(
  criteria: PlaybookSearchCriteria
): Promise<{ playbooks: RegisteredPlaybook[]; rules: Rule[] }> {
  const registry = getPlaybookRegistry();
  const playbooks = registry.search(criteria);

  const rules: Rule[] = [];
  for (const playbook of playbooks) {
    if (playbook.validated && playbook.parsedPlaybook) {
      const interpreter = new DSLInterpreter();
      const playbookRules = interpreter.createRulesFromDSL(
        playbook.parsedPlaybook.staticRules
      );
      rules.push(...playbookRules);
    }
  }

  return { playbooks, rules };
}

/**
 * Get recommended playbooks based on contract analysis
 */
export function getRecommendedPlaybooks(
  contractPatterns: string[]
): RegisteredPlaybook[] {
  const registry = getPlaybookRegistry();
  const allPlaybooks = registry.getAll();

  // Score playbooks based on how well they match the contract patterns
  const scored = allPlaybooks
    .map(playbook => {
      let score = 0;

      // Check if playbook is validated
      if (!playbook.validated) return { playbook, score: -1 };

      const targets = playbook.parsedPlaybook?.targets;
      if (!targets) return { playbook, score: 0 };

      // Match contract patterns
      for (const pattern of contractPatterns) {
        const patternLower = pattern.toLowerCase();

        // Check if any target contract matches
        if (targets.contracts) {
          for (const target of targets.contracts) {
            if (target === "*") {
              score += 1;
            } else if (
              patternLower.includes(target.toLowerCase().replace(/\*/g, "")) ||
              target.toLowerCase().replace(/\*/g, "").includes(patternLower)
            ) {
              score += 5;
            }
          }
        }

        // Check tags
        if (playbook.meta.tags) {
          for (const tag of playbook.meta.tags) {
            if (patternLower.includes(tag.toLowerCase())) {
              score += 3;
            }
          }
        }
      }

      return { playbook, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map(({ playbook }) => playbook);
}

/**
 * Format registry statistics for display
 */
export function formatRegistryStats(stats: PlaybookStats): string {
  const lines: string[] = [];

  lines.push("📊 Playbook Registry Statistics");
  lines.push("================================");
  lines.push("");
  lines.push(`Total Playbooks: ${stats.totalPlaybooks}`);
  lines.push("");

  // By source
  lines.push("By Source:");
  for (const [source, count] of Object.entries(stats.bySource)) {
    lines.push(`  ${source}: ${count}`);
  }
  lines.push("");

  // By author
  lines.push("Top Authors:");
  const topAuthors = Object.entries(stats.byAuthor)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  for (const [author, count] of topAuthors) {
    lines.push(`  ${author}: ${count} playbook${count > 1 ? "s" : ""}`);
  }
  lines.push("");

  // By tags
  lines.push("Top Tags:");
  const topTags = Object.entries(stats.byTags)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  for (const [tag, count] of topTags) {
    lines.push(`  ${tag}: ${count}`);
  }
  lines.push("");

  // Most used
  if (stats.mostUsed.length > 0) {
    lines.push("Most Used Playbooks:");
    for (const playbook of stats.mostUsed.slice(0, 5)) {
      lines.push(
        `  ${playbook.meta.name} (${playbook.usageCount} times) - ${playbook.id}`
      );
    }
    lines.push("");
  }

  // Recently added
  if (stats.recentlyAdded.length > 0) {
    lines.push("Recently Added:");
    for (const playbook of stats.recentlyAdded.slice(0, 5)) {
      const date = playbook.registeredAt.toLocaleDateString();
      lines.push(`  ${playbook.meta.name} (${date}) - ${playbook.id}`);
    }
  }

  return lines.join("\n");
}

/**
 * List all playbooks in a formatted table
 */
export function formatPlaybookList(playbooks: RegisteredPlaybook[]): string {
  if (playbooks.length === 0) {
    return "No playbooks found.";
  }

  const lines: string[] = [];
  lines.push("Available Playbooks:");
  lines.push("===================");
  lines.push("");

  for (const playbook of playbooks) {
    const status = playbook.validated ? "✓" : "✗";
    const tags = playbook.meta.tags ? playbook.meta.tags.join(", ") : "none";
    const usageInfo =
      playbook.usageCount > 0 ? ` (used ${playbook.usageCount} times)` : "";

    lines.push(`${status} ${playbook.id}`);
    lines.push(`  Name: ${playbook.meta.name}`);
    lines.push(`  Author: ${playbook.meta.author}`);
    lines.push(`  Tags: ${tags}`);
    lines.push(`  Source: ${playbook.source.type} - ${playbook.source.location}`);

    if (playbook.meta.description) {
      lines.push(`  Description: ${playbook.meta.description}`);
    }

    if (playbook.parsedPlaybook) {
      const ruleCount = playbook.parsedPlaybook.staticRules.length;
      const scenarioCount = playbook.parsedPlaybook.dynamicScenarios.length;
      lines.push(
        `  Rules: ${ruleCount} static, ${scenarioCount} dynamic scenarios`
      );
    }

    lines.push(`  Registered: ${playbook.registeredAt.toLocaleDateString()}${usageInfo}`);

    if (!playbook.validated && playbook.validationErrors) {
      lines.push(`  Errors: ${playbook.validationErrors.join("; ")}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Export playbook metadata for sharing/publishing
 */
export function exportPlaybookMetadata(
  playbook: RegisteredPlaybook
): Record<string, any> {
  return {
    id: playbook.id,
    meta: playbook.meta,
    source: {
      type: playbook.source.type,
      location: playbook.source.location,
    },
    validated: playbook.validated,
    stats: {
      registeredAt: playbook.registeredAt.toISOString(),
      lastUsed: playbook.lastUsed?.toISOString(),
      usageCount: playbook.usageCount,
    },
    summary: playbook.parsedPlaybook
      ? {
          staticRules: playbook.parsedPlaybook.staticRules.length,
          dynamicScenarios: playbook.parsedPlaybook.dynamicScenarios.length,
          invariants: playbook.parsedPlaybook.invariants.length,
          targets: playbook.parsedPlaybook.targets,
        }
      : undefined,
  };
}

/**
 * Validate all registered playbooks
 */
export function validateAllPlaybooks(): {
  total: number;
  valid: number;
  invalid: number;
  errors: Array<{ id: string; errors: string[] }>;
} {
  const registry = getPlaybookRegistry();
  const allPlaybooks = registry.getAll();

  const errors: Array<{ id: string; errors: string[] }> = [];
  let valid = 0;
  let invalid = 0;

  for (const playbook of allPlaybooks) {
    if (playbook.validated) {
      valid++;
    } else {
      invalid++;
      if (playbook.validationErrors) {
        errors.push({
          id: playbook.id,
          errors: playbook.validationErrors,
        });
      }
    }
  }

  return {
    total: allPlaybooks.length,
    valid,
    invalid,
    errors,
  };
}

/**
 * Get playbooks that need updates (checks for file modification)
 */
export async function getOutdatedPlaybooks(): Promise<RegisteredPlaybook[]> {
  const registry = getPlaybookRegistry();
  const filePlaybooks = registry
    .getAll()
    .filter(pb => pb.source.type === "file");

  const outdated: RegisteredPlaybook[] = [];

  // This is a placeholder - in a real implementation, you would check
  // file modification times and compare with registeredAt
  // For now, we just return an empty array
  return outdated;
}

/**
 * Merge multiple playbooks into one
 */
export async function mergePlaybooks(
  playbookIds: string[],
  newId: string,
  newMeta?: Partial<any>
): Promise<RegisteredPlaybook> {
  const registry = getPlaybookRegistry();
  const playbooks = playbookIds
    .map(id => registry.get(id))
    .filter((pb): pb is RegisteredPlaybook => pb !== undefined && pb.validated);

  if (playbooks.length === 0) {
    throw new Error("No valid playbooks found to merge");
  }

  // Combine all static rules
  const allStaticRules = playbooks.flatMap(
    pb => pb.parsedPlaybook?.staticRules || []
  );

  // Combine all dynamic scenarios
  const allDynamicScenarios = playbooks.flatMap(
    pb => pb.parsedPlaybook?.dynamicScenarios || []
  );

  // Combine all invariants
  const allInvariants = playbooks.flatMap(
    pb => pb.parsedPlaybook?.invariants || []
  );

  // Combine tags
  const allTags = Array.from(
    new Set(playbooks.flatMap(pb => pb.meta.tags || []))
  );

  // Create merged metadata
  const mergedMeta = {
    name: newMeta?.name || `Merged: ${playbooks.map(pb => pb.meta.name).join(" + ")}`,
    author: newMeta?.author || "SuperAudit Registry",
    description:
      newMeta?.description ||
      `Merged from: ${playbooks.map(pb => pb.id).join(", ")}`,
    tags: allTags,
    version: newMeta?.version || "1.0.0",
    ...newMeta,
  };

  // Create merged playbook YAML
  const mergedYaml = `
version: "1.0"
meta:
  name: "${mergedMeta.name}"
  author: "${mergedMeta.author}"
  description: "${mergedMeta.description}"
  tags: [${allTags.map(t => `"${t}"`).join(", ")}]
  version: "${mergedMeta.version}"

checks: []
  `.trim();

  // Register the merged playbook
  // Note: This creates a basic structure, you may need to enhance it
  return registry.registerFromString(mergedYaml, newId, "merged");
}
