import { AuthClient } from '@dfinity/auth-client';
import { Principal } from '@dfinity/principal';

const IDENTITY_PROVIDER = process.env.NODE_ENV === 'development'
  ? 'http://127.0.0.1:4943?canisterId=rdmx6-jaaaa-aaaaa-aaadq-cai'
  : 'https://identity.ic0.app';

let authClient: AuthClient | null = null;

export async function initializeAuth(): Promise<void> {
  authClient = await AuthClient.create();
}

export async function loginWithInternetIdentity(): Promise<Principal | null> {
  if (!authClient) {
    await initializeAuth();
  }

  return new Promise((resolve) => {
    authClient!.login({
      identityProvider: IDENTITY_PROVIDER,
      onSuccess: () => {
        const identity = authClient!.getIdentity();
        const principal = identity.getPrincipal();
        resolve(principal);
      },
      onError: (error) => {
        console.error('Login failed:', error);
        resolve(null);
      },
    });
  });
}

export async function logoutFromInternetIdentity(): Promise<void> {
  if (authClient) {
    await authClient.logout();
  }
}

export function getCurrentPrincipal(): Principal | null {
  if (!authClient) return null;
  
  const identity = authClient.getIdentity();
  return identity.getPrincipal();
}

export function isAuthenticated(): boolean {
  if (!authClient) return false;
  return authClient.isAuthenticated();
}

export function formatPrincipal(principal: Principal): string {
  const text = principal.toText();
  return text.length > 20 ? `${text.slice(0, 10)}...${text.slice(-6)}` : text;
}

export function isAdminPrincipal(principal: Principal): boolean {
  const adminPrincipal = 'qt2t5-udd6f-umvix-3lpif-36zrq-2m66p-nyu74-d4xjq-ixiag-luvur-bqe';
  return principal.toText() === adminPrincipal;
}
