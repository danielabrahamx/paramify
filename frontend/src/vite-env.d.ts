/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CANISTER_ID_PARAMIFY_INSURANCE: string
  readonly VITE_DFX_NETWORK: string
  readonly VITE_DFX_PORT: string
  readonly NODE_ENV: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}