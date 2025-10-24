# SuperAudit Payment System

## Setup

```bash
# 1. Start Anvil
anvil --fork-url https://eth-mainnet.g.alchemy.com/v2/demo --port 8545

# 2. Set platform keys
export PLATFORM_PUBLIC_KEY=""
export PLATFORM_PRIVATE_KEY=""
```

## Commands

### Upload Playbook

```bash
npx hardhat upload-playbook-encrypted \
  --file ./playbooks/ai-defi-security.yaml \
  --creator-public-key `any key form anvil` \
  --payment-amount 0.01
```

### Access Playbook

```bash
npx hardhat superaudit --playbook-cid <PLAYBOOK_CID>
```

## Test Accounts


## Payment Flow

1. **Upload**: Creator uploads encrypted playbook with payment info
2. **Access**: User runs `superaudit --playbook-cid <CID>`
3. **Keys**: Enter public/private keys for Lighthouse decryption
4. **Payment**: Choose Auto (1) or Manual (2) payment
   - **Auto**: Enter payment private key, system sends transaction
   - **Manual**: Send ETH manually, provide transaction hash
5. **Access**: System verifies payment and grants access