// WebSerial JSON-lines client for the M5StampS3 bridge firmware.

export interface BridgeResponse {
  ok: boolean;
  err?: string;
  [key: string]: unknown;
}

export class Bridge {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readAbort: AbortController | null = null;
  private pending: ((line: string) => void)[] = [];
  onDisconnect: (() => void) | null = null;
  onLog: ((dir: 'tx' | 'rx', line: string) => void) | null = null;

  get connected(): boolean {
    return this.port !== null;
  }

  async connect(): Promise<void> {
    if (!('serial' in navigator)) {
      throw new Error('WebSerial非対応ブラウザです。Chrome/Edgeを使ってください。');
    }
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    this.port = port;
    this.writer = port.writable!.getWriter();
    this.readAbort = new AbortController();
    this.readLoop().catch(() => this.teardown());
  }

  async disconnect(): Promise<void> {
    this.readAbort?.abort();
    try {
      this.writer?.releaseLock();
      await this.port?.close();
    } catch {
      /* already gone */
    }
    this.teardown();
  }

  private teardown() {
    this.port = null;
    this.writer = null;
    this.pending.forEach((r) => r(''));
    this.pending = [];
    this.onDisconnect?.();
  }

  private async readLoop() {
    const decoder = new TextDecoder();
    let buf = '';
    while (this.port?.readable) {
      const reader = this.port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            this.onLog?.('rx', line);
            this.pending.shift()?.(line);
          }
        }
      } finally {
        reader.releaseLock();
      }
      if (this.readAbort?.signal.aborted) break;
    }
    this.teardown();
  }

  async request(cmd: object, timeoutMs = 15000): Promise<BridgeResponse> {
    if (!this.writer) throw new Error('未接続です');
    const line = JSON.stringify(cmd);
    const promise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.pending.indexOf(handler);
        if (i >= 0) this.pending.splice(i, 1);
        reject(new Error('応答タイムアウト'));
      }, timeoutMs);
      const handler = (l: string) => {
        clearTimeout(timer);
        l ? resolve(l) : reject(new Error('切断されました'));
      };
      this.pending.push(handler);
    });
    this.onLog?.('tx', line);
    await this.writer.write(new TextEncoder().encode(line + '\n'));
    const text = await promise;
    const res = JSON.parse(text) as BridgeResponse;
    if (!res.ok) throw new Error(res.err ?? 'ブリッジエラー');
    return res;
  }
}

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
