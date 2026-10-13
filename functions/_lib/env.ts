/** Environment bindings for the Pages Functions (see wrangler.toml / .dev.vars.example). */
export interface Env {
  /** Supercell developer API token — secret, server-side only. Never logged or returned. */
  CR_API_TOKEN?: string;
  /** Upstream base URL. Defaults to the RoyaleAPI proxy (see docs/api-notes.md). */
  CR_API_BASE?: string;
}

export const DEFAULT_API_BASE = 'https://proxy.royaleapi.dev/v1';

export function apiBase(env: Env): string {
  const base = env.CR_API_BASE?.trim() || DEFAULT_API_BASE;
  return base.replace(/\/+$/, '');
}
