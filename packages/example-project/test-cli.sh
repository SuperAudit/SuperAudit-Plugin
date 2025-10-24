#!/bin/bash
# Test Lighthouse Integration CLI Commands

echo "=== SuperAudit CLI Demo ==="
echo ""

cd "$(dirname "$0")"

echo "1. Running basic analysis with ERC20 playbook..."
npx hardhat superaudit
echo ""

echo "Demo complete!"
