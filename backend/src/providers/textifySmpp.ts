import smpp from 'smpp';
import { config } from '../config.js';
import { toSmppAddr } from '../lib/phone.js';
import { cleanText, splitParts, SEGMENT_CHARS } from '../lib/segments.js';
import { logger } from '../logger.js';
import { parseReceipt } from '../lib/dlr.js';
import { PermanentSendError, type ProviderEvents, type SendRequest, type SendResult, type SmsProvider } from './types.js';

const log = logger.child({ mod: 'smpp' });

// command_status codes worth retrying
const TRANSIENT = new Set([0x08, 0x14, 0x58, 0x45, 0x64]); // SYSERR, MSGQFUL, THROTTLED, SUBMITFAIL, TXTMPFAIL

/** Simple token bucket throttling SMPP PDUs to TEXTIFY_SMPP_TPS. */
class Throttle {
  private tokens: number;
  private last = Date.now();
  private waiters: Array<() => void> = [];
  private timer: NodeJS.Timeout | null = null;
  constructor(private tps: number) {
    this.tokens = tps;
  }
  private refill() {
    const now = Date.now();
    this.tokens = Math.min(this.tps, this.tokens + ((now - this.last) / 1000) * this.tps);
    this.last = now;
  }
  private pump = () => {
    this.timer = null;
    this.refill();
    while (this.waiters.length && this.tokens >= 1) {
      this.tokens -= 1;
      this.waiters.shift()!();
    }
    if (this.waiters.length) this.timer = setTimeout(this.pump, Math.ceil(1000 / this.tps));
  };
  take(): Promise<void> {
    return new Promise((resolve) => {
      this.waiters.push(resolve);
      if (!this.timer) this.pump();
    });
  }
}

interface InboundPartial {
  parts: Map<number, string>;
  total: number;
  from: string;
  to: string;
  timer: NodeJS.Timeout;
}

export class TextifySmppProvider implements SmsProvider {
  readonly name = 'textify_smpp';
  private session: any = null;
  private bound = false;
  private stopping = false;
  private attempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private enquireTimer: NodeJS.Timeout | null = null;
  private events: ProviderEvents = {};
  private throttle = new Throttle(config.smpp.tps);
  private bindWaiters: Array<() => void> = [];
  private ref = Math.floor(Math.random() * 256);
  private inbound = new Map<string, InboundPartial>();

  async start(events: ProviderEvents) {
    this.events = events;
    this.connect();
  }

  status(): 'bound' | 'down' {
    return this.bound ? 'bound' : 'down';
  }

