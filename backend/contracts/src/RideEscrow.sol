// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RideEscrow
/// @notice Holds native Arc Testnet USDC for a trip until the operator releases
///         to the driver or refunds the rider. Rider signs once (deposit).
/// @dev Native USDC uses 18 decimals for msg.value. ERC-20 USDC at
///      0x3600000000000000000000000000000000000000 is 6 decimals of the same
///      asset (Circle use-arc). Do not hold or display both as separate funds.
contract RideEscrow {
    address public immutable operator;

    enum State {
        None,
        Locked,
        Released,
        Refunded
    }

    struct Deposit {
        address payer;
        address payee;
        uint256 amount;
        State state;
    }

    mapping(bytes32 => Deposit) public deposits;

    event Deposited(bytes32 indexed tripId, address indexed payer, address indexed payee, uint256 amount);
    event Released(bytes32 indexed tripId, address indexed payee, uint256 amount);
    event Refunded(bytes32 indexed tripId, address indexed payer, uint256 amount);

    error NotOperator();
    error InvalidDeposit();
    error AlreadyExists();
    error NotLocked();
    error TransferFailed();

    constructor(address operator_) {
        operator = operator_;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    function deposit(bytes32 tripId, address payee) external payable {
        if (payee == address(0) || msg.value == 0) revert InvalidDeposit();
        if (deposits[tripId].state != State.None) revert AlreadyExists();
        deposits[tripId] = Deposit({
            payer: msg.sender,
            payee: payee,
            amount: msg.value,
            state: State.Locked
        });
        emit Deposited(tripId, msg.sender, payee, msg.value);
    }

    function release(bytes32 tripId) external onlyOperator {
        Deposit storage item = deposits[tripId];
        if (item.state != State.Locked) revert NotLocked();
        item.state = State.Released;
        (bool ok, ) = item.payee.call{value: item.amount}("");
        if (!ok) revert TransferFailed();
        emit Released(tripId, item.payee, item.amount);
    }

    function refund(bytes32 tripId) external onlyOperator {
        Deposit storage item = deposits[tripId];
        if (item.state != State.Locked) revert NotLocked();
        item.state = State.Refunded;
        (bool ok, ) = item.payer.call{value: item.amount}("");
        if (!ok) revert TransferFailed();
        emit Refunded(tripId, item.payer, item.amount);
    }
}
