// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ExampleToken - Minimal ERC20-like token for Demo
/// @notice Very small token used only for example/testing in the example-projec
contract ExampleToken {
    string public name = "ExampleToken";
    string public symbol = "EXT";
    uint8 public decimals = 18;

    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor(uint256 _initialSupply) {
        totalSupply = _initialSupply;
        balanceOf[msg.sender] = _initialSupply;
        emit Transfer(address(0), msg.sender, _initialSupply);
    }
    
    function transfer(address _to, uint256 _value) external returns (bool) {
        require(balanceOf[msg.sender] >= _value, "Insufficient balance");
        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    // Helper mint function for tests/demos only
    function mint(address _to, uint256 _value) external returns (bool) {
        totalSupply += _value;
        balanceOf[_to] += _value;
        emit Transfer(address(0), _to, _value);
        return true;
    }
}
