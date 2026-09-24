// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title Hercules Coin (HURC)
/// @notice Dependency-free ERC-20-compatible utility token for the Hercules ecosystem.
/// @dev The entire supply is created once at deployment and assigned to the treasury.
///      There is no owner role, no mint function, no upgrade hook, and no external code import.
contract HURC {
    string public constant name = "Hercules Coin";
    string public constant symbol = "HURC";
    uint8 public constant decimals = 18;

    uint256 public immutable totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error ZeroAddress();
    error ZeroSupply();
    error InsufficientBalance();
    error InsufficientAllowance();

    constructor(address treasury, uint256 initialSupplyWholeTokens) {
        if (treasury == address(0)) revert ZeroAddress();
        if (initialSupplyWholeTokens == 0) revert ZeroSupply();

        uint256 supply = initialSupplyWholeTokens * (10 ** uint256(decimals));
        totalSupply = supply;
        balanceOf[treasury] = supply;

        emit Transfer(address(0), treasury, supply);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 permitted = allowance[from][msg.sender];

        if (permitted != type(uint256).max) {
            if (permitted < value) revert InsufficientAllowance();
            unchecked {
                allowance[from][msg.sender] = permitted - value;
            }
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }

        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (to == address(0)) revert ZeroAddress();

        uint256 fromBalance = balanceOf[from];
        if (fromBalance < value) revert InsufficientBalance();

        unchecked {
            balanceOf[from] = fromBalance - value;
            balanceOf[to] += value;
        }

        emit Transfer(from, to, value);
    }
}
