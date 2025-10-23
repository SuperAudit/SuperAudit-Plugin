# SuperAudit Usage Guide

## Overview

SuperAudit can be configured in three ways (in order of precedence):
1. **Environment Variables** (highest priority)
2. **Hardhat Configuration File** (`hardhat.config.ts`)
3. **Default Values** (lowest priority)

## Configuration Methods

### Method 1: Using Hardhat Config (Recommended)

Add configuration to your `hardhat.config.ts`:

```typescript
import { HardhatUserConfig } from "hardhat/config";
import superauditPlugin from "hardhat-superaudit";

export default {
  plugins: [superauditPlugin],
  solidity: "0.8.29",
  
  superaudit: {
    mode: "full",  // Options: "basic", "advanced", "full"
    format: "console",  // Options: "console", "json", "sarif"
    playbook: "./custom-audit.yaml",  // Optional: custom playbook path
    rules: ["no-tx-origin", "reentrancy-paths"],  // Optional: specific rules to run
    ai: {
      enabled: true,
      provider: "openai",  // Options: "openai", "anthropic", "local"
      model: "gpt-4",
      temperature: 0.3,
      maxTokens: 1000
    }
  },
} satisfies HardhatUserConfig;
```

Then run:
```bash
npx hardhat superaudit
```

### Method 2: Using Environment Variables

Create a `.env` file or set environment variables:

```bash
# Analysis Configuration
SUPERAUDIT_MODE=full
SUPERAUDIT_FORMAT=console

# AI Enhancement
SUPERAUDIT_AI_ENABLED=true
SUPERAUDIT_AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-api-key-here

# Optional AI settings
SUPERAUDIT_AI_MODEL=gpt-4
SUPERAUDIT_AI_TEMPERATURE=0.3
SUPERAUDIT_AI_MAX_TOKENS=1000
```

Then run:
```bash
npx hardhat superaudit
```

### Method 3: Multiple Configurations for Different Scenarios

You can create different config files:

**hardhat.config.basic.ts** (fast, for CI):
```typescript
export default {
  plugins: [superauditPlugin],
  superaudit: {
    mode: "basic",  // Only AST rules, very fast
    format: "json"  // Machine-readable output
  },
} satisfies HardhatUserConfig;
```

**hardhat.config.full.ts** (thorough, for releases):
```typescript
export default {
  plugins: [superauditPlugin],
  superaudit: {
    mode: "full",  // All rules including CFG
    format: "sarif",  // GitHub integration
    ai: {
      enabled: true,  // AI-enhanced explanations
      provider: "openai"
    }
  },
} satisfies HardhatUserConfig;
```

Then run with specific config:
```bash
# Fast CI check
npx hardhat --config hardhat.config.basic.ts superaudit

# Full security audit
npx hardhat --config hardhat.config.full.ts superaudit
```

## Configuration Options

### Analysis Modes

| Mode | Description | Rules | Speed | Use Case |
|------|-------------|-------|-------|----------|
| `basic` | AST pattern matching only | 4 basic rules | <2ms | Quick checks, CI/CD |
| `advanced` | AST + CFG analysis | Basic + 3 advanced | ~10ms | Pre-commit hooks |
| `full` | Complete analysis | All rules + playbooks | ~20ms | Release audits |

### Output Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| `console` | Human-readable colored output | Development |
| `json` | Machine-readable JSON | CI/CD integration |
| `sarif` | SARIF 2.1.0 format | GitHub Code Scanning |

### Saving Reports to Files

Use the `output` option to save audit reports:

```typescript
superaudit: {
  mode: "full",
  format: "console",
  output: "./reports/audit-report.txt"  // Save console output to file
}
```

Or with environment variable:
```bash
SUPERAUDIT_OUTPUT=./reports/audit-report.txt
```

**Supported Output Files:**
- `.txt` - Console report (ANSI codes stripped)
- `.json` - JSON format with full issue details
- `.sarif` - SARIF format for GitHub integration