  private connect() {
    if (this.stopping) return;
    const { host, port, tls, systemId, password, systemType } = config.smpp;
    log.info({ host, port, tls }, 'connecting to SMSC');
    const session = smpp.connect({ url: `${tls ? 'ssmpp' : 'smpp'}://${host}:${port}`, connectTimeout: 15000 });
    this.session = session;

    session.on(tls ? 'secureConnect' : 'connect', () => {
      session.bind_transceiver(
        { system_id: systemId, password, system_type: systemType, interface_version: 0x34 },
        (pdu: any) => {
          if (pdu.command_status !== 0) {
            log.error({ status: pdu.command_status }, 'bind_transceiver rejected');
            session.destroy();
            return;
          }
          this.bound = true;
          this.attempt = 0;
          log.info({ system_id: systemId }, 'SMPP transceiver bound');
          this.startEnquireLink();
          const w = this.bindWaiters;
          this.bindWaiters = [];
          w.forEach((f) => f());
        },
      );
    });

    session.on('deliver_sm', (pdu: any) => {
      session.send(pdu.response());
      void this.onDeliverSm(pdu).catch((err) => log.error({ err }, 'deliver_sm handling failed'));
    });
    session.on('enquire_link', (pdu: any) => session.send(pdu.response()));
    session.on('unbind', (pdu: any) => {
      session.send(pdu.response());
      session.close();
    });
    session.on('error', (err: any) => log.warn({ err: err?.message ?? err }, 'SMPP socket error'));
    session.on('close', () => {
      if (this.session !== session) return;
      this.bound = false;
      this.stopEnquireLink();
      if (!this.stopping) this.scheduleReconnect();
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(60_000, 1000 * 2 ** this.attempt) + Math.floor(Math.random() * 500);
    this.attempt = Math.min(this.attempt + 1, 6);
    log.warn({ delay }, 'SMPP disconnected, reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startEnquireLink() {
    this.stopEnquireLink();
    this.enquireTimer = setInterval(() => {
      if (!this.bound) return;
      let answered = false;
      this.session.enquire_link({}, () => (answered = true));
      setTimeout(() => {
        if (!answered && this.bound) {
          log.warn('enquire_link timeout, dropping connection');
          this.session.destroy();
        }
      }, 10_000);
    }, config.smpp.enquireLinkMs);
  }

  private stopEnquireLink() {
    if (this.enquireTimer) clearInterval(this.enquireTimer);
    this.enquireTimer = null;
  }

  private waitForBind(timeoutMs = 10_000): Promise<void> {
    if (this.bound) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.bindWaiters = this.bindWaiters.filter((f) => f !== done);
        reject(new Error('SMPP not bound'));
      }, timeoutMs);
      const done = () => {
        clearTimeout(t);
        resolve();
      };
      this.bindWaiters.push(done);
    });
  }

  private submit(params: Record<string, unknown>): Promise<string> {
    return new Promise((resolve, reject) => {
      const ok = this.session.submit_sm(
        params,
        (pdu: any) => {
          if (pdu.command_status === 0) return resolve(String(pdu.message_id));
          const code = `0x${Number(pdu.command_status).toString(16).padStart(8, '0')}`;
          if (TRANSIENT.has(pdu.command_status)) reject(new Error(`submit_sm transient error ${code}`));
          else reject(new PermanentSendError(`smpp_${code}`, `submit_sm rejected with status ${code}`));
        },
        undefined,
        () => reject(new Error('submit_sm write failed')),
      );
      if (ok === false) reject(new Error('SMPP socket not writable'));
      setTimeout(() => reject(new Error('submit_sm_resp timeout')), 30_000);
    });
  }

  /**
   * Textify rules: plain ASCII text (anything else is removed upstream, so we clean it first),
   * data_coding 0, registered_delivery 1. Long messages go in ONE submit_sm using the message_payload
   * TLV (TEXTIFY_SMPP_LONG_MODE=payload, the default). 'udh' splits into 153-char concatenated parts
   * and is only meant for the local mock SMSC / other SMSCs.
   */
  async send(req: SendRequest): Promise<SendResult> {
    await this.waitForBind();
    const text = cleanText(req.body);
    const alpha = /[^0-9+]/.test(req.from);
    const base = {
      source_addr_ton: alpha ? 5 : 1,
      source_addr_npi: alpha ? 0 : 1,
      source_addr: alpha ? req.from : toSmppAddr(req.from),
      dest_addr_ton: 1,
      dest_addr_npi: 1,
      destination_addr: toSmppAddr(req.to),
      registered_delivery: 1,
      data_coding: 0x00,
    };
    const ids: string[] = [];
    if (text.length <= SEGMENT_CHARS) {
      await this.throttle.take();
      ids.push(await this.submit({ ...base, short_message: Buffer.from(text, 'ascii') }));
    } else if (config.smpp.longMode === 'payload') {
      await this.throttle.take();
      ids.push(await this.submit({ ...base, short_message: Buffer.alloc(0), message_payload: Buffer.from(text, 'ascii') }));
    } else {
      const parts = splitParts(text);
      const ref = (this.ref = (this.ref + 1) % 256);
      for (let i = 0; i < parts.length; i++) {
        // UDH: IEI 0x00 (8-bit concat ref), len 3, ref, total, seq
        const udh = Buffer.from([0x05, 0x00, 0x03, ref, parts.length, i + 1]);
        await this.throttle.take();
        ids.push(await this.submit({ ...base, esm_class: 0x40, short_message: { udh, message: parts[i] } }));
      }
    }
    return { providerMessageId: ids[0], providerMessageIds: ids };
  }

  private async onDeliverSm(pdu: any) {
    const esm = Number(pdu.esm_class ?? 0);
    const sm = pdu.short_message;
    const text: string = typeof sm === 'string' ? sm : sm?.message ? String(sm.message) : pdu.message_payload?.message ?? '';
    const isReceipt = (esm & 0x3c) === 0x04 || (esm & 0x04) === 0x04;
    if (isReceipt) {
      const parsed = parseReceipt(text);
      const id = pdu.receipted_message_id || parsed?.id;
      const stat = parsed?.stat ?? (pdu.message_state === 2 ? 'DELIVRD' : 'UNDELIV');
      if (!id) {
        log.warn({ text }, 'unparseable delivery receipt');
        return;
      }
      await this.events.onReceipt?.({ providerMessageId: String(id), stat, err: parsed?.err ?? null });
      return;
    }
    // Mobile-originated message, possibly concatenated
    const from = String(pdu.source_addr ?? '');
    const to = String(pdu.destination_addr ?? '');
    const udh: Buffer[] | undefined = sm?.udh;
    const concat = udh?.find((u) => u[0] === 0x00 || u[0] === 0x08);
    if (concat) {
      const ref = concat[0] === 0x00 ? concat[2] : concat.readUInt16BE(2);
      const total = concat[0] === 0x00 ? concat[3] : concat[4];
      const seq = concat[0] === 0x00 ? concat[4] : concat[5];
      const key = `${from}:${ref}`;
      let entry = this.inbound.get(key);
      if (!entry) {
        entry = {
          parts: new Map(),
          total,
          from,
          to,
          timer: setTimeout(() => this.flushInbound(key), 60_000),
        };
        this.inbound.set(key, entry);
      }
      entry.parts.set(seq, text);
      if (entry.parts.size >= entry.total) this.flushInbound(key);
      return;
    }
    await this.events.onInbound?.({ from, to, body: text });
  }

  private flushInbound(key: string) {
    const e = this.inbound.get(key);
    if (!e) return;
    clearTimeout(e.timer);
    this.inbound.delete(key);
    const body = [...e.parts.entries()].sort((a, b) => a[0] - b[0]).map((p) => p[1]).join('');
    void Promise.resolve(this.events.onInbound?.({ from: e.from, to: e.to, body })).catch((err) =>
      log.error({ err }, 'inbound handling failed'),
    );
  }

  async stop() {
    this.stopping = true;
    this.stopEnquireLink();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.session && this.bound) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 2000);
        this.session.unbind({}, () => {
          clearTimeout(t);
          resolve();
        });
      });
    }
    this.session?.close();
    this.bound = false;
  }
}
