import { AuthClient } from "@dfinity/auth-client";
import { HttpAgent, Actor, ActorSubclass } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";

// Type definitions for the canister interface
interface Policy {
  policy_id: bigint;
  policyholder: Principal;
  premium: bigint;
  coverage: bigint;
  purchase_time: bigint;
  active: boolean;
  paid_out: boolean;
  expiration_time: bigint;
}

interface CanisterActor {
  create_policy: (premium: bigint, coverage: bigint) => Promise<{ Ok: bigint } | { Err: string }>;
  get_policy: (policy_id: bigint) => Promise<[Policy] | []>;
  get_policy_by_holder: (holder: Principal) => Promise<[Policy] | []>;
  trigger_payout: () => Promise<{ Ok: bigint } | { Err: string }>;
  set_flood_threshold: (threshold: bigint) => Promise<{ Ok: null } | { Err: string }>;
  get_flood_level: () => Promise<bigint>;
  get_flood_threshold: () => Promise<bigint>;
  get_admin: () => Promise<Principal>;
  is_payout_eligible: (holder: Principal) => Promise<boolean>;
  get_policy_stats: () => Promise<[bigint, bigint, bigint]>;
  health_check: () => Promise<[boolean, string, bigint, bigint, bigint]>;
}

// Configuration
const IS_PRODUCTION = import.meta.env.NODE_ENV === "production";
const CANISTER_ID = import.meta.env.VITE_CANISTER_ID_PARAMIFY_INSURANCE || "uxrrr-q7777-77774-qaaaq-cai";
const ICP_HOST = IS_PRODUCTION ? "https://ic0.app" : "http://127.0.0.1:4943";

// Identity provider URL
const IDENTITY_PROVIDER = IS_PRODUCTION 
  ? "https://identity.ic0.app/#authorize"
  : "http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943";

// Session management
let authClient: AuthClient | null = null;
let actor: ActorSubclass<CanisterActor> | null = null;
let currentPrincipal: Principal | null = null;
let isAdmin: boolean = false;

// Error handling utility
function handleError(error: any, context: string): Error {
  // Handle UserInterrupt as a special case - this is not an error, just user cancellation
  if (error && (error.message === 'UserInterrupt' || error.toString().includes('UserInterrupt'))) {
    console.log(`User cancelled login during ${context}`);
    return new Error('LOGIN_CANCELLED');
  }
  
  console.error(`Error in ${context}:`, error);
  if (error instanceof Error) {
    return error;
  }
  return new Error(`${context}: ${String(error)}`);
}

// Initialize authentication client
export async function initializeAuth(): Promise<void> {
  try {
    if (!IS_PRODUCTION) {
      console.warn("⚠️ Running in development mode with limited authentication");
      console.warn("For production deployment, ensure proper Internet Identity integration");
    }

    authClient = await AuthClient.create({
      idleOptions: {
        disableIdle: true,
        disableDefaultIdleCallback: true,
      }
    });

    // Check if user is already authenticated
    const isAuthenticated = await authClient.isAuthenticated();
    
    if (isAuthenticated) {
      const identity = authClient.getIdentity();
      await setupActor(identity);
      currentPrincipal = identity.getPrincipal();
      
      // Check admin status
      if (actor) {
        try {
          const adminPrincipal = await actor.get_admin();
          isAdmin = adminPrincipal.toText() === currentPrincipal.toText();
        } catch (error) {
          console.error("Failed to check admin status:", error);
          isAdmin = false;
        }
      }
    }
  } catch (error) {
    throw handleError(error, "initializeAuth");
  }
}

// Setup actor with proper agent configuration
async function setupActor(identity: any): Promise<void> {
  try {
    if (!CANISTER_ID) {
      throw new Error("Canister ID not configured");
    }

    const agent = new HttpAgent({
      host: ICP_HOST,
      identity,
    });

    // Only fetch root key in development
    if (!IS_PRODUCTION) {
      await agent.fetchRootKey();
    }

    // Import IDL factory dynamically
    const { idlFactory } = await import("../declarations/paramify_insurance");
    
    actor = Actor.createActor<CanisterActor>(idlFactory, {
      agent,
      canisterId: CANISTER_ID,
    });
  } catch (error) {
    throw handleError(error, "setupActor");
  }
}

