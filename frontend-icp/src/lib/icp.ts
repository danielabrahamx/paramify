import { Principal } from "@dfinity/principal";
import { HttpAgent } from "@dfinity/agent";
import { Actor, ActorSubclass } from "@dfinity/agent";

// Mock authentication for local development
let mockPrincipal: Principal | null = null;
let mockPolicies: Map<string, any> = new Map();

export async function initializeAuth(): Promise<void> {
  // Mock initialization
}

export async function loginWithInternetIdentity(): Promise<Principal | null> {
  // Create a mock principal for testing
  mockPrincipal = Principal.fromText("rdmx6-jaaaa-aaaaa-aaadq-cai");
  return mockPrincipal;
}

export async function logoutFromInternetIdentity(): Promise<void> {
  mockPrincipal = null;
  mockPolicies.clear();
}

export function getCurrentPrincipal(): Principal | null {
  return mockPrincipal;
}

export function isAuthenticated(): boolean {
  return mockPrincipal !== null;
}

export function formatPrincipal(principal: Principal): string {
  const text = principal.toText();
  return text.length > 20 ? `${text.slice(0, 10)}...${text.slice(-6)}` : text;
}

export function isAdminPrincipal(principal: Principal): boolean {
  // For local testing, allow any principal to be admin
  return true;
}

// Mock ICP canister calls
export async function createPolicy(coverageAmount: number): Promise<{ success: boolean; policyId?: string }> {
  if (!mockPrincipal) {
    throw new Error("Not authenticated");
  }
  
  // Simulate canister call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const policyId = `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const policy = {
    id: policyId,
    principal: mockPrincipal.toText(),
    coverageAmount,
    premium: coverageAmount * 0.1,
    isActive: true,
    createdAt: new Date().toISOString(),
    thresholdExceeded: false
  };
  
  mockPolicies.set(policyId, policy);
  
  return { success: true, policyId };
}

export async function getPolicies(): Promise<any[]> {
  if (!mockPrincipal) {
    throw new Error("Not authenticated");
  }
  
  // Simulate canister call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return Array.from(mockPolicies.values()).filter(policy => 
    policy.principal === mockPrincipal!.toText()
  );
}

export async function claimPayout(policyId: string): Promise<{ success: boolean }> {
  if (!mockPrincipal) {
    throw new Error("Not authenticated");
  }
  
  const policy = mockPolicies.get(policyId);
  if (!policy) {
    throw new Error("Policy not found");
  }
  
  if (policy.principal !== mockPrincipal.toText()) {
    throw new Error("Unauthorized");
  }
  
  // Simulate canister call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mark policy as claimed
  policy.isActive = false;
  policy.claimedAt = new Date().toISOString();
  
  return { success: true };
}

export async function updateThreshold(thresholdFeet: number): Promise<{ success: boolean }> {
  // Simulate canister call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return { success: true };
}

export async function fundContract(amount: number): Promise<{ success: boolean }> {
  // Simulate canister call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return { success: true };
}
