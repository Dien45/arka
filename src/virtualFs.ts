// Per-session virtual filesystem storage.
//
// Historically Arka kept ONE global virtual workspace shared by every chat
// session (localStorage key `arka-virtual-files`), so a file the AI wrote
// while working on "Session A" would also show up — and could be clobbered —
// while working on unrelated "Session B". This module gives every session
// its own isolated file map (and its own git-checkpoint for `stage_commit`),
// keyed by session id, while keeping a single shared legacy bucket as a
// fallback for the (rare) case there's no active session to scope to.

export interface VirtualFile {
  content: string;
  modified: string;
  size: number;
}

export type VirtualFileMap = Record<string, VirtualFile>;

/** Pre-migration, single shared bucket. Kept as the fallback for "no session" contexts. */
const LEGACY_FILES_KEY = 'arka-virtual-files';
const LEGACY_CHECKPOINT_KEY = 'arka-patch-checkpoint';
const MIGRATION_FLAG_KEY = 'arka-virtual-files-migrated';

export function virtualFilesKey(sessionId?: string | null): string {
  return sessionId ? `arka-virtual-files::${sessionId}` : LEGACY_FILES_KEY;
}

export function checkpointKey(sessionId?: string | null): string {
  return sessionId ? `arka-patch-checkpoint::${sessionId}` : LEGACY_CHECKPOINT_KEY;
}

export function loadVirtualFiles(sessionId?: string | null): VirtualFileMap {
  try {
    return JSON.parse(localStorage.getItem(virtualFilesKey(sessionId)) || '{}');
  } catch {
    return {};
  }
}

export function saveVirtualFiles(sessionId: string | null | undefined, files: VirtualFileMap): void {
  localStorage.setItem(virtualFilesKey(sessionId), JSON.stringify(files));
  // `detail.sessionId` lets listeners (Files tab, GitHub panel) ignore
  // updates for a session they aren't currently displaying.
  window.dispatchEvent(new CustomEvent('virtual-files-updated', { detail: { sessionId: sessionId ?? null } }));
}

export function loadCheckpoint(sessionId?: string | null): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(checkpointKey(sessionId)) || '{}');
  } catch {
    return {};
  }
}

export function saveCheckpoint(sessionId: string | null | undefined, checkpoint: Record<string, string>): void {
  localStorage.setItem(checkpointKey(sessionId), JSON.stringify(checkpoint));
}

/** Removes a session's workspace + checkpoint when that session is deleted, so storage doesn't leak forever. */
export function deleteSessionWorkspace(sessionId: string): void {
  localStorage.removeItem(virtualFilesKey(sessionId));
  localStorage.removeItem(checkpointKey(sessionId));
}

/**
 * One-time migration: before this feature existed, all files lived in the
 * single legacy bucket. On first boot after the update we copy whatever was
 * in there into the session that was active at the time (so nobody's
 * existing work disappears), then clear the legacy bucket so it stops
 * acting as a confusing fallback. Safe to call on every app boot — it's a
 * no-op once the migration flag is set.
 */
export function migrateLegacyVirtualFilesOnce(activeSessionId: string | null | undefined): void {
  try {
    if (localStorage.getItem(MIGRATION_FLAG_KEY) === '1') return;
    if (!activeSessionId) return; // wait until a session exists to migrate into

    const legacyFiles = localStorage.getItem(LEGACY_FILES_KEY);
    const hasLegacyFiles = !!legacyFiles && Object.keys(JSON.parse(legacyFiles)).length > 0;

    if (hasLegacyFiles) {
      localStorage.setItem(virtualFilesKey(activeSessionId), legacyFiles as string);
      const legacyCheckpoint = localStorage.getItem(LEGACY_CHECKPOINT_KEY);
      if (legacyCheckpoint) {
        localStorage.setItem(checkpointKey(activeSessionId), legacyCheckpoint);
      }
      localStorage.removeItem(LEGACY_FILES_KEY);
      localStorage.removeItem(LEGACY_CHECKPOINT_KEY);
    }

    localStorage.setItem(MIGRATION_FLAG_KEY, '1');
  } catch (error) {
    console.error('Gagal migrasi virtual workspace lama:', error);
  }
}
