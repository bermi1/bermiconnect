/**
 * Mock SMPP server (SMSC) for local testing without Textify.
 *  - accepts any bind credentials (plain TCP; production Textify uses TLS on :2776)
 *  - accepts long messages in the message_payload TLV (Textify) or as UDH parts
 *  - answers submit_sm with a message id
 *  - ~2s later sends a deliver_sm receipt: 90% DELIVRD, 10% UNDELIV
 *  - destinations ending in "0000" are always UNDELIV, "9999" are rejected at submit (ESME_RINVDSTADR)
 *  - type a line on stdin "MO <msisdn> <text>" to inject an inbound message (e.g. "MO 255712345601 STOP")
 *
 * Env: MOCK_SMSC_PORT (default 2775), MOCK_SMSC_DLR_DELAY_MS (2000), MOCK_SMSC_FAIL_RATE (0.1)
 * Also exposes a tiny HTTP control port (MOCK_SMSC_HTTP_PORT, default 2776): POST /mo {from,to,text}
 */
import crypto from 'node:crypto';
import http from 'node:http';
import readline from 'node:readline';
import smpp from 'smpp';

const PORT = Number(process.env.MOCK_SMSC_PORT ?? 2775);
const HTTP_PORT = Number(process.env.MOCK_SMSC_HTTP_PORT ?? 2776);
const DLR_DELAY = Number(process.env.MOCK_SMSC_DLR_DELAY_MS ?? 2000);
const FAIL_RATE = Number(process.env.MOCK_SMSC_FAIL_RATE ?? 0.1);

const sessions = new Set<any>();
let submitted = 0;

const pad = (n: number) => String(n).padStart(2, '0');
const smppDate = (d: Date) => `${pad(d.getUTCFullYear() % 100)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;

const log = (...a: unknown[]) => console.log(`[mock-smsc ${new Date().toISOString().slice(11, 19)}]`, ...a);

const server = smpp.createServer({ debug: false }, (session: any) => {
  let bound = false;
  session.on('error', (e: any) => log('session error', e?.message ?? e));

  const onBind = (pdu: any) => {
    bound = true;
    sessions.add(session);
    log(`${pdu.command} from system_id="${pdu.system_id}" accepted`);
    session.send(pdu.response({ system_id: 'MOCKSMSC' }));
  };
  session.on('bind_transceiver', onBind);
  session.on('bind_transmitter', onBind);
  session.on('bind_receiver', onBind);

  session.on('enquire_link', (pdu: any) => session.send(pdu.response()));
  session.on('unbind', (pdu: any) => {
    session.send(pdu.response());
    session.close();
  });
  session.on('close', () => sessions.delete(session));

  session.on('submit_sm', (pdu: any) => {
    try {
      onSubmit(pdu);
    } catch (e: any) {
      log('submit_sm handling error', e?.message ?? e);
    }
  });

  const onSubmit = (pdu: any) => {
    if (!bound) return session.send(pdu.response({ command_status: smpp.ESME_RINVBNDSTS }));
    const dest = String(pdu.destination_addr);
    if (dest.endsWith('9999')) {
      log(`submit_sm to ${dest} REJECTED (invalid dest)`);
      return session.send(pdu.response({ command_status: smpp.ESME_RINVDSTADR }));
    }
    const id = crypto.randomBytes(8).toString('hex');
    submitted++;
    const sm = pdu.short_message;
    const mp = pdu.message_payload;
    const asText = (v: any) => (v == null ? '' : typeof v === 'string' ? v : Buffer.isBuffer(v) ? v.toString('ascii') : String(v.message ?? ''));
    // Textify style: long text in the message_payload TLV with an empty short_message
    const text = mp ? asText(mp) : asText(sm);
    if (mp && asText(sm)) return session.send(pdu.response({ command_status: smpp.ESME_RINVPARLEN }));
    const udh = sm?.udh?.[0];
    const partInfo = udh && udh[0] === 0x00 ? ` part ${udh[4]}/${udh[3]}` : mp ? ` payload ${text.length} chars` : '';
    log(`submit_sm #${submitted} ${pdu.source_addr} -> ${dest} dc=${pdu.data_coding}${partInfo} id=${id}: ${text.slice(0, 60)}`);
    session.send(pdu.response({ message_id: id }));

    if (pdu.registered_delivery & 0x01) {
      const submitDate = new Date();
      setTimeout(() => {
        if (session.closed) return;
        const fail = dest.endsWith('0000') || Math.random() < FAIL_RATE;
        const stat = fail ? 'UNDELIV' : 'DELIVRD';
        const err = fail ? '001' : '000';
        const receipt = `id:${id} sub:001 dlvrd:${fail ? '000' : '001'} submit date:${smppDate(submitDate)} done date:${smppDate(new Date())} stat:${stat} err:${err} text:${text.replace(/[^ -~]/g, '?').slice(0, 20)}`;
        try {
        session.deliver_sm(
          {
            source_addr: dest,
            source_addr_ton: 1,
            source_addr_npi: 1,
            destination_addr: String(pdu.source_addr),
            esm_class: 0x04,
            data_coding: 0,
            short_message: Buffer.from(receipt, 'ascii'),
            receipted_message_id: id,
            message_state: fail ? 5 : 2,
          },
          () => {},
        );
        } catch (e: any) {
          log('deliver_sm build error', e?.message ?? e);
        }
        log(`deliver_sm DLR id=${id} stat=${stat}`);
      }, DLR_DELAY + Math.floor(Math.random() * 300));
    }
  };
});

server.listen(PORT, () => log(`listening on ${PORT} (DLR delay ${DLR_DELAY}ms, fail rate ${FAIL_RATE})`));

function injectMo(from: string, to: string, text: string) {
  let n = 0;
  for (const s of sessions) {
    s.deliver_sm({ source_addr: from.replace(/^\+/, ''), source_addr_ton: 1, source_addr_npi: 1, destination_addr: to, esm_class: 0, short_message: text }, () => {});
    n++;
  }
  log(`MO from ${from} "${text}" -> ${n} session(s)`);
  return n;
}

http
  .createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/mo') {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        try {
          const b = JSON.parse(data || '{}');
          const n = injectMo(String(b.from), String(b.to ?? 'BERMI'), String(b.text ?? ''));
          res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ delivered_to_sessions: n }));
        } catch (e: any) {
          res.writeHead(400).end(e.message);
        }
      });
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ sessions: sessions.size, submitted }));
  })
  .listen(HTTP_PORT, () => log(`control HTTP on ${HTTP_PORT} (POST /mo {from,to,text})`));

if (process.stdin.isTTY) {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    const m = /^MO\s+(\S+)\s+(.+)$/i.exec(line.trim());
    if (m) injectMo(m[1], 'BERMI', m[2]);
  });
}
