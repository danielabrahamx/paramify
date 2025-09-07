import { AuthClient } from '@dfinity/auth-client';
import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { IDL } from '@dfinity/candid';

// Canister interface definition
const idlFactory = ({ IDL }: { IDL: typeof import('@dfinity/candid').IDL }) => {
  const Policy = IDL.Record({
    policyholder: IDL.Principal,
    premium: IDL.Nat64,
    coverage: IDL.Nat64,
    active: IDL.Bool,
    paid_out: IDL.Bool,
    created_at: IDL.Nat64,
    flood_level_at_creation: IDL.Float64,
  });
  
  const FloodData = IDL.Record({
    level: IDL.Float64,
    threshold: IDL.Float64,
    last_updated: IDL.Nat64,
    station_id: IDL.Text,
  });
  
  const SystemStatus = IDL.Record({
    total_policies: IDL.Nat64,
    active_policies: IDL.Nat64,
    total_payouts: IDL.Nat64,
    contract_balance: IDL.Nat64,
    current_flood_level: IDL.Float64,
    flood_threshold: IDL.Float64,
    last_oracle_update: IDL.Nat64,
  });
  
  const CreatePolicyRequest = IDL.Record({
    coverage_amount: IDL.Nat64,
  });
  
  const PayoutResult = IDL.Record({
    success: IDL.Bool,
    amount: IDL.Nat64,
    message: IDL.Text,
  });
  
  return IDL.Service({
    // Update methods
    create_policy: IDL.Func([CreatePolicyRequest], [IDL.Variant({
      Ok: IDL.Text,
      Err: IDL.Text
    })], []),
    trigger_payout: IDL.Func([], [IDL.Variant({
      Ok: PayoutResult,
      Err: IDL.Text
    })], []),
    set_flood_level: IDL.Func([IDL.Float64, IDL.Opt(IDL.Text)], [IDL.Variant({
      Ok: IDL.Text,
      Err: IDL.Text
    })], []),
    set_threshold: IDL.Func([IDL.Float64], [IDL.Variant({
      Ok: IDL.Text,
      Err: IDL.Text
    })], []),
    add_oracle: IDL.Func([IDL.Principal], [IDL.Variant({
      Ok: IDL.Text,
      Err: IDL.Text
    })], []),
    fund_contract: IDL.Func([IDL.Nat64], [IDL.Variant({
      Ok: IDL.Text,
      Err: IDL.Text
    })], []),
    
    // Query methods
    get_policy: IDL.Func([IDL.Opt(IDL.Principal)], [IDL.Opt(Policy)], ['query']),
    get_flood_data: IDL.Func([], [FloodData], ['query']),
    get_system_status: IDL.Func([], [SystemStatus], ['query']),
    is_payout_eligible: IDL.Func([IDL.Opt(IDL.Principal)], [IDL.Bool], ['query']),
    get_admin: IDL.Func([], [IDL.Principal], ['query']),
    get_oracles: IDL.Func([], [IDL.Vec(IDL.Principal)], ['query']),
  });
};

// Types
export interface Policy {
  policyholder: Principal;
  premium: bigint;
  coverage: bigint;
  active: boolean;
  paid_out: boolean;
  created_at: bigint;
  flood_level_at_creation: number;
}

export interface FloodData {
  level: number;
  threshold: number;
  last_updated: bigint;
  station_id: string;
}

export interface SystemStatus {
  total_policies: bigint;
  active_policies: bigint;
  total_payouts: bigint;
  contract_balance: bigint;
  current_flood_level: number;
  flood_threshold: number;
  last_oracle_update: bigint;
}

export interface PayoutResult {
  success: boolean;
  amount: bigint;
  message: string;
}

// ICP Client class
export class ICPClient {
  private authClient: AuthClient | null = null;
  private actor: any = null;
  private agent: HttpAgent | null = null;
  private identity: Identity | null = null;
  
