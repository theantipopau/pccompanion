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
