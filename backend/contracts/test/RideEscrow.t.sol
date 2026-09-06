// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {RideEscrow} from "../src/RideEscrow.sol";
import {Test} from "forge-std/Test.sol";

contract RideEscrowTest is Test {
    RideEscrow internal escrow;
    address internal operator = address(0xA11CE);
    address internal rider = address(0xB0B);
    address internal driver = address(0xD00D);
    bytes32 internal tripId = keccak256("trip-1");

    function setUp() public {
        vm.deal(rider, 100 ether);
        vm.prank(operator);
        escrow = new RideEscrow(operator);
    }

    function testDepositRelease() public {
        vm.prank(rider);
        escrow.deposit{value: 2 ether}(tripId, driver);
        assertEq(driver.balance, 0);
        vm.prank(operator);
        escrow.release(tripId);
        assertEq(driver.balance, 2 ether);
    }

    function testDepositRefund() public {
        uint256 before = rider.balance;
        vm.prank(rider);
        escrow.deposit{value: 1 ether}(tripId, driver);
        vm.prank(operator);
        escrow.refund(tripId);
        assertEq(rider.balance, before);
    }

    function testNonOperatorCannotRelease() public {
        vm.prank(rider);
        escrow.deposit{value: 1 ether}(tripId, driver);
        vm.expectRevert(RideEscrow.NotOperator.selector);
        vm.prank(rider);
        escrow.release(tripId);
    }
}
