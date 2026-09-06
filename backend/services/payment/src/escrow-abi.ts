import type { Abi } from "viem";

export const ESCROW_ABI = [
  {
    type: "constructor",
    inputs: [{ name: "operator_", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "DISPUTE_WINDOW",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "operator",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "deposits",
    stateMutability: "view",
    inputs: [{ name: "tripId", type: "bytes32" }],
    outputs: [
      { name: "payer", type: "address" },
      { name: "payee", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "state", type: "uint8" },
      { name: "settleFrom", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [
      { name: "tripId", type: "bytes32" },
      { name: "payee", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "startSettlement",
    stateMutability: "nonpayable",
    inputs: [{ name: "tripId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "dispute",
    stateMutability: "nonpayable",
    inputs: [{ name: "tripId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "finalize",
    stateMutability: "nonpayable",
    inputs: [{ name: "tripId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "tripId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resolve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tripId", type: "bytes32" },
      { name: "releaseToPayee", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "tripId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SettlementStarted",
    inputs: [
      { name: "tripId", type: "bytes32", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "settleFrom", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Disputed",
    inputs: [
      { name: "tripId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Released",
    inputs: [
      { name: "tripId", type: "bytes32", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Refunded",
    inputs: [
      { name: "tripId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const satisfies Abi;
