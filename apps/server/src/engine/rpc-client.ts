import { spawn, type ChildProcess } from 'node:child_process';
import readline from 'node:readline';
import EventEmitter from 'node:events';

export interface RpcOptions {
  cwd: string;
  args?: string[];
  env?: NodeJS.ProcessEnv;
}

export class PiRpcClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private seq = 0;
  private pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

  constructor(private cliPath: string) {
    super();
  }

  start(options: RpcOptions): void {
    const fullArgs = [
      this.cliPath,
      '--mode', 'rpc',
      '--approve',
      '--system-prompt', '',
      ...(options.args || [])
    ];

    this.process = spawn('node', fullArgs, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process.stderr?.on('data', (chunk) => {
      const errStr = chunk.toString();
      this.emit('stderr', errStr);
    });

    this.process.on('exit', (code, signal) => {
      this.emit('exit', { code, signal });
      this.cleanup();
    });

    if (this.process.stdout) {
      this.rl = readline.createInterface({ input: this.process.stdout });
      this.rl.on('line', (line) => {
        if (!line.trim()) return;
        try {
          const msg = JSON.parse(line);
          this.handleMessage(msg);
        } catch {
          this.emit('raw_stdout', line);
        }
      });
    }
  }

  private handleMessage(msg: any): void {
    // Check if this is a response to a request
    if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
      const req = this.pendingRequests.get(msg.id)!;
      this.pendingRequests.delete(msg.id);
      if (msg.error) {
        req.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      } else {
        req.resolve(msg.result);
      }
      return;
    }

    // Otherwise it's an event notification
    if (msg.type === 'event' || msg.event) {
      const eventName = msg.event || msg.type;
      this.emit('event', msg);
      this.emit(eventName, msg.data || msg);
    } else {
      this.emit('message', msg);
    }
  }

  async send(command: string, params: Record<string, any> = {}): Promise<any> {
    if (!this.process || !this.process.stdin) {
      throw new Error('RPC client is not running');
    }

    const id = ++this.seq;
    const payload = JSON.stringify({ id, method: command, params });

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process!.stdin!.write(payload + '\n');
    });
  }

  async prompt(text: string): Promise<any> {
    return this.send('prompt', { message: text });
  }

  async abort(): Promise<any> {
    return this.send('abort');
  }

  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.cleanup();
    }
  }

  private cleanup(): void {
    this.rl?.close();
    this.rl = null;
    this.process = null;
    for (const [id, req] of this.pendingRequests.entries()) {
      req.reject(new Error('Process terminated'));
    }
    this.pendingRequests.clear();
  }
}
