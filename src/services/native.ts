import { invoke } from '@tauri-apps/api/core';

/**
 * True when running inside the Tauri desktop shell.
 * In browser/dev-server mode this is false and mock data is used instead.
 */
export function isNative(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Invoke a Tauri backend command.
 *
 * - **Native mode** (Tauri app): calls the Rust command directly. Any error
 *   is propagated to the caller so the UI can surface it.
 * - **Browser mode** (dev server / preview): the fallback is called instead
 *   so the app remains previewable without a Rust build.
 */
export async function callNative<T>(
  command: string,
  args?: Record<string, unknown>,
  fallback?: () => T | Promise<T>,
): Promise<T> {
  if (!isNative()) {
    // Browser preview — use mock data so the UI is previewable without Tauri.
    if (fallback) return fallback();
    throw new Error(`callNative: not running in Tauri desktop app (command: ${command})`);
  }
  return invoke<T>(command, args);
}

/**
 * Opens a URL in the system default browser.
 * In native mode uses the `open_url` Rust command with HTTPS host allow-listing.
 * In browser preview falls back to window.open.
 */
export function openExternalUrl(url: string): void {
  if (!isAllowedExternalUrl(url)) return;
  if (!isNative()) {
    window.open(url, '_blank', 'noreferrer');
    return;
  }
  invoke('open_url', { url }).catch(() => {
    window.open(url, '_blank', 'noreferrer');
  });
}

function isAllowedExternalUrl(url: string): boolean {
  try {
    if (url.length > 2048 || /[\s"'<>|^`\\@]/.test(url)) return false;
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const allowedHosts = ['radiumpcs.com.au', 'github.com', 'nvidia.com', 'intel.com', 'amd.com'];
    return allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}
