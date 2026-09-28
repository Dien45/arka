// Hermes-inspired Memory System for Arka

export interface MemoryEntry {
  id: string;
  content: string;
  timestamp: number;
}

export interface MemoryStore {
  memory: MemoryEntry[]; // Agent's personal notes
  user: MemoryEntry[]; // User profile
}

const MEMORY_CHAR_LIMIT = 2200; // ~800 tokens
const USER_CHAR_LIMIT = 1375; // ~500 tokens

class MemoryManager {
  private memory: MemoryStore;

  constructor() {
    this.memory = this.loadFromStorage();
  }

  private loadFromStorage(): MemoryStore {
    try {
      const saved = localStorage.getItem('arka-memory');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load memory:', error);
    }
    return { memory: [], user: [] };
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('arka-memory', JSON.stringify(this.memory));
      // Let any mounted UI (e.g. the Memory section in Settings) know it
      // should re-read memory, mirroring the 'virtual-files-updated' event
      // used for the virtual filesystem.
      window.dispatchEvent(new CustomEvent('arka-memory-updated'));
    } catch (error) {
      console.error('Failed to save memory:', error);
    }
  }

  private getCharCount(entries: MemoryEntry[]): number {
    return entries.reduce((sum, entry) => sum + entry.content.length, 0);
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Add a new memory entry
  add(target: 'memory' | 'user', content: string): { success: boolean; error?: string; currentEntries?: string[]; usage?: string } {
    const entries = this.memory[target];
    const limit = target === 'memory' ? MEMORY_CHAR_LIMIT : USER_CHAR_LIMIT;
    const currentCount = this.getCharCount(entries);

    // Check if duplicate
    if (entries.some(e => e.content === content)) {
      return { success: true }; // No duplicate added
    }

    // Check capacity
    if (currentCount + content.length > limit) {
      return {
        success: false,
        error: `Memory at ${currentCount}/${limit} chars. Adding this entry (${content.length} chars) would exceed the limit. Consolidate now: use 'replace' to merge overlapping entries or 'remove' stale entries.`,
        currentEntries: entries.map(e => e.content),
        usage: `${currentCount}/${limit}`,
      };
    }

    entries.push({
      id: this.generateId(),
      content,
      timestamp: Date.now(),
    });

    this.saveToStorage();
    return { success: true };
  }

  // Replace an existing entry (substring matching)
  replace(target: 'memory' | 'user', oldText: string, newContent: string): { success: boolean; error?: string } {
    const entries = this.memory[target];
    const limit = target === 'memory' ? MEMORY_CHAR_LIMIT : USER_CHAR_LIMIT;

    // Find matching entries
    const matches = entries.filter(e => e.content.includes(oldText));

    if (matches.length === 0) {
      return { success: false, error: `No entry found containing "${oldText}"` };
    }

    if (matches.length > 1) {
      return { success: false, error: `Multiple entries match "${oldText}". Please be more specific.` };
    }

    // Check capacity
    const currentCount = this.getCharCount(entries);
    const oldEntry = matches[0];
    const sizeDiff = newContent.length - oldEntry.content.length;

    if (currentCount + sizeDiff > limit) {
      return {
        success: false,
        error: `Replacing would exceed limit (${currentCount + sizeDiff}/${limit}). Shorten the new content or remove other entries first.`,
      };
    }

    // Replace the entry
    oldEntry.content = newContent;
    oldEntry.timestamp = Date.now();

    this.saveToStorage();
    return { success: true };
  }

  // Remove an entry (substring matching)
  remove(target: 'memory' | 'user', oldText: string): { success: boolean; error?: string } {
    const entries = this.memory[target];

    // Find matching entries
    const matchIndex = entries.findIndex(e => e.content.includes(oldText));

    if (matchIndex === -1) {
      return { success: false, error: `No entry found containing "${oldText}"` };
    }

    // Check if multiple matches
    const matches = entries.filter(e => e.content.includes(oldText));
    if (matches.length > 1) {
      return { success: false, error: `Multiple entries match "${oldText}". Please be more specific.` };
    }

    entries.splice(matchIndex, 1);
    this.saveToStorage();
    return { success: true };
  }

  // Get all memory entries
  getAll(): MemoryStore {
    return { ...this.memory };
  }

  // Get formatted memory for system prompt
  getFormatted(): string {
    const memoryCount = this.getCharCount(this.memory.memory);
    const userCount = this.getCharCount(this.memory.user);

    let formatted = '';

    if (this.memory.memory.length > 0) {
      formatted += `\n══════════════════════════════════════════════\n`;
      formatted += `MEMORY (your personal notes) [${Math.round((memoryCount / MEMORY_CHAR_LIMIT) * 100)}% — ${memoryCount}/${MEMORY_CHAR_LIMIT} chars]\n`;
      formatted += `══════════════════════════════════════════════\n\n`;
      formatted += this.memory.memory.map(e => e.content).join('\n\n§\n\n');
      formatted += '\n\n';
    }

    if (this.memory.user.length > 0) {
      formatted += `\n══════════════════════════════════════════════\n`;
      formatted += `USER PROFILE [${Math.round((userCount / USER_CHAR_LIMIT) * 100)}% — ${userCount}/${USER_CHAR_LIMIT} chars]\n`;
      formatted += `══════════════════════════════════════════════\n\n`;
      formatted += this.memory.user.map(e => e.content).join('\n\n§\n\n');
      formatted += '\n\n';
    }

    return formatted;
  }

  // Clear all memory
  clear(): void {
    this.memory = { memory: [], user: [] };
    this.saveToStorage();
  }
}

export const memoryManager = new MemoryManager();
