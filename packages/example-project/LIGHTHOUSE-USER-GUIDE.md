# Lighthouse Community Storage - User Guide

## Overview

SuperAudit includes **automatic decentralized storage** for security playbooks using Lighthouse (IPFS). **No API key required!**

## Key Features

### 🌐 Shared Community Storage
- **Zero Setup**: Works out of the box, no registration needed
- **Decentralized**: Playbooks stored on IPFS, accessible to everyone
- **Community Driven**: Share playbooks with the entire SuperAudit community

### 🔒 Optional Private Storage
- Users can provide their own Lighthouse API key for private storage
- Set `LIGHTHOUSE_API_KEY` in your `.env` file

## How It Works

### Default Behavior (Recommended)
The plugin automatically uses a shared community Lighthouse account:

```bash
# Just run superaudit - Lighthouse works automatically!
npx hardhat superaudit
```

You'll see:
```
🌐 Using shared SuperAudit community Lighthouse storage
```

### Using Your Own API Key (Optional)

If you want private storage, add to `.env`:
```env
LIGHTHOUSE_API_KEY=your-api-key-here
```

You'll see:
```
🔑 Using custom Lighthouse API key from environment
```

## Usage Examples

### 1. Upload a Playbook to Community Storage

**Coming Soon**: Upload command will be available via Hardhat task parameters.

For now, playbooks are automatically synced when you run analysis.

### 2. Load Playbook from CID

Once playbooks are uploaded, anyone can use them:

```bash
# Load a specific playbook by its IPFS CID
npx hardhat superaudit --playbook-cid bafkreih...
```

### 3. List Available Community Playbooks

```bash
# See all playbooks in your registry (including community playbooks)
npx hardhat superaudit --list-playbooks
```

## Automatic Sync

Every time you run SuperAudit, it automatically:
1. Connects to shared Lighthouse storage
2. Syncs community playbooks to your local registry
3. Makes them available for your security analysis

```
✅ Loaded 5 shared playbook(s) from community
```

## Benefits

### For Users
- ✅ **No Setup Required**: Works immediately after installation
- ✅ **No Costs**: Free IPFS storage via shared account
- ✅ **No Registration**: No need to sign up for Lighthouse
- ✅ **Community Access**: Benefit from playbooks created by others

### For Contributors
- 📤 **Easy Sharing**: Upload playbooks to help the community
- 🌍 **Global Distribution**: IPFS ensures worldwide availability  
- 🔗 **Permanent Links**: CID-based addressing means playbooks never break
- 📊 **Transparent**: All community playbooks are publicly visible

## Security Considerations

### Shared Storage
- **Public by Default**: Playbooks uploaded to community storage are public
- **Read-Only Access**: Community members can download, not modify
- **Immutable**: Once uploaded, playbooks cannot be changed (CID-based)

### Private Storage
If you need private playbooks:
1. Get your own Lighthouse API key from [https://lighthouse.storage](https://lighthouse.storage)
2. Add `LIGHTHOUSE_API_KEY` to `.env`
3. Upload playbooks using your private account

## Technical Details

### Default API Key
- Managed by SuperAudit maintainers
- Shared across all plugin users
- Funded for community use
- Rate limits apply to fair usage

### IPFS Gateway
- Default: `https://gateway.lighthouse.storage/ipfs/`
- All playbooks accessible via standard IPFS gateways
- Content-addressable storage ensures integrity

## FAQ

**Q: Do I need to pay for Lighthouse?**
A: No! The plugin includes a shared community account at no cost.

**Q: Can I use my own Lighthouse account?**
A: Yes! Just set `LIGHTHOUSE_API_KEY` in your `.env` file.

**Q: Are my uploaded playbooks private?**
A: No, playbooks uploaded via the shared account are public. Use your own API key for privacy.

**Q: What if the shared API key runs out of credits?**
A: SuperAudit maintainers monitor and refill as needed. You can also use your own key.

**Q: Can I download playbooks without uploading?**
A: Yes! You can download and use any community playbook by its CID.

**Q: How do I get a CID to share my playbook?**  
A: Upload functionality via CLI coming soon. For now, use the registry API directly.

## Examples

### Download and Use a Community Playbook

```bash
# Someone shares a CID with you
CID="bafkreihldcnedjyea5jbfgzwkwie5jzjp6sr75mfndhxmvbofo4ep2oneu"

# Use it in your analysis
npx hardhat superaudit --playbook-cid $CID
```

### Check What's in Your Registry

```bash
npx hardhat superaudit --list-playbooks
```

Output:
```
📋 Registered Playbooks:

  🔸 erc20-security
     Name: ERC20 Token Security Audit
     Author: SuperAudit Community
     Source: lighthouse
     CID: bafkreih...

  🔸 defi-vault-security
     Name: DeFi Vault Security
     Author: SuperAudit Community  
     Source: lighthouse
     CID: bafybeif...

Total: 2 playbook(s)
```

## Contributing Playbooks

Want to share your security playbooks with the community?

1. Create your YAML playbook following the [Playbook Guide](PLAYBOOK-GUIDE.md)
2. Upload to community storage (CLI support coming soon)
3. Share the CID with other developers
4. Community members can use it instantly!

## Roadmap

- [ ] CLI command for direct playbook upload
- [ ] Playbook ratings and reviews
- [ ] Curated community playbook collections
- [ ] Integration with GitHub for automatic playbook discovery
- [ ] Playbook versioning and updates

## Support

Questions or issues with Lighthouse storage?
- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Open an issue on GitHub
- Join our community Discord

---

**Made with ❤️ by the SuperAudit Community**
