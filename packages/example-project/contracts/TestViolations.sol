// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Contract with intentional violations to test SuperAudit rules

contract badContract { // Violates contract naming (should be PascalCase)
    uint balance; // No explicit visibility - FLAGGED by explicit-visibility rule
    uint256 amount; // No explicit visibility - FLAGGED by explicit-visibility rule
    uint256 private goodAmount; // This one is OK
    
    function BadFunction() public { // Violates function naming (should be camelCase)
        // Using tx.origin for auth - security vulnerability
        if (tx.origin == msg.sender) {
            balance += 1;
        }
    }
    
    function transfer_tokens(address to, uint256 value) public { // Bad function naming
        // Some logic here
        require(tx.origin != address(0), "Invalid origin"); // Another tx.origin usage
    }
}

contract GoodContract { // Good PascalCase naming
    uint256 public balance; // Explicit visibility
    uint256 private amount; // Explicit visibility
    
    function transfer(address to, uint256 value) public { // Good camelCase naming
        // Using msg.sender instead of tx.origin - secure
        require(msg.sender != address(0), "Invalid sender");
        // Transfer logic...
    }
    
    function increaseBalance() external { // Good camelCase naming
        balance += 1;
    }
}
