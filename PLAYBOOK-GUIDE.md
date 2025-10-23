# 📋 SuperAudit Playbook Guide

## Overview

SuperAudit now includes comprehensive YAML playbooks for auditing different types of smart contracts. These playbooks provide targeted security analysis with AI-enhanced explanations and fix suggestions.

---

## 🎯 Available Playbooks

### 1. **ERC20 Token Security** (`playbooks/erc20-token-security.yaml`)

**Purpose:** Comprehensive security analysis for ERC20 tokens

**Targets:** `*Token`, `Token*`, `ERC20*`

**Key Checks:**
- ✅ Arithmetic overflow/underflow protection
- ✅ Zero address validation
- ✅ Access control on mint/burn functions
- ✅ Balance and allowance checks
- ✅ Transfer function security
- ✅ Event emission compliance
- ✅ Return value standards
- ✅ Total supply consistency

**Critical Issues Detected:**
- 🔴 **Unprotected mint function** - Found in ExampleToken.sol!
- 🔴 Arithmetic overflow risks
- 🔴 Missing zero address checks
- 🟡 Missing error messages
- 🔵 Magic numbers in code

**Usage:**
```typescript
// hardhat.config.ts
superaudit: {
  playbook: "./playbooks/erc20-token-security.yaml"
}
```

---

### 2. **Vault Security** (`vault-security.yaml`)

**Purpose:** DeFi vault and strategy contract security analysis

**Targets:** `Vault*`, `Strategy*`, `*Vault`, `*Strategy`

**Key Checks:**
- ✅ Reentrancy protection in deposits/withdrawals
- ✅ CEI (Checks-Effects-Interactions) pattern
- ✅ ERC20 transfer safety
- ✅ Access control on critical functions
- ✅ Low-level call safety
- ✅ Value validation
- ✅ Balance consistency invariants

**Critical Issues:**
- 🔴 External calls before state updates
- 🔴 Unchecked transfer returns
- 🔴 Missing access control
- 🔴 Dangerous delegatecall

**Usage:**
```typescript
superaudit: {
  playbook: "./vault-security.yaml"
}
```

---

### 3. **Complete DeFi Security** (`playbooks/complete-defi-security.yaml`)

**Purpose:** Full-stack DeFi project audit (tokens + vaults + protocols)

**Targets:** All token and vault contracts in your project

**Key Checks:**
- ✅ All ERC20 token checks
- ✅ All vault security checks
- ✅ Cross-contract reentrancy
- ✅ Universal security patterns
- ✅ tx.origin authentication issues
- ✅ Missing events and documentation

**Advanced Features:**
- 🧪 Cross-contract attack scenarios
- 🧪 Token supply manipulation tests
- 🧪 Vault unauthorized access tests
- 🧪 10,000 fuzzing iterations
- 🧪 Invariant testing across contracts

**Usage:**
```typescript
superaudit: {
  playbook: "./playbooks/complete-defi-security.yaml"
}
```

---

### 4. **AI-Enhanced DeFi** (`playbooks/ai-defi-security.yaml`)

**Purpose:** AI-powered security analysis with detailed explanations

**Targets:** DeFi protocols with focus on common vulnerabilities

**AI Features:**
- 🤖 Detailed vulnerability explanations
- 🤖 Attack vector analysis
- 🤖 Financial impact assessment
- 🤖 Step-by-step fix instructions
- 🤖 Alternative secure patterns

**Usage:**
```typescript
superaudit: {
  playbook: "./playbooks/ai-defi-security.yaml",
  ai: {
    enabled: true,
    provider: "openai"
  }
}
```

---

## 🚀 Quick Start Examples

### Scan Your Token Contract

```bash
# Create hardhat.config.ts with:
superaudit: {
  mode: "full",
  playbook: "./playbooks/erc20-token-security.yaml"
}

# Run audit
npx hardhat superaudit
```

### Scan Your Vault Contract

```bash
# Use vault playbook
superaudit: {
  playbook: "./vault-security.yaml"
}

npx hardhat superaudit
```

### Complete Project Audit

```bash
# Scan everything
superaudit: {
  playbook: "./playbooks/complete-defi-security.yaml",
  output: "./reports/complete-audit.txt"
}

npx hardhat superaudit
```

---

## 📊 Example Audit Results

### ExampleToken.sol Audit Results

```
🔍 SuperAudit - Advanced Smart Contract Security Analysis

📋 Loading playbook: ./playbooks/erc20-token-security.yaml
📊 Analysis Mode: PLAYBOOK
🔧 Rules: 15 active rule(s)

📋 Static Analysis Report

ExampleToken.sol
  [CRITICAL] token-unprotected-mint at line 31
    Mint function is missing access control
    
    🔴 SEVERITY: CRITICAL
    💰 IMPACT: Unlimited token minting by anyone
    
    ⚠️ VULNERABILITY:
    The mint() function has no access control, allowing any address
    to mint unlimited tokens. This completely breaks token economics.
    
    🔧 FIX:
    Add OpenZeppelin Ownable and restrict mint to owner:
    
    import "@openzeppelin/contracts/access/Ownable.sol";
    
    contract ExampleToken is Ownable {
        function mint(address to, uint256 value) external onlyOwner {
            require(to != address(0), "ERC20: mint to zero address");
            totalSupply += value;
            balanceOf[to] += value;
            emit Transfer(address(0), to, value);
        }
    }

📊 Summary:
  Critical: 1
  High: 0
  Medium: 0
  Low: 2
  Total: 3 issues

💥 Critical issues detected - review required
```

