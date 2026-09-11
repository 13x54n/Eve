// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {RideEscrow} from "../src/RideEscrow.sol";

/// Deploy with Foundry on Arc Testnet (https://docs.arc.io/arc/tutorials/deploy-on-arc).
/// Constructor takes the escrow operator (finalize after the window; resolve disputes).
contract DeployRideEscrow is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address operator = vm.envAddress("ESCROW_OPERATOR_ADDRESS");
        vm.startBroadcast(key);
        RideEscrow escrow = new RideEscrow(operator);
        console.log("RideEscrow", address(escrow));
        console.log("operator", operator);
        vm.stopBroadcast();
    }
}
