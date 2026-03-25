/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev only: override Vite `/api` proxy target when API is not on localhost:3003 */
  readonly VITE_DEV_API_PROXY_TARGET?: string;
  /** Teleport web URL to open the dba-kiro (or similar) resource — “Connect to Kiro host” button */
  readonly VITE_TELEPORT_KIRO_HOST_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
