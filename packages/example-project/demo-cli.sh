#!/bin/bash

# SuperAudit CLI Demo Script
# This script demonstrates the new CLI interface features

echo "🎨 SuperAudit CLI Interface Demo"
echo "================================="
echo ""
echo "This demo shows the new beautiful CLI interface for SuperAudit"
echo ""

# Check if we're in the right directory
if [ ! -f "hardhat.config.ts" ]; then
    echo "❌ Error: Please run this script from the example-project directory"
    echo "   cd packages/example-project"
    exit 1
fi

echo "📋 Available Demo Commands:"
echo ""
echo "1. Interactive Menu (Recommended!)"
echo "   npx hardhat superaudit-menu"
echo ""
echo "2. List Playbooks with New UI"
echo "   npx hardhat list-playbooks"
echo ""
echo "3. Run Analysis with Beautiful Output"
echo "   npx hardhat superaudit"
echo ""
echo "4. Show Lighthouse Info"
echo "   npx hardhat lighthouse-info"
echo ""
echo "5. Upload Playbook (Interactive)"
echo "   npx hardhat upload-playbook"
echo ""
echo "─────────────────────────────────────────────────────"
echo ""

# Ask user which demo to run
read -p "Which demo would you like to run? (1-5, or 'all' for quick showcase): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Launching Interactive Menu..."
        echo ""
        npx hardhat superaudit-menu
        ;;
    2)
        echo ""
        echo "📚 Listing Playbooks..."
        echo ""
        npx hardhat list-playbooks
        ;;
    3)
        echo ""
        echo "🔍 Running Security Analysis..."
        echo ""
        npx hardhat superaudit
        ;;
    4)
        echo ""
        echo "ℹ️  Showing Lighthouse Info..."
        echo ""
        npx hardhat lighthouse-info
        ;;
    5)
        echo ""
        echo "📤 Upload Playbook Demo..."
        echo ""
        echo "Note: You'll need to provide a playbook file path"
        npx hardhat upload-playbook
        ;;
    all)
        echo ""
        echo "🎬 Quick Showcase of All Features"
        echo "─────────────────────────────────────────────────────"
        echo ""
        
        echo "1️⃣  List Playbooks:"
        npx hardhat list-playbooks
        echo ""
        read -p "Press Enter to continue..."
        
        echo ""
        echo "2️⃣  Lighthouse Info:"
        npx hardhat lighthouse-info
        echo ""
        read -p "Press Enter to continue..."
        
        echo ""
        echo "3️⃣  Run Quick Analysis:"
        npx hardhat superaudit --mode basic
        echo ""
        
        echo "✅ Demo complete!"
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "✨ Demo Complete!"
echo ""
echo "💡 Tips:"
echo "   - Use 'npx hardhat superaudit-menu' for the best experience"
echo "   - All commands now have beautiful, color-coded output"
echo "   - Try different analysis modes: --mode basic|advanced|full"
echo "   - Enable AI with: --ai"
echo ""
echo "📚 Documentation: CLI-INTERFACE.md"
echo ""
