// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {RideEscrow} from "../src/RideEscrow.sol";

/// Deploy with Foundry on Arc Testnet (https://docs.arc.io/arc/tutorials/deploy-on-arc).
/// Constructor takes no operator — payer/payee sign deposit, settlement, dispute, finalize, refund.
contract DeployRideEscrow is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(key);
        RideEscrow escrow = new RideEscrow();
        console.log("RideEscrow", address(escrow));
        vm.stopBroadcast();
    }
}
