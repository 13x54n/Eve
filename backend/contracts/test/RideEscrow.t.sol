// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {RideEscrow} from "../src/RideEscrow.sol";
import {Test} from "forge-std/Test.sol";

contract RideEscrowTest is Test {
    RideEscrow internal escrow;
    address internal rider = address(0xB0B);
    address internal driver = address(0xD00D);
    address internal operator = address(0xA11CE);
    bytes32 internal tripId = keccak256("trip-1");

    function setUp() public {
        vm.deal(rider, 100 ether);
        escrow = new RideEscrow(operator);
    }

    function testDepositThenFinalizeAfterWindow() public {
        vm.prank(rider);
        escrow.deposit{value: 2 ether}(tripId, driver);
        assertEq(driver.balance, 0);

        vm.prank(driver);
        escrow.startSettlement(tripId);

        vm.expectRevert(RideEscrow.WindowOpen.selector);
        vm.prank(driver);
        escrow.finalize(tripId);

        vm.warp(block.timestamp + 5 minutes);
        vm.prank(driver);
        escrow.finalize(tripId);
        assertEq(driver.balance, 2 ether);
    }

    function testOperatorCanFinalizeAfterWindow() public {
        vm.prank(rider);
        escrow.deposit{value: 2 ether}(tripId, driver);
        vm.prank(driver);
        escrow.startSettlement(tripId);
        vm.warp(block.timestamp + 5 minutes);
        vm.prank(operator);
        escrow.finalize(tripId);
        assertEq(driver.balance, 2 ether);
    }

    function testDepositRefundBeforeSettlement() public {
        uint256 before = rider.balance;
        vm.prank(rider);
        escrow.deposit{value: 1 ether}(tripId, driver);
        vm.prank(rider);
        escrow.refund(tripId);
        assertEq(rider.balance, before);
    }

    function testDisputeThenOperatorRefund() public {
        uint256 before = rider.balance;
        vm.prank(rider);
        escrow.deposit{value: 1 ether}(tripId, driver);
        vm.prank(driver);
        escrow.startSettlement(tripId);
        vm.prank(rider);
        escrow.dispute(tripId);
        vm.expectRevert(RideEscrow.BadState.selector);
        vm.prank(rider);
        escrow.refund(tripId);
        vm.prank(operator);
        escrow.resolve(tripId, false);
        assertEq(rider.balance, before);
    }

    function testDisputeThenOperatorRelease() public {
        vm.prank(rider);
        escrow.deposit{value: 1 ether}(tripId, driver);
        vm.prank(driver);
        escrow.startSettlement(tripId);
        vm.prank(rider);
        escrow.dispute(tripId);
        vm.prank(operator);
        escrow.resolve(tripId, true);
        assertEq(driver.balance, 1 ether);
    }

    function testCannotDisputeAfterWindow() public {
        vm.prank(rider);
        escrow.deposit{value: 1 ether}(tripId, driver);
        vm.prank(driver);
        escrow.startSettlement(tripId);
        vm.warp(block.timestamp + 5 minutes);
        vm.expectRevert(RideEscrow.WindowClosed.selector);
        vm.prank(rider);
        escrow.dispute(tripId);
    }

    function testNonPayeeCannotStartSettlement() public {
        vm.prank(rider);
        escrow.deposit{value: 1 ether}(tripId, driver);
        vm.expectRevert(RideEscrow.NotPayee.selector);
        vm.prank(rider);
        escrow.startSettlement(tripId);
    }

    function testNonPayerCannotRefund() public {
        vm.prank(rider);
        escrow.deposit{value: 1 ether}(tripId, driver);
        vm.expectRevert(RideEscrow.NotPayer.selector);
        vm.prank(driver);
        escrow.refund(tripId);
    }

    function testCannotRefundWhileSettling() public {
        vm.prank(rider);
        escrow.deposit{value: 1 ether}(tripId, driver);
        vm.prank(driver);
        escrow.startSettlement(tripId);
        vm.expectRevert(RideEscrow.BadState.selector);
        vm.prank(rider);
        escrow.refund(tripId);
    }

    function testNonOperatorCannotResolve() public {
        vm.prank(rider);
        escrow.deposit{value: 1 ether}(tripId, driver);
        vm.prank(driver);
        escrow.startSettlement(tripId);
        vm.prank(rider);
        escrow.dispute(tripId);
        vm.expectRevert(RideEscrow.NotOperator.selector);
        vm.prank(driver);
        escrow.resolve(tripId, false);
    }

    function testRejectsZeroOperator() public {
        vm.expectRevert(RideEscrow.InvalidOperator.selector);
        new RideEscrow(address(0));
    }
}
