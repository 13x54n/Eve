// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RideEscrow
/// @notice Holds native Arc Testnet USDC for a trip. The rider (payer) deposits;
///         the driver (payee) starts a 5-minute dispute window. If nobody disputes,
///         the operator (or payee) finalizes. A dispute freezes funds until the
///         operator resolves release or refund after reviewing the trip.
/// @dev Native USDC uses 18 decimals for msg.value. ERC-20 USDC at
///      0x3600000000000000000000000000000000000000 is 6 decimals of the same
///      asset (Circle use-arc). Do not hold or display both as separate funds.
contract RideEscrow {
    uint64 public constant DISPUTE_WINDOW = 5 minutes;

    enum State {
        None,
        Locked,
        Settling,
        Disputed,
        Released,
        Refunded
    }

    struct Deposit {
        address payer;
        address payee;
        uint256 amount;
        State state;
        uint64 settleFrom;
    }

    address public immutable operator;
    mapping(bytes32 => Deposit) public deposits;

    event Deposited(bytes32 indexed tripId, address indexed payer, address indexed payee, uint256 amount);
    event SettlementStarted(bytes32 indexed tripId, address indexed payee, uint64 settleFrom);
    event Disputed(bytes32 indexed tripId, address indexed payer);
    event Released(bytes32 indexed tripId, address indexed payee, uint256 amount);
    event Refunded(bytes32 indexed tripId, address indexed payer, uint256 amount);

    error NotPayer();
    error NotPayee();
    error NotOperator();
    error NotFinalizer();
    error InvalidDeposit();
    error InvalidOperator();
    error AlreadyExists();
    error BadState();
    error WindowOpen();
    error WindowClosed();
    error TransferFailed();

    constructor(address operator_) {
        if (operator_ == address(0)) revert InvalidOperator();
        operator = operator_;
    }

    function deposit(bytes32 tripId, address payee) external payable {
        if (payee == address(0) || msg.value == 0) revert InvalidDeposit();
        if (deposits[tripId].state != State.None) revert AlreadyExists();
        deposits[tripId] = Deposit({
            payer: msg.sender,
            payee: payee,
            amount: msg.value,
            state: State.Locked,
            settleFrom: 0
        });
        emit Deposited(tripId, msg.sender, payee, msg.value);
    }

    function startSettlement(bytes32 tripId) external {
        Deposit storage item = deposits[tripId];
        if (item.payee != msg.sender) revert NotPayee();
        if (item.state != State.Locked) revert BadState();
        uint64 settleFrom = uint64(block.timestamp) + DISPUTE_WINDOW;
        item.state = State.Settling;
        item.settleFrom = settleFrom;
        emit SettlementStarted(tripId, item.payee, settleFrom);
    }

    function dispute(bytes32 tripId) external {
        Deposit storage item = deposits[tripId];
        if (item.payer != msg.sender) revert NotPayer();
        if (item.state != State.Settling) revert BadState();
        if (block.timestamp >= item.settleFrom) revert WindowClosed();
        item.state = State.Disputed;
        emit Disputed(tripId, item.payer);
    }

    function finalize(bytes32 tripId) external {
        Deposit storage item = deposits[tripId];
        if (msg.sender != item.payee && msg.sender != operator) revert NotFinalizer();
        if (item.state != State.Settling) revert BadState();
        if (block.timestamp < item.settleFrom) revert WindowOpen();
        item.state = State.Released;
        (bool ok, ) = item.payee.call{value: item.amount}("");
        if (!ok) revert TransferFailed();
        emit Released(tripId, item.payee, item.amount);
    }

    function refund(bytes32 tripId) external {
        Deposit storage item = deposits[tripId];
        if (item.payer != msg.sender) revert NotPayer();
        if (item.state != State.Locked) revert BadState();
        item.state = State.Refunded;
        (bool ok, ) = item.payer.call{value: item.amount}("");
        if (!ok) revert TransferFailed();
        emit Refunded(tripId, item.payer, item.amount);
    }

    function resolve(bytes32 tripId, bool releaseToPayee) external {
        if (msg.sender != operator) revert NotOperator();
        Deposit storage item = deposits[tripId];
        if (item.state != State.Disputed) revert BadState();
        if (releaseToPayee) {
            item.state = State.Released;
            (bool ok, ) = item.payee.call{value: item.amount}("");
            if (!ok) revert TransferFailed();
            emit Released(tripId, item.payee, item.amount);
            return;
        }
        item.state = State.Refunded;
        (bool ok, ) = item.payer.call{value: item.amount}("");
        if (!ok) revert TransferFailed();
        emit Refunded(tripId, item.payer, item.amount);
    }
}
