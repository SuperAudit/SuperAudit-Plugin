# Lighthouse Tasks - Quick Reference

## 📚 Available Commands

| Command | Purpose | Usage |
|---------|---------|-------|
| `lighthouse-info` | Show storage info and help | `npx hardhat lighthouse-info` |
| `upload-playbook` | Upload playbook to IPFS | `PLAYBOOK_FILE=./file.yaml npx hardhat upload-playbook` |
| `download-playbook` | Download playbook by CID | `PLAYBOOK_CID=bafkre... npx hardhat download-playbook` |
| `list-playbooks` | List all registered playbooks | `npx hardhat list-playbooks` |
| `sync-playbooks` | Sync community playbooks | `npx hardhat sync-playbooks` |

## 🚀 Quick Start

### 1. See What's Available
```bash
npx hardhat lighthouse-info
```

### 2. Upload a Playbook
```bash
PLAYBOOK_FILE=./playbooks/my-playbook.yaml npx hardhat upload-playbook
```

**Copy the CID from the output!**

### 3. Download a Playbook
```bash
PLAYBOOK_CID=bafkreih... npx hardhat download-playbook
```

### 4. List All Playbooks
```bash
npx hardhat list-playbooks
```

### 5. Use in Analysis
```bash
npx hardhat superaudit --playbook-cid bafkreih...
```

## 💡 Key Features

- **Zero Setup** - Works immediately, no API key needed
- **Community Sharing** - All uploads shared automatically
- **Permanent Storage** - Files stored forever on IPFS
- **Fast & Reliable** - Lighthouse gateway with caching

## 🔗 Integration with Analysis

Use uploaded/downloaded playbooks directly:

```bash
# By CID (recommended for sharing)
npx hardhat superaudit --playbook-cid bafkreih...

# By ID (for locally registered playbooks)
npx hardhat superaudit --playbook-id my-playbook

# By file path (traditional)
npx hardhat superaudit --playbook ./playbooks/my-playbook.yaml
```

## 🌐 Sharing Playbooks

1. Upload your playbook:
```bash
PLAYBOOK_FILE=./my-custom-playbook.yaml npx hardhat upload-playbook
```

2. Copy the CID from output (example):
```
bafkreifnhbl7m6jga6f24b7wiqo6iyrk46nuubdcpwx4bjhsvsps3otygy
```

3. Share the CID with your team

4. They can use it directly:
```bash
npx hardhat superaudit --playbook-cid bafkreifnhbl7m6jga6f24b7wiqo6iyrk46nuubdcpwx4bjhsvsps3otygy
```

No setup needed on their end!

## ⚡ Tips

- **No API Key Required** - The plugin uses shared community storage
- **Uploads are Public** - Anyone with the CID can access your playbook
- **CIDs are Permanent** - Content-addressed storage means your playbooks never disappear
- **Sync Regularly** - Run `sync-playbooks` to get the latest community playbooks
- **Custom Storage** - Want private storage? Add `LIGHTHOUSE_API_KEY` to your `.env`

## 🎯 Common Workflows

### Workflow 1: Team Collaboration
```bash
# Team Lead uploads playbook
PLAYBOOK_FILE=./team-playbook.yaml npx hardhat upload-playbook
# Shares CID: bafkreih...

# Team members use it
npx hardhat superaudit --playbook-cid bafkreih...
```

### Workflow 2: Community Contribution
```bash
# Create and upload your playbook
PLAYBOOK_FILE=./my-awesome-playbook.yaml npx hardhat upload-playbook

# Share CID on GitHub/Discord/Twitter
# Others benefit from your work!
```

### Workflow 3: Multi-Project Setup
```bash
# List all available playbooks
npx hardhat list-playbooks

# Pick one for your project
npx hardhat superaudit --playbook-id erc20-security

# Or download a specific one
PLAYBOOK_CID=bafkreih... npx hardhat download-playbook
```

## 🔧 Troubleshooting

### "Playbook file not found"
- Check the file path is correct
- Use relative paths from your current directory
- Example: `./playbooks/my-file.yaml` not just `my-file.yaml`

### "CID is required"
- Make sure you set the PLAYBOOK_CID environment variable
- Example: `PLAYBOOK_CID=bafkreih... npx hardhat download-playbook`

### "Upload failed"
- Check your internet connection
- Verify the YAML file is valid
- Try again (network issues are temporary)

### "No new playbooks to sync"
- This is normal! Means you're up to date
- Run again later to check for new community playbooks

---

**Need more help?** Run `npx hardhat lighthouse-info` for complete documentation!
