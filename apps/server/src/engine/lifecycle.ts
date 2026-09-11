import path from 'node:path';
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
    const presetPath = path.join(this.repoRoot, 'presets', 'writer.json');

    client.on('event', (evt) => {
      onEvent?.({ source: 'writer', ...evt });
    });

    client.on('stderr', (err) => {
      console.error('[Writer stderr]', err);
    });

    client.start({
      cwd: worldRoot,
      args: ['--preset', presetPath],
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
    const presetPath = path.join(worldRoot, 'characters', characterId, 'preset.json');
    const openingFile = path.join(worldRoot, '.airpworld', 'openings', `${characterId}.json`);

    client.on('event', (evt) => {
      onEvent?.({ source: 'character', characterId, ...evt });
    });

    const env: NodeJS.ProcessEnv = {};
    try {
      env.PI_OPENING = openingFile;
    } catch {
      // Ignore if opening file absent
    }

    client.start({
      cwd: worldRoot,
      args: ['--preset', presetPath],
      env,
    });

    this.characterClients.set(characterId, client);

    // Inject recent context
    if (recentContext) {
      setTimeout(() => {
        client.prompt(`[系统提示：当前玩家站在你面前，场景情况如下：${recentContext}]`).catch(console.error);
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
