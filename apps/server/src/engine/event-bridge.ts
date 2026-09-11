import fs from 'node:fs';
import path from 'node:path';
import type { WebSocket, WebSocketServer } from 'ws';

export class EventBridge {
  private wss: WebSocketServer | null = null;
  private fileWatcher: fs.FSWatcher | null = null;
  private watchDebounceTimer: NodeJS.Timeout | null = null;

  setWss(wss: WebSocketServer): void {
    this.wss = wss;
  }

  broadcast(message: Record<string, any>): void {
    if (!this.wss) return;
    const payload = JSON.stringify(message);
    for (const client of this.wss.clients) {
      if (client.readyState === 1 /* OPEN */) {
        client.send(payload);
      }
    }
  }

  watchWorld(worldRoot: string): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }

    try {
      this.fileWatcher = fs.watch(worldRoot, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        if (filename.includes('.airpworld') || filename.includes('node_modules')) return;

        if (this.watchDebounceTimer) clearTimeout(this.watchDebounceTimer);
        this.watchDebounceTimer = setTimeout(() => {
          this.broadcast({
            type: 'file_changed',
            eventType,
            filename,
            timestamp: new Date().toISOString()
          });
        }, 150);
      });
    } catch (err) {
      console.warn('[EventBridge] Could not watch world directory:', err);
    }
  }

  close(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
  }
}