  // Configuration
  private readonly canisterId: string;
  private readonly host: string;
  private readonly identityProvider: string;
  
  constructor(canisterId?: string) {
    // Use environment variable or default canister ID
    this.canisterId = canisterId || process.env.CANISTER_ID_PARAMIFY_INSURANCE || 'rrkah-fqaaa-aaaaa-aaaaq-cai';
    
    // Determine host based on environment
    const isLocal = process.env.NODE_ENV === 'development';
    this.host = isLocal ? 'http://localhost:8000' : 'https://ic0.app';
    
    // Identity provider URL
    this.identityProvider = isLocal 
      ? `http://localhost:8000?canisterId=${this.canisterId}`
      : 'https://identity.ic0.app/#authorize';
  }
  
  // Initialize the client
  async init(): Promise<void> {
    // Create auth client
    this.authClient = await AuthClient.create();
    
    // Check if already authenticated
    const isAuthenticated = await this.authClient.isAuthenticated();
    
    if (isAuthenticated) {
      await this.setupActor();
    }
  }
  
  // Setup actor with current identity
  private async setupActor(): Promise<void> {
    if (!this.authClient) {
      throw new Error('Auth client not initialized');
    }
    
    // Get identity
    this.identity = this.authClient.getIdentity();
    
    // Create agent
    this.agent = new HttpAgent({
      identity: this.identity,
      host: this.host,
    });
    
    // Fetch root key for local development
    if (process.env.NODE_ENV === 'development') {
      await this.agent.fetchRootKey();
    }
    
    // Create actor
    this.actor = Actor.createActor(idlFactory, {
      agent: this.agent,
      canisterId: this.canisterId,
    });
  }
  
