// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title VulnerableBondingCurve
 * @dev A deliberately vulnerable bonding curve contract for security testing
 * WARNING: This contract has multiple critical vulnerabilities. DO NOT USE IN PRODUCTION!
 */

interface IToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract VulnerableBondingCurve {
    IToken public token;
    address public owner;
    uint256 public reserveBalance;
    uint256 public tokenSupply;
    
    // VULNERABILITY #1: Uninitialized mapping - no explicit initialization
    mapping(address => uint256) public userBalances;
    
    // VULNERABILITY #2: Missing checks and events
    bool public paused = false;

    constructor(address _token) {
        token = IToken(_token);
        owner = msg.sender;
        reserveBalance = 0;
        tokenSupply = 1000000e18;
    }

    /**
     * VULNERABILITY #3: Reentrancy - external call before state update (CEI pattern violation)
     * VULNERABILITY #4: No access control - anyone can mint
     * VULNERABILITY #5: Arithmetic overflow not checked
     */
    function buy(uint256 amount) external payable {
        // CRITICAL: External call BEFORE state update
        token.transfer(msg.sender, amount);
        
        // State update AFTER external call - reentrancy window!
        userBalances[msg.sender] += amount;
        reserveBalance += msg.value;
        tokenSupply -= amount;
    }

    /**
     * VULNERABILITY #6: Reentrancy - call external contract before updating state
     * VULNERABILITY #7: Uses tx.origin for authorization (incorrect!)
     * VULNERABILITY #8: No checks for insufficient balance
     */
    function sell(uint256 amount) external {
        // VULNERABILITY: tx.origin check is wrong for delegatecall scenarios
        require(tx.origin == msg.sender, "Only EOA");
        
        // Calculate price naively - vulnerable to manipulation
        uint256 price = (reserveBalance * 1e18) / tokenSupply;
        uint256 payment = (amount * price) / 1e18;
        
        // CRITICAL: Send ETH BEFORE updating state - classic reentrancy!
        (bool success, ) = msg.sender.call{value: payment}("");
        require(success);
        
        // State update happens AFTER external call
        userBalances[msg.sender] -= amount;
        reserveBalance -= payment;
        tokenSupply += amount;
    }

    /**
     * VULNERABILITY #9: Unreachable code - will never execute
     * VULNERABILITY #10: Silent failure - function does nothing but returns
     */
    function withdraw() external {
        if (msg.sender == owner) {
            uint256 balance = address(this).balance;
            (bool success, ) = owner.call{value: balance}("");
            require(success);
        }
        return; // Everything below is unreachable
        
        // This code will never execute
        userBalances[msg.sender] = 0;
        reserveBalance = 0;
    }

    /**
     * VULNERABILITY #11: Self-destruct can be called by anyone
     * VULNERABILITY #12: State variable shadowing with local variable
     */
    function emergencyStop(address payable recipient) external {
        // VULNERABILITY: Local variable shadows state variable
        address owner = msg.sender;
        
        // Any address can call this!
        selfdestruct(recipient);
    }

    /**
     * VULNERABILITY #13: No visibility modifier (defaults to internal for state var, but function is dangerous)
     * VULNERABILITY #14: Direct state manipulation without validation
     */
    function resetReserve() external {
        // Missing access control check!
        reserveBalance = 0;
        tokenSupply = 1000000e18;
    }

    /**
     * VULNERABILITY #15: Unchecked external call result
     * VULNERABILITY #16: No reentrancy guard
     */
    function claimTokens(uint256 amount) external {
        require(userBalances[msg.sender] >= amount);
        
        // Call without checking return value
        token.transferFrom(address(this), msg.sender, amount);
        
        // State updated after external call
        userBalances[msg.sender] -= amount;
    }

    /**
     * VULNERABILITY #17: Integer underflow possibility (pre-0.8 would be critical)
     * VULNERABILITY #18: No event logging for state changes
     */
    function burn(uint256 amount) external {
        userBalances[msg.sender] -= amount; // Could underflow in Solidity <0.8
        tokenSupply -= amount;
        // No event emitted!
    }

    /**
     * VULNERABILITY #21: Integer overflow in price calculation
     * VULNERABILITY #22: Unsafe multiplication before division (precision loss)
     * VULNERABILITY #23: No validation for zero values
     */
    function getPriceWithMathBug(uint256 amount) external view returns (uint256) {
        // BUG: amount * reserveBalance can overflow before dividing by tokenSupply
        // Should be: (amount / tokenSupply) * reserveBalance
        uint256 price = (amount * reserveBalance) / tokenSupply;
        return price;
    }

