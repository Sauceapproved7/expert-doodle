// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice ERC-4337 v0.8 packed user operation shape.
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

interface IHerculesEntryPoint {
    function getNonce(address sender, uint192 key) external view returns (uint256);
    function depositTo(address account) external payable;
    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external;
}

/// @title Hercules Smart Account
/// @notice Owner-code-only ERC-4337 account foundation. Testnet deployment only until independent review.
contract HerculesSmartAccount {
    uint256 private constant SIG_VALIDATION_FAILED = 1;
    uint256 private constant SECP256K1_HALF_N =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    address public immutable owner;
    address public immutable entryPoint;

    error ZeroAddress();
    error Unauthorized(address caller);
    error InvalidSender(address sender);
    error ExecutionFailed(uint256 index, bytes reason);

    constructor(address owner_, address entryPoint_) {
        if (owner_ == address(0) || entryPoint_ == address(0)) revert ZeroAddress();
        owner = owner_;
        entryPoint = entryPoint_;
    }

    receive() external payable {}

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized(msg.sender);
        _;
    }

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert Unauthorized(msg.sender);
        _;
    }

    modifier onlyOwnerOrEntryPoint() {
        if (msg.sender != owner && msg.sender != entryPoint) revert Unauthorized(msg.sender);
        _;
    }

    function getNonce() external view returns (uint256) {
        return IHerculesEntryPoint(entryPoint).getNonce(address(this), 0);
    }

    function execute(address target, uint256 value, bytes calldata data)
        external
        onlyOwnerOrEntryPoint
        returns (bytes memory result)
    {
        (bool ok, bytes memory ret) = target.call{value: value}(data);
        if (!ok) revert ExecutionFailed(0, ret);
        return ret;
    }

    function executeBatch(address[] calldata targets, uint256[] calldata values, bytes[] calldata data)
        external
        onlyOwnerOrEntryPoint
    {
        uint256 length = targets.length;
        if (length != values.length || length != data.length) {
            revert ExecutionFailed(type(uint256).max, bytes("length mismatch"));
        }
        for (uint256 i = 0; i < length; i++) {
            (bool ok, bytes memory ret) = targets[i].call{value: values[i]}(data[i]);
            if (!ok) revert ExecutionFailed(i, ret);
        }
    }

    /// @notice Called only by the pinned EntryPoint during UserOperation validation.
    /// @dev Signature failure returns 1 instead of reverting, per ERC-4337 simulation rules.
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external onlyEntryPoint returns (uint256 validationData) {
        if (userOp.sender != address(this)) revert InvalidSender(userOp.sender);
        validationData = _recover(userOpHash, userOp.signature) == owner ? 0 : SIG_VALIDATION_FAILED;
        if (missingAccountFunds != 0) {
            // EntryPoint verifies prefund sufficiency. Ignore transfer failure here,
            // matching the ERC-4337 BaseAccount prefund behavior.
            (bool sent,) = payable(msg.sender).call{value: missingAccountFunds}("");
            sent;
        }
    }

    function addDeposit() external payable onlyOwner {
        IHerculesEntryPoint(entryPoint).depositTo{value: msg.value}(address(this));
    }

    function withdrawDepositTo(address payable recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        IHerculesEntryPoint(entryPoint).withdrawTo(recipient, amount);
    }

    function _recover(bytes32 digest, bytes calldata signature) internal pure returns (address signer) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (uint256(s) == 0 || uint256(s) > SECP256K1_HALF_N || uint256(r) == 0) return address(0);
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        signer = ecrecover(digest, v, r, s);
    }
}

/// @title Hercules Smart Account Factory
/// @notice Deterministic CREATE2 factory for HerculesSmartAccount.
contract HerculesSmartAccountFactory {
    address public immutable entryPoint;

    error ZeroAddress();
    event AccountCreated(address indexed account, address indexed owner, uint256 indexed salt);

    constructor(address entryPoint_) {
        if (entryPoint_ == address(0)) revert ZeroAddress();
        entryPoint = entryPoint_;
    }

    function createAccount(address owner, uint256 salt) external returns (HerculesSmartAccount account) {
        if (owner == address(0)) revert ZeroAddress();
        address predicted = getAddress(owner, salt);
        if (predicted.code.length != 0) return HerculesSmartAccount(payable(predicted));
        bytes32 create2Salt = keccak256(abi.encode(owner, salt));
        account = new HerculesSmartAccount{salt: create2Salt}(owner, entryPoint);
        emit AccountCreated(address(account), owner, salt);
    }

    function getAddress(address owner, uint256 salt) public view returns (address) {
        if (owner == address(0)) revert ZeroAddress();
        bytes32 create2Salt = keccak256(abi.encode(owner, salt));
        bytes memory creation = abi.encodePacked(
            type(HerculesSmartAccount).creationCode,
            abi.encode(owner, entryPoint)
        );
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), create2Salt, keccak256(creation))
        );
        return address(uint160(uint256(hash)));
    }
}
