import fs from 'node:fs';
import path from 'node:path';
import { airpEnv, installPreset, skillArgs } from './presets.js';
import { PiRpcClient } from './rpc-client.js';

export interface AgentLifecycleManagerOptions {
  repoRoot: string;
  vendorCliPath: string;
}

export class AgentLifecycleManager {
  private repoRoot: string;
  private vendorCliPath: string;
  private writerClient: PiRpcClient | null = null;
  private characterClients = new Map<string, PiRpcClient>();

  constructor(options: AgentLifecycleManagerOptions) {
    this.repoRoot = options.repoRoot;
    this.vendorCliPath = options.vendorCliPath;
  }

  async startWriter(worldRoot: string, onEvent?: (event: any) => void): Promise<PiRpcClient> {
    if (this.writerClient) {
      this.writerClient.stop();
      this.writerClient = null;
    }

    const client = new PiRpcClient(this.vendorCliPath);
    const presetId = installPreset(worldRoot, path.join(this.repoRoot, 'presets', 'writer.json'));

    client.on('event', (evt) => {
      onEvent?.({ source: 'writer', ...evt });
    });

    client.on('stderr', (err) => {
      console.error('[Writer stderr]', err);
    });

    client.start({
      cwd: worldRoot,
      args: ['--preset', presetId, ...skillArgs(this.repoRoot, worldRoot)],
      env: airpEnv(worldRoot),
    });

    this.writerClient = client;
    return client;
  }

  getWriter(): PiRpcClient | null {
    return this.writerClient;
  }

  async startCharacter(
    characterId: string,
    worldRoot: string,
    recentContext: string,
    onEvent?: (event: any) => void
  ): Promise<PiRpcClient> {
    if (this.characterClients.has(characterId)) {
      this.stopCharacter(characterId);
    }

    const client = new PiRpcClient(this.vendorCliPath);
    // The character's own preset takes priority; otherwise fall back to the repo's generic character preset.
    const characterPreset = path.join(worldRoot, 'characters', characterId, 'preset.json');
    const presetId = installPreset(
      worldRoot,
      fs.existsSync(characterPreset) ? characterPreset : path.join(this.repoRoot, 'presets', 'character.json')
    );

    client.on('event', (evt) => {
      onEvent?.({ source: 'character', characterId, ...evt });
    });

    client.start({
      cwd: worldRoot,
      args: ['--preset', presetId],
      env: airpEnv(worldRoot, characterId),
    });

    this.characterClients.set(characterId, client);

    // Inject recent context
    if (recentContext) {
      setTimeout(() => {
        client.prompt(`[System note: the player is standing in front of you right now; the scene is as follows: ${recentContext}]`).catch(console.error);
      }, 500);
    }

    return client;
  }

  stopCharacter(characterId: string): void {
    const client = this.characterClients.get(characterId);
    if (client) {
      client.stop();
      this.characterClients.delete(characterId);
    }
  }

  stopAll(): void {
    if (this.writerClient) {
      this.writerClient.stop();
      this.writerClient = null;
    }
    for (const client of this.characterClients.values()) {
      client.stop();
    }
    this.characterClients.clear();
  }
}