    /**
     * VULNERABILITY #24: Division by zero vulnerability
     * VULNERABILITY #25: No zero check on tokenSupply
     */
    function calculatePrice(uint256 amount) external view returns (uint256) {
        // If tokenSupply is 0, this reverts (DoS attack vector)
        uint256 price = (amount * reserveBalance) / tokenSupply;
        return price;
    }

    /**
     * VULNERABILITY #26: Off-by-one error in loop
     * VULNERABILITY #27: Loop can be infinite if not careful
     * VULNERABILITY #28: No bounds checking on array access
     */
    uint256[] public priceHistory;
    
    function recordPrices(uint256[] calldata prices) external {
        // BUG: Loop might go out of bounds or have off-by-one
        for (uint256 i = 0; i <= prices.length; i++) { // <= instead of <
            priceHistory.push(prices[i]); // This will fail at i == prices.length
        }
    }

    /**
     * VULNERABILITY #29: Incorrect comparison operator
     * VULNERABILITY #30: Logic bypass with == instead of >= or <=
     */
    function buyWithFuzzyLogic(uint256 amount) external payable {
        // BUG: Using == instead of >= for validation
        // If msg.value is 1 wei more, transaction fails
        require(msg.value == amount * 1e18, "Exact payment required");
        
        token.transfer(msg.sender, amount);
        userBalances[msg.sender] += amount;
        reserveBalance += msg.value;
    }

    /**
     * VULNERABILITY #31: Rounding errors in calculations
     * VULNERABILITY #32: Loss of precision with integer division
     */
    function calculateBuyAmount(uint256 payment) external view returns (uint256) {
        // BUG: Division rounds down, attacker pays less than should
        uint256 amount = (payment * tokenSupply) / reserveBalance;
        // Rounding down means attacker gets slightly more tokens for their payment
        return amount;
    }

    /**
     * VULNERABILITY #33: Unsafe cast from uint256 to uint128
     * VULNERABILITY #34: Overflow in type casting
     */
    function storePrice(uint256 price) external {
        // BUG: Casting large price to uint128 causes overflow
        uint128 storedPrice = uint128(price); // Silent overflow if price > 2^128-1
        // storedPrice is now corrupted
    }

    /**
     * VULNERABILITY #35: Missing range validation
     * VULNERABILITY #36: No upper bounds check
     */
    uint256 public maxBuyAmount = type(uint256).max;
    
    function buyWithoutLimits(uint256 amount) external payable {
        // BUG: No validation that amount is reasonable
        // Attacker can buy 999999999999999999999 tokens with 1 wei
        require(amount > 0, "Amount must be positive");
        
        token.transfer(msg.sender, amount);
        userBalances[msg.sender] += amount;
        reserveBalance += msg.value;
    }

    /**
     * VULNERABILITY #37: Inconsistent state after failed transaction
     * VULNERABILITY #38: Partial execution leaves contract in broken state
     */
    function complexBuyAndBurn(uint256 buyAmount, uint256 burnAmount) external payable {
        // BUG: If token.transfer fails at line 2, state is partially updated
        userBalances[msg.sender] += buyAmount;  // Update 1
        token.transfer(msg.sender, buyAmount);  // External call - can fail!
        
        userBalances[msg.sender] -= burnAmount; // Update 2 - never executes if transfer fails
        tokenSupply -= burnAmount;              // Update 3 - never executes if transfer fails
    }

    /**
     * VULNERABILITY #39: Race condition with multiple state updates
     * VULNERABILITY #40: Incorrect order of operations allows exploitation
     */
    function atomicSwap(uint256 tokenAmount) external payable {
        // BUG: Multiple operations not atomic
        // Between these two calls, contract state is inconsistent
        uint256 price = (tokenAmount * reserveBalance) / tokenSupply;
        
        // Attacker could call buyWithFuzzyLogic here to manipulate price
        
        (bool success, ) = msg.sender.call{value: price}("");
        require(success);
        
        // Now update state (too late - race condition window!)
        userBalances[msg.sender] -= tokenAmount;
        tokenSupply += tokenAmount;
    }

    // VULNERABILITY #19: Fallback function allows funds to be sent with reentrancy implications
    fallback() external payable {
        reserveBalance += msg.value;
    }

    // VULNERABILITY #20: No pause mechanism despite paused variable existing
    receive() external payable {
        // Allows direct ETH transfers, perfect for reentrancy attacks
    }
}
