# Frontend Integration Guide for Paramify ICP

## Table of Contents
1. [Overview](#overview)
2. [Migration from Web3 to ICP](#migration-from-web3-to-icp)
3. [Setting Up Agent-js](#setting-up-agent-js)
4. [Authentication with Internet Identity](#authentication-with-internet-identity)
5. [React Hooks for ICP](#react-hooks-for-icp)
6. [Service Layer Updates](#service-layer-updates)
7. [Component Examples](#component-examples)
8. [Error Handling](#error-handling)
9. [Testing](#testing)

## Overview

This guide provides comprehensive instructions for integrating the React frontend with the new ICP backend canisters. The migration requires replacing Web3/ethers.js with agent-js while maintaining the existing UI components.

## Migration from Web3 to ICP

### Key Differences

| Aspect | Ethereum/Web3 | Internet Computer |
|--------|---------------|-------------------|
| **Library** | ethers.js / web3.js | @dfinity/agent |
| **Wallet** | MetaMask | Internet Identity / Plug |
| **Addresses** | 0x... addresses | Principal IDs |
| **Transactions** | Gas fees in ETH | Cycles (abstracted) |
| **Contract Calls** | ABI + Contract Address | Candid + Canister ID |
| **Events** | Event listeners | Query polling |

### Dependencies to Update

```json
// package.json
{
  "dependencies": {
    // Remove
    - "ethers": "^5.7.0",
    - "web3": "^4.0.0",
    
    // Add
    + "@dfinity/agent": "^1.1.0",
    + "@dfinity/principal": "^1.1.0",
    + "@dfinity/candid": "^1.1.0",
    + "@dfinity/identity": "^1.1.0",
    + "@dfinity/auth-client": "^1.1.0"
  }
}
```

## Setting Up Agent-js

### 1. Create Agent Configuration

```typescript
// src/lib/agent.ts
import { HttpAgent, Actor } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { Principal } from '@dfinity/principal';

const IS_LOCAL = process.env.NODE_ENV === 'development';
const HOST = IS_LOCAL ? 'http://localhost:4943' : 'https://ic0.app';

export class ICPAgent {
  private agent: HttpAgent | null = null;
  private authClient: AuthClient | null = null;

  async initialize(): Promise<void> {
    // Create auth client
    this.authClient = await AuthClient.create();
    
    // Create agent
    this.agent = new HttpAgent({ host: HOST });
    
    // Fetch root key for local development
    if (IS_LOCAL) {
      await this.agent.fetchRootKey();
    }
  }

  async login(): Promise<Principal> {
    if (!this.authClient) {
      throw new Error('Auth client not initialized');
    }

    return new Promise((resolve, reject) => {
      this.authClient!.login({
        identityProvider: IS_LOCAL 
          ? `http://localhost:4943?canisterId=rdmx6-jaaaa-aaaaa-aaadq-cai`
          : 'https://identity.ic0.app',
        onSuccess: () => {
          const identity = this.authClient!.getIdentity();
          const principal = identity.getPrincipal();
          
          // Update agent with authenticated identity
          this.agent = new HttpAgent({
            host: HOST,
            identity,
          });
          
          resolve(principal);
        },
        onError: reject,
      });
    });
  }

  async logout(): Promise<void> {
    if (this.authClient) {
      await this.authClient.logout();
    }
  }

  getAgent(): HttpAgent {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }
    return this.agent;
  }

  isAuthenticated(): Promise<boolean> {
    if (!this.authClient) {
      return Promise.resolve(false);
    }
    return this.authClient.isAuthenticated();
  }
}

export const icpAgent = new ICPAgent();
```

## Authentication with Internet Identity

### 2. Create Auth Context

```typescript
// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { icpAgent } from '../lib/agent';

interface AuthContextType {
  isAuthenticated: boolean;
  principal: Principal | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await icpAgent.initialize();
        const authenticated = await icpAgent.isAuthenticated();
        setIsAuthenticated(authenticated);
        
        if (authenticated) {
          // Get principal from stored identity
          const authClient = await AuthClient.create();
          const identity = authClient.getIdentity();
          setPrincipal(identity.getPrincipal());
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async () => {
    try {
      setLoading(true);
      const userPrincipal = await icpAgent.login();
      setPrincipal(userPrincipal);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await icpAgent.logout();
      setPrincipal(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, principal, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

## React Hooks for ICP

### 3. Create Canister Hooks

```typescript
// src/hooks/useInsurance.ts
import { useState, useEffect, useCallback } from 'react';
import { Actor } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { insurance, Policy, PolicyRequest } from '../declarations/insurance';
import { useAuth } from '../contexts/AuthContext';

export const useInsurance = () => {
  const { principal, isAuthenticated } = useAuth();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's policy
  const fetchPolicy = useCallback(async () => {
    if (!principal || !isAuthenticated) return;

    try {
      setLoading(true);
      const result = await insurance.get_policy(principal);
      
      if (result.length > 0) {
        setPolicy(result[0]);
      } else {
        setPolicy(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch policy');
    } finally {
      setLoading(false);
    }
  }, [principal, isAuthenticated]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  // Purchase policy
  const purchasePolicy = async (coverageAmount: bigint) => {
    if (!isAuthenticated) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      const request: PolicyRequest = { coverage_amount: coverageAmount };
      const result = await insurance.purchase_policy(request);

      if ('ok' in result) {
        setPolicy(result.ok);
        return result.ok;
      } else {
        throw new Error(result.err);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to purchase policy';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Claim payout
  const claimPayout = async () => {
    if (!isAuthenticated || !policy) {
      throw new Error('No active policy');
    }

    setLoading(true);
    setError(null);

    try {
      const result = await insurance.claim_payout();

      if ('ok' in result) {
        await fetchPolicy(); // Refresh policy
        return result.ok;
      } else {
        throw new Error(result.err);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to claim payout';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Check eligibility
  const checkEligibility = async () => {
    if (!principal || !isAuthenticated) return null;

    try {
      const result = await insurance.check_payout_eligibility(principal);
      return result;
    } catch (err) {
      console.error('Failed to check eligibility:', err);
      return null;
    }
  };

  return {
    policy,
    loading,
    error,
    purchasePolicy,
    claimPayout,
    checkEligibility,
    refreshPolicy: fetchPolicy,
  };
};
```

### 4. Oracle Data Hook

```typescript
// src/hooks/useOracle.ts
import { useState, useEffect } from 'react';
import { oracle, FloodData } from '../declarations/oracle';

export const useOracle = (refreshInterval = 60000) => {
  const [floodData, setFloodData] = useState<FloodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFloodData = async () => {
    try {
      setLoading(true);
      const result = await oracle.get_latest_data();
      
      if (result.length > 0) {
        setFloodData(result[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch flood data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFloodData();

    // Set up polling
    const interval = setInterval(fetchFloodData, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return {
    floodData,
    loading,
    error,
    refresh: fetchFloodData,
  };
};
```

## Service Layer Updates

### 5. Replace Contract Service

```typescript
// src/services/insuranceService.ts (OLD - Remove)
import { ethers } from 'ethers';
import { PARAMIFY_ADDRESS, PARAMIFY_ABI } from '../lib/contract';

// src/services/insuranceService.ts (NEW)
import { insurance } from '../declarations/insurance';
import { Principal } from '@dfinity/principal';

export class InsuranceService {
  async getSystemStatus() {
    return await insurance.get_system_status();
  }

  async getAllActivePolicies() {
    return await insurance.get_all_active_policies();
  }

  async updateThreshold(threshold: number) {
    const result = await insurance.update_threshold(threshold);
    if ('err' in result) {
      throw new Error(result.err);
    }
    return result.ok;
  }

  formatTokenAmount(amount: bigint, decimals = 8): string {
    const divisor = BigInt(10 ** decimals);
    const whole = amount / divisor;
    const fraction = amount % divisor;
    return `${whole}.${fraction.toString().padStart(decimals, '0')}`;
  }

  parseTokenAmount(amount: string, decimals = 8): bigint {
    const [whole, fraction = '0'] = amount.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    return BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFraction);
  }
}

export const insuranceService = new InsuranceService();
```

## Component Examples

### 6. Update Wallet Connection Component

```tsx
// src/components/WalletConnect.tsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';

export const WalletConnect: React.FC = () => {
  const { isAuthenticated, principal, login, logout, loading } = useAuth();

  const handleConnect = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  if (loading) {
    return <Button disabled>Connecting...</Button>;
  }

  if (isAuthenticated && principal) {
    const displayPrincipal = principal.toString().slice(0, 8) + '...';
    
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">{displayPrincipal}</span>
        <Button onClick={logout} variant="outline">
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleConnect}>
      Connect with Internet Identity
    </Button>
  );
};
```

### 7. Update Insurance Purchase Component

```tsx
// src/components/PurchaseInsurance.tsx
import React, { useState } from 'react';
import { useInsurance } from '../hooks/useInsurance';
import { insuranceService } from '../services/insuranceService';
import { Button } from './ui/button';
import { Input } from './ui/input';

export const PurchaseInsurance: React.FC = () => {
  const { purchasePolicy, loading, error } = useInsurance();
  const [coverageAmount, setCoverageAmount] = useState('10');

  const handlePurchase = async () => {
    try {
      const amount = insuranceService.parseTokenAmount(coverageAmount);
      await purchasePolicy(amount);
      alert('Insurance purchased successfully!');
    } catch (err) {
      console.error('Purchase failed:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Coverage Amount (tokens)
        </label>
        <Input
          type="number"
          value={coverageAmount}
          onChange={(e) => setCoverageAmount(e.target.value)}
          min="1"
          step="0.1"
        />
        <p className="text-sm text-gray-500 mt-1">
          Premium: {Number(coverageAmount) * 0.1} tokens (10%)
        </p>
      </div>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      <Button 
        onClick={handlePurchase} 
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Processing...' : 'Purchase Insurance'}
      </Button>
    </div>
  );
};
```

### 8. Update Dashboard Component

```tsx
// src/components/Dashboard.tsx
import React from 'react';
import { useInsurance } from '../hooks/useInsurance';
import { useOracle } from '../hooks/useOracle';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export const Dashboard: React.FC = () => {
  const { policy, checkEligibility } = useInsurance();
  const { floodData } = useOracle();

  const [eligibility, setEligibility] = useState(null);

  useEffect(() => {
    const checkPayoutEligibility = async () => {
      const result = await checkEligibility();
      setEligibility(result);
    };

    if (policy) {
      checkPayoutEligibility();
    }
  }, [policy, checkEligibility]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Flood Level Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Flood Level</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {floodData ? `${floodData.raw_value_feet.toFixed(2)} ft` : 'Loading...'}
          </p>
          <p className="text-sm text-gray-500">
            Threshold: {policy?.flood_threshold.toFixed(2) || '3.00'} ft
          </p>
        </CardContent>
      </Card>

      {/* Policy Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Policy Status</CardTitle>
        </CardHeader>
        <CardContent>
          {policy ? (
            <div>
              <p className="text-lg font-semibold">
                Status: {Object.keys(policy.status)[0]}
              </p>
              <p className="text-sm">
                Coverage: {Number(policy.coverage_amount) / 1e8} tokens
              </p>
              <p className="text-sm">
                Premium Paid: {Number(policy.premium_amount) / 1e8} tokens
              </p>
            </div>
          ) : (
            <p>No active policy</p>
          )}
        </CardContent>
      </Card>

      {/* Payout Eligibility Card */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Eligibility</CardTitle>
        </CardHeader>
        <CardContent>
          {eligibility ? (
            <div>
              <p className="text-lg font-semibold">
                {eligibility.eligible ? '✅ Eligible' : '❌ Not Eligible'}
              </p>
              {eligibility.reason && (
                <p className="text-sm text-gray-500">{eligibility.reason[0]}</p>
              )}
            </div>
          ) : (
            <p>Checking...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
```

## Error Handling

### 9. Create Error Boundary

```tsx
// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 10. Handle Canister Errors

```typescript
// src/utils/errorHandler.ts
export class CanisterError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CanisterError';
  }
}

export const handleCanisterError = (error: any): string => {
  // Check for common ICP errors
  if (error.message?.includes('Insufficient cycles')) {
    return 'The canister has insufficient cycles to process this request';
  }
  
  if (error.message?.includes('Canister trapped')) {
    return 'The canister encountered an error. Please try again';
  }
  
  if (error.message?.includes('Replica returned an error')) {
    return 'Network error. Please check your connection';
  }
  
  // Handle Result type errors
  if (typeof error === 'object' && 'err' in error) {
    return error.err;
  }
  
  // Default error message
  return error.message || 'An unexpected error occurred';
};

// Retry wrapper for canister calls
export const retryCanisterCall = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
};
```

## Testing

### 11. Unit Tests for Hooks

```typescript
// src/hooks/__tests__/useInsurance.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useInsurance } from '../useInsurance';
import { insurance } from '../../declarations/insurance';

jest.mock('../../declarations/insurance');

describe('useInsurance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch policy on mount', async () => {
    const mockPolicy = {
      id: 'POL-001',
      customer: { _principal: 'test-principal' },
      coverage_amount: 1000000000n,
      status: { Active: null },
    };

    (insurance.get_policy as jest.Mock).mockResolvedValue([mockPolicy]);

    const { result } = renderHook(() => useInsurance());

    await waitFor(() => {
      expect(result.current.policy).toEqual(mockPolicy);
    });
  });

  it('should handle purchase policy', async () => {
    const mockPolicy = {
      id: 'POL-002',
      coverage_amount: 2000000000n,
    };

    (insurance.purchase_policy as jest.Mock).mockResolvedValue({ ok: mockPolicy });

    const { result } = renderHook(() => useInsurance());

    await act(async () => {
      const policy = await result.current.purchasePolicy(2000000000n);
      expect(policy).toEqual(mockPolicy);
    });
  });

  it('should handle errors', async () => {
    (insurance.purchase_policy as jest.Mock).mockResolvedValue({ 
      err: 'Insufficient funds' 
    });

    const { result } = renderHook(() => useInsurance());

    await expect(
      result.current.purchasePolicy(1000000000n)
    ).rejects.toThrow('Insufficient funds');
  });
});
```

### 12. Integration Tests

```typescript
// src/__tests__/integration.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../contexts/AuthContext';
import { Dashboard } from '../components/Dashboard';

describe('Dashboard Integration', () => {
  it('should display flood data and policy information', async () => {
    render(
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/Current Flood Level/i)).toBeInTheDocument();
    });

    // Check for flood level display
    const floodLevel = await screen.findByText(/ft/);
    expect(floodLevel).toBeInTheDocument();

    // Check for policy status
    expect(screen.getByText(/Policy Status/i)).toBeInTheDocument();
  });

  it('should handle user interactions', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <PurchaseInsurance />
      </AuthProvider>
    );

    // Enter coverage amount
    const input = screen.getByLabelText(/Coverage Amount/i);
    await user.clear(input);
    await user.type(input, '100');

    // Check premium calculation
    expect(screen.getByText(/Premium: 10 tokens/i)).toBeInTheDocument();

    // Click purchase button
    const button = screen.getByRole('button', { name: /Purchase Insurance/i });
    await user.click(button);

    // Wait for processing
    await waitFor(() => {
      expect(screen.queryByText(/Processing/i)).not.toBeInTheDocument();
    });
  });
});
```

## Migration Checklist

### Phase 1: Setup (Week 1)
- [ ] Install ICP dependencies (@dfinity/agent, etc.)
- [ ] Remove Web3 dependencies (ethers.js, web3.js)
- [ ] Set up agent configuration
- [ ] Configure authentication client

### Phase 2: Service Layer (Week 2)
- [ ] Replace contract service with canister service
- [ ] Update data models and types
- [ ] Implement canister actor creation
- [ ] Add error handling utilities

### Phase 3: Authentication (Week 3)
- [ ] Implement Internet Identity integration
- [ ] Create auth context and hooks
- [ ] Update wallet connection UI
- [ ] Test authentication flow

### Phase 4: Features (Week 4-5)
- [ ] Update insurance purchase flow
- [ ] Implement payout claim functionality
- [ ] Update dashboard components
- [ ] Add oracle data display

### Phase 5: Testing (Week 6)
- [ ] Write unit tests for hooks
- [ ] Create integration tests
- [ ] Perform E2E testing
- [ ] Fix bugs and edge cases

### Phase 6: Deployment (Week 7)
- [ ] Build production bundle
- [ ] Deploy to ICP hosting
- [ ] Configure custom domain
- [ ] Monitor and optimize

## Common Issues and Solutions

### Issue: Agent initialization fails
```typescript
// Solution: Ensure proper error handling
try {
  await agent.fetchRootKey();
} catch (error) {
  console.warn('Root key fetch failed, likely in production:', error);
}
```

### Issue: BigInt serialization in JSON
```typescript
// Solution: Custom JSON stringifier
JSON.stringify(data, (_, value) =>
  typeof value === 'bigint' ? value.toString() : value
);
```

### Issue: Principal comparison
```typescript
// Solution: Use Principal.equal() method
import { Principal } from '@dfinity/principal';

const isOwner = Principal.equal(userPrincipal, ownerPrincipal);
```

### Issue: Candid type mismatch
```typescript
// Solution: Ensure proper type conversions
const amount = BigInt(inputValue * 1e8); // Convert to token units
const result = await canister.method(amount);
```

## Resources

- [Internet Computer SDK Documentation](https://sdk.dfinity.org/)
- [Agent-js Documentation](https://agent-js.icp.xyz/)
- [Internet Identity Integration Guide](https://internetcomputer.org/docs/current/developer-docs/integrations/internet-identity/integrate-identity)
- [Candid UI](https://a4gq6-oaaaa-aaaah-qaa4q-cai.raw.ic0.app/)
- [ICP Developer Forum](https://forum.dfinity.org/)

## Support

For frontend-specific questions:
1. Check the [Common Issues](#common-issues-and-solutions) section
2. Review the [Migration Checklist](#migration-checklist)
3. Post in the ICP Developer Forum
4. Contact the development team

---

*Last Updated: 2025-09-02*
*Version: 1.0.0*