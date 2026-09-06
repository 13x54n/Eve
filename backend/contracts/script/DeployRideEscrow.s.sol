// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {RideEscrow} from "../src/RideEscrow.sol";

/// Deploy with Foundry on Arc Testnet (https://docs.arc.io/arc/tutorials/deploy-on-arc):
/// forge create src/RideEscrow.sol:RideEscrow \
///   --rpc-url $ARC_TESTNET_RPC_URL \
///   --private-key $PRIVATE_KEY \
///   --broadcast \
///   --constructor-args $OPERATOR_ADDRESS
contract DeployRideEscrow is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address operator = vm.envAddress("OPERATOR_ADDRESS");
        vm.startBroadcast(key);
        RideEscrow escrow = new RideEscrow(operator);
        console.log("RideEscrow", address(escrow));
        vm.stopBroadcast();
    }
}