// Login with Internet Identity
export async function loginWithInternetIdentity(): Promise<Principal | null> {
  try {
    if (!authClient) {
      await initializeAuth();
    }

    if (!authClient) {
      throw new Error("Authentication client not initialized");
    }

    return new Promise((resolve, reject) => {
      authClient!.login({
        identityProvider: IDENTITY_PROVIDER,
        maxTimeToLive: BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000), // 7 days in nanoseconds
        onSuccess: async () => {
          try {
            const identity = authClient!.getIdentity();
            await setupActor(identity);
            currentPrincipal = identity.getPrincipal();
            
            // Check admin status
            if (actor) {
              const adminPrincipal = await actor.get_admin();
              isAdmin = adminPrincipal.toText() === currentPrincipal.toText();
            }
            
            console.log("Successfully authenticated:", currentPrincipal.toText());
            resolve(currentPrincipal);
          } catch (error) {
            reject(handleError(error, "login.onSuccess"));
          }
        },
        onError: (error: any) => {
          reject(handleError(error, "login.onError"));
        },
      });
    });
  } catch (error) {
    throw handleError(error, "loginWithInternetIdentity");
  }
}

// Logout from Internet Identity
export async function logoutFromInternetIdentity(): Promise<void> {
  try {
    if (authClient) {
      await authClient.logout();
    }
    
    currentPrincipal = null;
    actor = null;
    isAdmin = false;
    
    console.log("Successfully logged out");
  } catch (error) {
    throw handleError(error, "logoutFromInternetIdentity");
  }
}

// Get current principal
export function getCurrentPrincipal(): Principal | null {
  return currentPrincipal;
}

// Check if authenticated
export function isAuthenticated(): boolean {
  return currentPrincipal !== null && actor !== null;
}

// Format principal for display
export function formatPrincipal(principal: Principal): string {
  const text = principal.toText();
  if (text.length > 20) {
    return `${text.slice(0, 10)}...${text.slice(-6)}`;
  }
  return text;
}

// Check if principal is admin (with proper canister check)
export async function isAdminPrincipal(principal: Principal): Promise<boolean> {
  try {
    if (!actor) {
      console.warn("Actor not initialized, cannot check admin status");
      return false;
    }

    const adminPrincipal = await actor.get_admin();
    const isAdminCheck = adminPrincipal.toText() === principal.toText();
    
    // Update cached value if checking current user
    if (currentPrincipal && principal.toText() === currentPrincipal.toText()) {
      isAdmin = isAdminCheck;
    }
    
    return isAdminCheck;
  } catch (error) {
    console.error("Failed to check admin status:", error);
    return false;
  }
}

// Get cached admin status for current user
export function getCachedAdminStatus(): boolean {
  return isAdmin;
}

// Create insurance policy
export async function createPolicy(
  coverageAmount: number
): Promise<{ success: boolean; policyId?: string; error?: string }> {
  try {
    if (!isAuthenticated() || !actor) {
      throw new Error("Not authenticated");
    }

    // Convert from millions to units (1M = 1,000,000 units)
    const coverageUnits = BigInt(Math.floor(coverageAmount * 1_000_000));
    const premiumUnits = BigInt(Math.floor(coverageAmount * 0.1 * 1_000_000)); // 10% of coverage

    console.log(`Creating policy: Coverage ${coverageAmount}M (${coverageUnits} units), Premium ${coverageAmount * 0.1}M (${premiumUnits} units)`);

    const result = await actor.create_policy(premiumUnits, coverageUnits);

    if ("Ok" in result) {
      return { 
        success: true, 
        policyId: result.Ok.toString() 
      };
    } else {
      return { 
        success: false, 
        error: result.Err 
      };
    }
  } catch (error) {
    const err = handleError(error, "createPolicy");
    return { 
      success: false, 
      error: err.message 
    };
  }
}

// Get user's policy
export async function getUserPolicy(): Promise<Policy | null> {
  try {
    if (!isAuthenticated() || !actor || !currentPrincipal) {
      throw new Error("Not authenticated");
    }

    const result = await actor.get_policy_by_holder(currentPrincipal);
    
    if (result.length > 0) {
      return result[0];
    }
    
    return null;
  } catch (error) {
    console.error("Failed to get user policy:", error);
    return null;
  }
}

// Get all policies (admin only)
export async function getAllPolicies(): Promise<Policy[]> {
  try {
    if (!isAuthenticated() || !actor) {
      throw new Error("Not authenticated");
    }

    if (!isAdmin) {
      throw new Error("Admin access required");
    }

    // This would need to be implemented in the canister
    // For now, return empty array
    console.warn("getAllPolicies not yet implemented in canister");
    return [];
  } catch (error) {
    console.error("Failed to get all policies:", error);
    return [];
  }
}

