// This file contains the deployed contract addresses and ABIs for the frontend to use
export const PARAMIFY_ADDRESS = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
export const MOCK_ORACLE_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
import PARAMIFY_ABI_JSON from "../../../paramify-abi.json";
import MOCK_ORACLE_ABI_JSON from "../../../mock-aggregator-abi.json";
export const PARAMIFY_ABI = PARAMIFY_ABI_JSON.abi as any;
export const MOCK_ORACLE_ABI = MOCK_ORACLE_ABI_JSON as any;
