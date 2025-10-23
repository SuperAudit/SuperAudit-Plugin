// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/**
 * Example vulnerable vault contract to demonstrate SuperAudit's advanced analysis capabilities
 * 
 * This contract contains multiple deliberate security vulnerabilities:
 * 1. Reentrancy in withdraw function (CEI pattern violation)
 * 2. Unchecked external calls
 * 3. Missing access control
 * 4. Unreachable code 
 * 5. Poor naming conventions
 * 6. Missing visibility modifiers
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract VulnerableVault {
    IERC20 public token;
    
    // State variables without explicit visibility - VIOLATION
    mapping(address => uint256) userBalances;
    uint256 totalDeposits;
    address owner;
    bool paused;
    
    // Events
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    
    constructor(address _token) {
        token = IERC20(_token);
        owner = msg.sender;
    }
    
    /**
     * Deposit tokens into the vault
     * VULNERABILITY: External call before state update (not in this function, but sets up reentrancy)
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        
        // VULNERABILITY: Unchecked external call
        token.transferFrom(msg.sender, address(this), amount);
        
        userBalances[msg.sender] += amount;
        totalDeposits += amount;
        
        emit Deposit(msg.sender, amount);
    }
    
    /**
     * Withdraw tokens from the vault
     * CRITICAL VULNERABILITY: Reentrancy attack vector
     */
    function withdraw(uint256 amount) external {
        require(userBalances[msg.sender] >= amount, "Insufficient balance");
        require(amount > 0, "Amount must be positive");
        
        // VIOLATION: External call BEFORE state update (CEI pattern violation)
        // This allows reentrancy attacks!
        token.transfer(msg.sender, amount);
        
        // State updates happen AFTER external call - DANGEROUS!
        userBalances[msg.sender] -= amount;
        totalDeposits -= amount;
        
        emit Withdrawal(msg.sender, amount);
    }
    
    /**
     * Emergency withdrawal function
     * VULNERABILITY: Missing access control - anyone can call this!
     */
    function emergency_withdraw() external { // VIOLATION: snake_case naming
        require(!paused, "Contract is paused");
        
        uint256 balance = token.balanceOf(address(this));
        if (balance > 0) {
            // VULNERABILITY: Unchecked external call
            token.transfer(owner, balance);
        }
        
        // VULNERABILITY: Unreachable code due to return above
        if (false) {
            paused = true; // This code will never execute!
        }
        
        return; // Unnecessary return
        
        // VULNERABILITY: More unreachable code
        totalDeposits = 0;
    }
    
    /**
     * Administrative pause function
     * VULNERABILITY: Uses tx.origin instead of msg.sender
     */
    function pauseContract() external {
        // VULNERABILITY: tx.origin usage for authorization
        require(tx.origin == owner, "Not authorized");
        paused = true;
    }
    
    /**
     * Function with complex control flow to test CFG analysis
     */
    function complexWithdrawal(uint256 amount, bool useReentrancy) external {
        require(userBalances[msg.sender] >= amount, "Insufficient balance");
        
        if (useReentrancy) {
            // VIOLATION: External call before state update in conditional branch
            token.transfer(msg.sender, amount);
            userBalances[msg.sender] -= amount;
        } else {
            // Correct CEI pattern in this branch
            userBalances[msg.sender] -= amount;
            token.transfer(msg.sender, amount);
        }
        
        // This could be unreachable in some conditions
        if (amount > 1000000 ether) {
            revert("Amount too large");
            
            // VIOLATION: Unreachable code after revert
            totalDeposits -= amount;
        }
        
        emit Withdrawal(msg.sender, amount);
    }
    
    /**
     * Function demonstrating low-level call vulnerabilities
     */
    function dangerousCall(address target, bytes calldata data) external {
        // VULNERABILITY: Low-level call without access control
        // VULNERABILITY: No return value check
        target.call(data);
        
        // VULNERABILITY: delegatecall to arbitrary address
        target.delegatecall(data);
    }
    
    /**
     * Getter functions with naming violations
     */
    function GetUserBalance(address user) external view returns (uint256) { // VIOLATION: PascalCase function name
        return userBalances[user];
    }
    
    function get_total_deposits() external view returns (uint256) { // VIOLATION: snake_case function name
        return totalDeposits;
    }
    
    // VIOLATION: Private function with incorrect visibility
    function internal_calculation() public pure returns (uint256) { // Should be internal/private
        return 42;
    }
}

/**
 * Attacker contract to demonstrate reentrancy
 */
contract ReentrancyAttacker {
    VulnerableVault public vault;
    IERC20 public token;
    uint256 public attackAmount;
    
    constructor(address _vault, address _token) {
        vault = VulnerableVault(_vault);
        token = IERC20(_token);
    }
    
    function attack(uint256 amount) external {
        attackAmount = amount;
        
        // First, deposit some tokens
        token.transferFrom(msg.sender, address(this), amount);
        token.approve(address(vault), amount);
        vault.deposit(amount);
        
        // Then withdraw and trigger reentrancy
        vault.withdraw(amount);
    }
    
    // Fallback function for reentrancy
    receive() external payable {
        if (address(vault).balance >= attackAmount) {
            vault.withdraw(attackAmount);
        }
    }
    
    // Alternative callback for ERC20 transfers
    function onTokenTransfer(address, uint256, bytes calldata) external returns (bool) {
        if (token.balanceOf(address(vault)) >= attackAmount) {
            vault.withdraw(attackAmount);
        }
        return true;
    }
}
