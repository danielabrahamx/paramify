import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "./insurance.did.js";

// Check if running in local development
const isLocalDevelopment = process.env.NODE_ENV !== "production";

// Canister IDs (will be replaced during deployment)
export const canisterId = process.env.REACT_APP_INSURANCE_CANISTER_ID || 
                          process.env.INSURANCE_CANISTER_ID ||
                          "be2us-64aaa-aaaaa-qaabq-cai"; // placeholder

// Create agent
const agent = new HttpAgent({
  host: isLocalDevelopment ? "http://localhost:4943" : "https://ic0.app",
});

// Fetch root key for local development
if (isLocalDevelopment) {
  agent.fetchRootKey().catch(err => {
    console.warn("Unable to fetch root key. Check to ensure that your local replica is running");
    console.error(err);
  });
}

// Create actor
export const insurance = Actor.createActor(idlFactory, {
  agent,
  canisterId,
});

// Export types for TypeScript
export { idlFactory };
export { _SERVICE } from "./insurance.did.d.ts";