  // Login with Internet Identity
  async login(): Promise<boolean> {
    if (!this.authClient) {
      await this.init();
    }
    
    return new Promise((resolve) => {
      this.authClient!.login({
        identityProvider: this.identityProvider,
        maxTimeToLive: BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000), // 7 days in nanoseconds
        onSuccess: async () => {
          await this.setupActor();
          resolve(true);
        },
        onError: (error) => {
          console.error('Login failed:', error);
          resolve(false);
        },
      });
    });
  }
  
  // Logout
  async logout(): Promise<void> {
    if (this.authClient) {
      await this.authClient.logout();
      this.actor = null;
      this.agent = null;
      this.identity = null;
    }
  }
  
  // Check authentication status
  async isAuthenticated(): Promise<boolean> {
    if (!this.authClient) {
      return false;
    }
    return await this.authClient.isAuthenticated();
  }
  
  // Get current principal
  getPrincipal(): Principal | null {
    return this.identity ? this.identity.getPrincipal() : null;
  }
  
  // Get principal as string
  getPrincipalText(): string {
    const principal = this.getPrincipal();
    return principal ? principal.toText() : '';
  }
  
  // Insurance methods
  
  async createPolicy(coverageAmount: bigint): Promise<{ ok?: string; err?: string }> {
    if (!this.actor) {
      throw new Error('Not authenticated');
    }
    
    try {
      const result = await this.actor.create_policy({ coverage_amount: coverageAmount });
      return result;
    } catch (error) {
      console.error('Create policy error:', error);
      return { err: 'Failed to create policy' };
    }
  }
  
  async triggerPayout(): Promise<{ ok?: PayoutResult; err?: string }> {
    if (!this.actor) {
      throw new Error('Not authenticated');
    }
    
    try {
      const result = await this.actor.trigger_payout();
      return result;
    } catch (error) {
      console.error('Trigger payout error:', error);
      return { err: 'Failed to trigger payout' };
    }
  }
  
  async getPolicy(principal?: Principal): Promise<Policy | null> {
    if (!this.actor) {
      throw new Error('Not authenticated');
    }
    
    try {
      const result = await this.actor.get_policy(principal ? [principal] : []);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Get policy error:', error);
      return null;
    }
  }
  
  async getFloodData(): Promise<FloodData | null> {
    if (!this.actor) {
      // Try to create anonymous actor for public queries
      const agent = new HttpAgent({ host: this.host });
      if (process.env.NODE_ENV === 'development') {
        await agent.fetchRootKey();
      }
      const actor = Actor.createActor(idlFactory, {
        agent,
        canisterId: this.canisterId,
      });
      
      try {
        return await actor.get_flood_data();
      } catch (error) {
        console.error('Get flood data error:', error);
        return null;
      }
    }
    
    try {
      return await this.actor.get_flood_data();
    } catch (error) {
      console.error('Get flood data error:', error);
      return null;
    }
  }
  
  async getSystemStatus(): Promise<SystemStatus | null> {
    if (!this.actor) {
      // Try to create anonymous actor for public queries
      const agent = new HttpAgent({ host: this.host });
      if (process.env.NODE_ENV === 'development') {
        await agent.fetchRootKey();
      }
      const actor = Actor.createActor(idlFactory, {
        agent,
        canisterId: this.canisterId,
      });
      
      try {
        return await actor.get_system_status();
      } catch (error) {
        console.error('Get system status error:', error);
        return null;
      }
    }
    
    try {
      return await this.actor.get_system_status();
    } catch (error) {
      console.error('Get system status error:', error);
      return null;
    }
  }
  
  async isPayoutEligible(principal?: Principal): Promise<boolean> {
    if (!this.actor) {
      return false;
    }
    
    try {
      return await this.actor.is_payout_eligible(principal ? [principal] : []);
    } catch (error) {
      console.error('Check payout eligibility error:', error);
      return false;
    }
  }
  
  // Admin methods
  
  async setFloodLevel(level: number, stationId?: string): Promise<{ ok?: string; err?: string }> {
    if (!this.actor) {
      throw new Error('Not authenticated');
    }
    
    try {
      const result = await this.actor.set_flood_level(level, stationId ? [stationId] : []);
      return result;
    } catch (error) {
      console.error('Set flood level error:', error);
      return { err: 'Failed to set flood level' };
    }
  }
  
  async setThreshold(threshold: number): Promise<{ ok?: string; err?: string }> {
    if (!this.actor) {
      throw new Error('Not authenticated');
    }
    
    try {
      const result = await this.actor.set_threshold(threshold);
      return result;
    } catch (error) {
      console.error('Set threshold error:', error);
      return { err: 'Failed to set threshold' };
    }
  }
  
  async fundContract(amount: bigint): Promise<{ ok?: string; err?: string }> {
    if (!this.actor) {
      throw new Error('Not authenticated');
    }
    
    try {
      const result = await this.actor.fund_contract(amount);
      return result;
    } catch (error) {
      console.error('Fund contract error:', error);
      return { err: 'Failed to fund contract' };
    }
  }
  
  async getAdmin(): Promise<Principal | null> {
    const agent = new HttpAgent({ host: this.host });
    if (process.env.NODE_ENV === 'development') {
      await agent.fetchRootKey();
    }
    const actor = Actor.createActor(idlFactory, {
      agent,
      canisterId: this.canisterId,
    });
    
    try {
      return await actor.get_admin();
    } catch (error) {
      console.error('Get admin error:', error);
      return null;
    }
  }
  
  // Utility methods
  
  formatE8s(e8s: bigint): string {
    const icp = Number(e8s) / 100_000_000;
    return icp.toFixed(8).replace(/\.?0+$/, '');
  }
  
  toE8s(icp: number): bigint {
    return BigInt(Math.floor(icp * 100_000_000));
  }
}

// Singleton instance
let icpClientInstance: ICPClient | null = null;

export const getICPClient = (canisterId?: string): ICPClient => {
  if (!icpClientInstance) {
    icpClientInstance = new ICPClient(canisterId);
  }
  return icpClientInstance;
};