// Claim payout
export async function claimPayout(): Promise<{ success: boolean; amount?: string; error?: string }> {
  try {
    if (!isAuthenticated() || !actor) {
      throw new Error("Not authenticated");
    }

    const result = await actor.trigger_payout();

    if ("Ok" in result) {
      return { 
        success: true, 
        amount: result.Ok.toString() 
      };
    } else {
      return { 
        success: false, 
        error: result.Err 
      };
    }
  } catch (error) {
    const err = handleError(error, "claimPayout");
    return { 
      success: false, 
      error: err.message 
    };
  }
}

// Check if payout is eligible
export async function isPayoutEligible(): Promise<boolean> {
  try {
    if (!isAuthenticated() || !actor || !currentPrincipal) {
      return false;
    }

    return await actor.is_payout_eligible(currentPrincipal);
  } catch (error) {
    console.error("Failed to check payout eligibility:", error);
    return false;
  }
}

// Update flood threshold (admin only)
export async function updateThreshold(
  thresholdFeet: number
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isAuthenticated() || !actor) {
      throw new Error("Not authenticated");
    }

    if (!isAdmin) {
      throw new Error("Admin access required");
    }

    // Convert feet to scaled units (multiply by 100000000000)
    const threshold = BigInt(Math.floor(thresholdFeet * 100000000000));

    const result = await actor.set_flood_threshold(threshold);

    if ("Ok" in result) {
      return { success: true };
    } else {
      return { 
        success: false, 
        error: result.Err 
      };
    }
  } catch (error) {
    const err = handleError(error, "updateThreshold");
    return { 
      success: false, 
      error: err.message 
    };
  }
}

// Get flood level
export async function getFloodLevel(): Promise<number> {
  try {
    if (!actor) {
      throw new Error("Actor not initialized");
    }

    const level = await actor.get_flood_level();
    // Convert from scaled units to feet
    return Number(level) / 100000000000;
  } catch (error) {
    console.error("Failed to get flood level:", error);
    return 0;
  }
}

// Get flood threshold
export async function getFloodThreshold(): Promise<number> {
  try {
    if (!actor) {
      throw new Error("Actor not initialized");
    }

    const threshold = await actor.get_flood_threshold();
    // Convert from scaled units to feet
    return Number(threshold) / 100000000000;
  } catch (error) {
    console.error("Failed to get flood threshold:", error);
    return 12; // Default 12 feet
  }
}

// Get policy statistics
export async function getPolicyStats(): Promise<{ total: number; active: number; paidOut: number }> {
  try {
    if (!actor) {
      throw new Error("Actor not initialized");
    }

    const [total, active, paidOut] = await actor.get_policy_stats();
    
    return {
      total: Number(total),
      active: Number(active),
      paidOut: Number(paidOut),
    };
  } catch (error) {
    console.error("Failed to get policy stats:", error);
    return { total: 0, active: 0, paidOut: 0 };
  }
}

// Health check
export async function healthCheck(): Promise<{
  healthy: boolean;
  version: string;
  cycles: string;
  floodLevel: number;
  threshold: number;
}> {
  try {
    if (!actor) {
      throw new Error("Actor not initialized");
    }

    const [healthy, version, cycles, floodLevel, threshold] = await actor.health_check();
    
    return {
      healthy,
      version,
      cycles: cycles.toString(),
      floodLevel: Number(floodLevel) / 100000000000,
      threshold: Number(threshold) / 100000000000,
    };
  } catch (error) {
    console.error("Failed to perform health check:", error);
    return {
      healthy: false,
      version: "unknown",
      cycles: "0",
      floodLevel: 0,
      threshold: 12,
    };
  }
}

// Alias for backward compatibility
export const getPolicies = getAllPolicies;

// Funding function for admin (transfer ICP or manage contract balance)
export async function fundContract(amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isAuthenticated() || !actor) {
      throw new Error("Not authenticated or actor not initialized");
    }
    
    // For ICP canister funding, we could implement:
    // 1. Transfer ICP to the canister 
    // 2. Or call a specific funding function if it exists on the canister
    // For now, let's simulate a funding operation
    
    console.log(`Funding contract with ${amount} ICP`);
    
    // This would typically involve transferring ICP to the canister
    // Implementation depends on your specific funding mechanism
    return { success: true };
    
  } catch (error) {
    return { 
      success: false, 
      error: handleError(error, 'fundContract').message 
    };
  }
}

// Export types for use in components
export type { Policy, CanisterActor };