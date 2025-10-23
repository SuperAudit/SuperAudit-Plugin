# File Output Examples

SuperAudit now supports saving audit reports to files for documentation, compliance, and historical reference.

## Quick Examples

### 1. Console Report to Text File

**Configuration:**
```typescript
// hardhat.config.ts
superaudit: {
  format: "console",
  output: "./reports/audit-2024-10-23.txt"
}
```

**Result:**
- ✅ Creates `./reports/audit-2024-10-23.txt`
- Contains full console output (ANSI colors stripped)
- Perfect for human-readable reports

**Use Case:** Team reviews, documentation, compliance records

---

### 2. JSON Report to File

**Configuration:**
```typescript
// hardhat.config.ts
superaudit: {
  format: "json",
  output: "./reports/audit-results.json"
}
```

**Result:**
```json
{
  "summary": {
    "totalIssues": 21,
    "errorCount": 0,
    "warningCount": 16,
    "infoCount": 5
  },
  "issues": [
    {
      "ruleId": "no-tx-origin",
      "message": "Avoid using tx.origin...",
      "severity": "warning",
      "file": "./contracts/Vault.sol",
      "line": 105,
      "column": 16
    }
  ],
  "analysisTime": 5,
  "timestamp": "2024-10-23T22:12:00.000Z"
}
```

**Use Case:** CI/CD integration, automated reporting, metrics tracking

---

### 3. SARIF Report for GitHub

**Configuration:**
```typescript
// hardhat.config.ts
superaudit: {
  format: "sarif",
  output: "./superaudit.sarif"
}
```

**Result:**
- ✅ Creates GitHub-compatible SARIF 2.1.0 file
- Automatically integrates with GitHub Code Scanning
- Shows issues in Pull Request diffs

**Use Case:** GitHub Actions, security dashboards, CI/CD pipelines

---

## Environment Variable Configuration

You can also use environment variables:

```bash
# .env
SUPERAUDIT_FORMAT=console
SUPERAUDIT_OUTPUT=./reports/audit-report.txt
```

Or set them directly:
```bash
SUPERAUDIT_OUTPUT=./audit.json npx hardhat superaudit
```

---

## Real-World Workflow Examples

### Example 1: Daily CI Checks
```typescript
// hardhat.config.ci.ts
superaudit: {
  mode: "basic",
  format: "json",
  output: `./reports/ci-audit-${Date.now()}.json`
}
```

```bash
# GitHub Actions
npx hardhat --config hardhat.config.ci.ts superaudit
```

### Example 2: Pre-Release Audit
```typescript
// hardhat.config.release.ts
superaudit: {
  mode: "full",
  format: "console",
  output: "./reports/release-audit-v1.0.0.txt",
  ai: {
    enabled: true,
    provider: "openai"
  }
}
```

```bash
# Manual release audit
npx hardhat --config hardhat.config.release.ts superaudit
```

### Example 3: GitHub Integration
```yaml
# .github/workflows/security.yml
- name: Run SuperAudit
  run: |
    npx hardhat superaudit
  env:
    SUPERAUDIT_FORMAT: sarif
    SUPERAUDIT_OUTPUT: ./superaudit.sarif
    
- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: superaudit.sarif
```

---

## File Naming Best Practices

### With Timestamps
```typescript
output: `./reports/audit-${new Date().toISOString().split('T')[0]}.txt`
// Result: ./reports/audit-2024-10-23.txt
```

### With Version Numbers
```typescript
output: `./reports/audit-v${require('./package.json').version}.json`
// Result: ./reports/audit-v1.2.3.json
```

### With Git Commit
```bash
COMMIT=$(git rev-parse --short HEAD)
SUPERAUDIT_OUTPUT="./reports/audit-${COMMIT}.txt" npx hardhat superaudit
# Result: ./reports/audit-abc1234.txt
```

---

## Output File Features

| Format | File Extension | ANSI Colors | Size (typical) | GitHub Integration |
|--------|----------------|-------------|----------------|-------------------|
| Console | `.txt` | ❌ Stripped | 5-10 KB | ❌ |
| JSON | `.json` | ❌ | 8-15 KB | ⚠️ Manual |
| SARIF | `.sarif` | ❌ | 15-30 KB | ✅ Native |

---

## File Comparison Example

After running audits with different configurations:

```bash
# Generate multiple reports
SUPERAUDIT_OUTPUT=./audit-basic.txt SUPERAUDIT_MODE=basic npx hardhat superaudit
SUPERAUDIT_OUTPUT=./audit-full.txt SUPERAUDIT_MODE=full npx hardhat superaudit

# Compare reports
diff audit-basic.txt audit-full.txt
```

---

## Automatic File Extensions

SuperAudit automatically adds correct extensions if missing:

```typescript
output: "./report"  
// Console: ./report.txt
// JSON: ./report.json
// SARIF: ./report.sarif
```

Explicit extensions are preserved:
```typescript
output: "./my-audit-report.txt"  // ✅ Keeps .txt
```

---

## Tips & Tricks

### 1. Create Reports Directory Automatically
```bash
mkdir -p ./reports
SUPERAUDIT_OUTPUT=./reports/audit.txt npx hardhat superaudit
```

### 2. Combine Console + File Output
The plugin shows output **AND** saves to file simultaneously:
```typescript
superaudit: {
  format: "console",
  output: "./audit.txt"  // You see it AND it's saved!
}
```

### 3. Archive Old Reports
```bash
# Keep last 7 days of reports
find ./reports -name "audit-*.txt" -mtime +7 -delete
```

### 4. Parse JSON in Scripts
```bash
# Get issue count from JSON report
jq '.summary.totalIssues' ./audit-results.json
```

---

## Example: Complete Audit Workflow

```bash
#!/bin/bash
# audit-workflow.sh

# 1. Create reports directory
mkdir -p reports

# 2. Run basic audit (fast, for quick checks)
echo "Running basic audit..."
SUPERAUDIT_MODE=basic \
SUPERAUDIT_OUTPUT=./reports/audit-basic.txt \
npx hardhat superaudit

# 3. Run full audit with JSON output
echo "Running full audit..."
SUPERAUDIT_MODE=full \
SUPERAUDIT_FORMAT=json \
SUPERAUDIT_OUTPUT=./reports/audit-full.json \
npx hardhat superaudit

# 4. Run AI-enhanced audit
echo "Running AI-enhanced audit..."
SUPERAUDIT_AI_ENABLED=true \
SUPERAUDIT_OUTPUT=./reports/audit-ai-enhanced.txt \
npx hardhat superaudit

# 5. Generate summary
echo "Audit complete! Reports saved in ./reports/"
ls -lh ./reports/
```

---

## Next Steps

1. **Try it yourself:** Add `output: "./my-audit.txt"` to your config
2. **Automate:** Add SuperAudit to your CI/CD pipeline
3. **Track progress:** Save reports over time to measure improvements
4. **Share:** Send reports to team members or auditors

For more information, see:
- [USAGE.md](./USAGE.md) - Complete usage guide
- [QUICK-REFERENCE.md](./QUICK-REFERENCE.md) - Quick start guide
- [IMPLEMENTATION-SUMMARY.md](./IMPLEMENTATION-SUMMARY.md) - Technical details
