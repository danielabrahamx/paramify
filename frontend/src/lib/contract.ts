// This file contains the deployed contract addresses and ABIs for the frontend to use
export const PARAMIFY_ADDRESS = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";
export const MOCK_ORACLE_ADDRESS = "0x0B306BF915C4d645ff596e518fAf3F9669b97016";
import PARAMIFY_ABI_JSON from "../../../paramify-abi.json";
import MOCK_ORACLE_ABI_JSON from "../../../mock-aggregator-abi.json";
export const PARAMIFY_ABI = PARAMIFY_ABI_JSON.abi as any;
export const MOCK_ORACLE_ABI = MOCK_ORACLE_ABI_JSON as any;