---

## 🎨 Playbook Structure

### Basic Playbook Format

```yaml
version: "1.0"
meta:
  name: "Your Audit Name"
  description: "Audit description"
  ai:
    enabled: true
    provider: "openai"
    model: "gpt-4o-mini"

targets:
  contracts: ["*Token", "*Vault"]  # Patterns to match
  exclude: ["Test*", "Mock*"]       # Patterns to exclude

checks:
  - id: "check-identifier"
    rule: "rule.pattern()"
    severity: "critical"
    description: "What this check does"
    ai_prompt: |
      Detailed AI instructions for analysis
    mitigation: |
      How to fix this issue

dynamic:
  scenarios:
    - name: "test-scenario"
      steps: [...]
      assert: [...]
  
  invariants:
    - id: "invariant-check"
      expression: "mathematical expression"
      
  fuzzing:
    runs: 10000
    targets: ["function signatures"]
```

---

## 🔧 Customizing Playbooks

### Create Your Own Playbook

1. **Copy existing playbook:**
```bash
cp playbooks/erc20-token-security.yaml playbooks/my-custom-audit.yaml
```

2. **Modify targets:**
```yaml
targets:
  contracts: ["MyContract", "*Special"]
  exclude: ["TestHelper"]
```

3. **Add custom checks:**
```yaml
checks:
  - id: "my-custom-check"
    rule: "pattern.myPattern()"
    severity: "high"
    description: "Check for my specific vulnerability"
```

4. **Use it:**
```typescript
superaudit: {
  playbook: "./playbooks/my-custom-audit.yaml"
}
```

---

## 📈 Playbook Features Comparison

| Feature | ERC20 Token | Vault | Complete DeFi | AI DeFi |
|---------|-------------|-------|---------------|---------|
| Token Security | ✅ | ❌ | ✅ | ✅ |
| Vault Security | ❌ | ✅ | ✅ | ✅ |
| Access Control | ✅ | ✅ | ✅ | ✅ |
| Reentrancy | ✅ | ✅ | ✅ | ✅ |
| AI Analysis | ✅ | ❌ | ✅ | ✅ |
| Dynamic Tests | ✅ | ✅ | ✅ | ❌ |
| Fuzzing | ✅ 5K | ✅ 1K | ✅ 10K | ❌ |
| Cross-Contract | ❌ | ❌ | ✅ | ❌ |

---

## 🎯 Best Practices

### 1. **Start with Specific Playbooks**
```bash
# First audit tokens
superaudit: { playbook: "./playbooks/erc20-token-security.yaml" }

# Then audit vaults
superaudit: { playbook: "./vault-security.yaml" }

# Finally run complete audit
superaudit: { playbook: "./playbooks/complete-defi-security.yaml" }
```

### 2. **Enable AI for Critical Projects**
```typescript
superaudit: {
  playbook: "./playbooks/erc20-token-security.yaml",
  ai: {
    enabled: true,
    provider: "openai",
    model: "gpt-4o-mini"  // Cost-effective
  }
}
```

### 3. **Save Reports for Documentation**
```typescript
superaudit: {
  playbook: "./playbooks/complete-defi-security.yaml",
  format: "console",
  output: `./reports/audit-${Date.now()}.txt`
}
```

### 4. **Use Multiple Playbooks in CI/CD**
```bash
# GitHub Actions workflow
- name: Token Audit
  run: npx hardhat superaudit
  env:
    SUPERAUDIT_PLAYBOOK: ./playbooks/erc20-token-security.yaml
    
- name: Vault Audit
  run: npx hardhat superaudit
  env:
    SUPERAUDIT_PLAYBOOK: ./vault-security.yaml
```

---

## 🐛 Common Issues Found

### In ExampleToken.sol

1. **🔴 CRITICAL: Unprotected mint()**
   - Anyone can mint unlimited tokens
   - Fix: Add access control

2. **🟡 MEDIUM: Missing error messages**
   - Require statements lack descriptions
   - Fix: Add meaningful error strings

### In VulnerableVault.sol

1. **🔴 CRITICAL: Reentrancy in withdraw**
   - External call before state update
   - Fix: Follow CEI pattern

2. **🔴 CRITICAL: tx.origin authentication**
   - Using tx.origin instead of msg.sender
   - Fix: Use msg.sender

---

## 📚 Additional Resources

- **USAGE.md** - Complete usage guide
- **FILE-OUTPUT-EXAMPLES.md** - Report generation examples
- **QUICK-REFERENCE.md** - Quick start guide
- **README.md** - Full project documentation

---

## 🎉 Summary

SuperAudit playbooks provide:
- ✅ Targeted security analysis for specific contract types
- ✅ AI-enhanced vulnerability explanations
- ✅ Automatic fix suggestions with code examples
- ✅ Dynamic testing scenarios
- ✅ Comprehensive fuzzing campaigns
- ✅ Professional audit reports

**Your contracts are now protected with enterprise-grade security analysis!** 🛡️