**Examples:**
```typescript
// Console output to file
superaudit: {
  format: "console",
  output: "./audit-report.txt"
}

// JSON output to file
superaudit: {
  format: "json",
  output: "./audit-results.json"
}

// SARIF for GitHub
superaudit: {
  format: "sarif",
  output: "./superaudit.sarif"
}
```

**File output benefits:**
- 📁 Keep historical audit records
- 📊 Compare audits over time
- 🔄 Share reports with team members
- 📋 Document security reviews for compliance

### AI Enhancement

Enable AI-powered vulnerability analysis:

```typescript
superaudit: {
  ai: {
    enabled: true,
    provider: "openai" | "anthropic" | "local",
    model: "gpt-4",  // or "gpt-3.5-turbo", "claude-3-sonnet"
    temperature: 0.3,  // Lower = more deterministic
    maxTokens: 1000  // Max response length
  }
}
```

**Benefits:**
- 🧠 Detailed vulnerability explanations
- 🔧 Automated fix suggestions with code examples
- ⚠️ Risk scoring (1-10 scale)
- 📚 Educational context and best practices

**Cost Estimates (OpenAI GPT-4):**
- Small project (10 issues): ~$0.30
- Medium project (50 issues): ~$1.50
- Large project (200 issues): ~$6.00

### Custom Playbooks

Use YAML playbooks for project-specific rules:

```yaml
# vault-audit.yaml
version: "1.0"
meta:
  name: "DeFi Vault Security"
  author: "Security Team"

checks:
  - id: "cei-enforcement"
    rule: "order.externalBefore(state=['balances','shares'])"
    severity: "critical"
```

Then reference in config:
```typescript
superaudit: {
  playbook: "./vault-audit.yaml"
}
```

## Examples

### Example 1: Quick CI Check
```typescript
superaudit: {
  mode: "basic",
  format: "json"
}
```

### Example 2: Full Audit with AI
```typescript
superaudit: {
  mode: "full",
  format: "console",
  ai: {
    enabled: true,
    provider: "openai"
  }
}
```

### Example 3: Specific Rules Only
```typescript
superaudit: {
  rules: ["no-tx-origin", "reentrancy-paths", "external-before-state"]
}
```

### Example 4: Custom Playbook + AI
```typescript
superaudit: {
  playbook: "./audits/defi-security.yaml",
  ai: {
    enabled: true,
    provider: "anthropic",
    model: "claude-3-opus"
  }
}
```

## GitHub Actions Integration

**.github/workflows/security.yml:**
```yaml
name: Security Audit

on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      # Quick check on every push
      - name: Fast Security Check
        run: |
          npm install
          npx hardhat --config hardhat.config.basic.ts superaudit
      
      # Full audit with AI on main branch
      - name: Full AI-Enhanced Audit
        if: github.ref == 'refs/heads/main'
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          SUPERAUDIT_AI_ENABLED: true
        run: npx hardhat superaudit
      
      # Upload SARIF results
      - name: Generate SARIF Report
        run: npx hardhat superaudit > results.sarif
      
      - uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: results.sarif
```

## Troubleshooting

### Issue: "No issues found" but expecting vulnerabilities
**Solution:** Use `mode: "full"` to enable CFG-based advanced rules.

### Issue: AI enhancement not working
**Solution:** 
1. Check `.env` has `SUPERAUDIT_AI_ENABLED=true`
2. Verify API key is set (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`)
3. Check API key has credits

### Issue: Analysis too slow
**Solution:** Use `mode: "basic"` for faster analysis (AST-only, skips CFG).

### Issue: Want to run different configs
**Solution:** Use `--config` flag to switch between config files:
```bash
npx hardhat --config hardhat.config.basic.ts superaudit
```

## Best Practices

1. **Development:** Use `mode: "basic"` for fast feedback
2. **Pre-commit:** Use `mode: "advanced"` for thorough local checks
3. **CI/CD:** Use `mode: "basic"` + `format: "json"` for fast builds
4. **Release:** Use `mode: "full"` + AI enhancement for comprehensive audits
5. **Cost Control:** Only enable AI for main/release branches in CI

## Support

For issues or questions:
- GitHub Issues: https://github.com/superaudit/hardhat-plugin/issues
- Documentation: See README.md
