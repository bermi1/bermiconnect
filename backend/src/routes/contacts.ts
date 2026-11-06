import { parse } from 'csv-parse/sync';
import { Router } from 'express';
import multer from 'multer';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { query, queryOne, tx } from '../db.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { ok, pagination, Where } from '../lib/http.js';
import { normalizePhone } from '../lib/phone.js';
import { acc, auth } from '../middleware/auth.js';

export const contactsRouter = Router();
const dash = auth('dashboard');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CONTACT_COLS = `c.id, c.phone, c.first_name, c.last_name, c.fields, c.opted_out, c.created_at,
  COALESCE((SELECT array_agg(m.group_id) FROM contact_group_members m WHERE m.contact_id = c.id), '{}') AS group_ids`;

async function getContact(accountId: string, id: string) {
  return queryOne(`SELECT ${CONTACT_COLS} FROM contacts c WHERE c.id = $1 AND c.account_id = $2`, [id, accountId]);
}

/** Ensure every group id belongs to the account. */
async function assertGroups(accountId: string, ids: string[]) {
  if (!ids.length) return;
  const r = await query<{ id: string }>('SELECT id FROM contact_groups WHERE account_id = $1 AND id = ANY($2::uuid[])', [
    accountId,
    ids,
  ]);
  if (r.length !== new Set(ids).size) throw notFound('Group');
}

async function setGroups(c: PoolClient, contactId: string, groupIds: string[]) {
  await c.query('DELETE FROM contact_group_members WHERE contact_id = $1', [contactId]);
  if (groupIds.length)
    await c.query(
      `INSERT INTO contact_group_members (group_id, contact_id) SELECT unnest($1::uuid[]), $2 ON CONFLICT DO NOTHING`,
      [groupIds, contactId],
    );
}

const phoneField = z.string().transform((v, ctx) => {
  const p = normalizePhone(v);
  if (!p) {
    ctx.addIssue({ code: 'custom', message: 'Invalid phone number' });
    return z.NEVER;
  }
  return p;
});

const contactSchema = z.object({
  phone: phoneField,
  first_name: z.string().trim().max(100).optional().nullable(),
  last_name: z.string().trim().max(100).optional().nullable(),
  fields: z.record(z.string(), z.any()).optional(),
  opted_out: z.boolean().optional(),
  group_ids: z.array(z.string().uuid()).optional(),
});

contactsRouter.get('/contacts', dash, async (req, res) => {
  const f = z
    .object({ q: z.string().optional(), group_id: z.string().uuid().optional(), opted_out: z.enum(['true', 'false']).optional() })
    .parse(req.query);
  const { page, per_page, offset, limit } = pagination(req.query);
  const w = new Where().add('c.account_id = ?', acc(req));
  if (f.q) {
    const like = `%${f.q}%`;
    w.add(`(c.phone ILIKE ? OR c.first_name ILIKE ? OR c.last_name ILIKE ? OR (c.first_name || ' ' || c.last_name) ILIKE ?)`, like, like, like, like);
  }
  if (f.group_id) w.add('EXISTS (SELECT 1 FROM contact_group_members m WHERE m.contact_id = c.id AND m.group_id = ?)', f.group_id);
  if (f.opted_out) w.add('c.opted_out = ?', f.opted_out === 'true');
  const total = await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM contacts c ${w.sql}`, w.params);
  const rows = await query(
    `SELECT ${CONTACT_COLS} FROM contacts c ${w.sql} ORDER BY c.created_at DESC, c.id LIMIT ${limit} OFFSET ${offset}`,
    w.params,
  );
  ok(res, rows, 200, { page, per_page, total: total?.n ?? 0 });
});

contactsRouter.get('/contacts/:id', dash, async (req, res) => {
  const c = await getContact(acc(req), req.params.id as string);
  if (!c) throw notFound('Contact');
  ok(res, c);
});

contactsRouter.post('/contacts', dash, async (req, res) => {
  const b = contactSchema.parse(req.body);
  const a = acc(req);
  await assertGroups(a, b.group_ids ?? []);
  const id = await tx(async (c) => {
    const r = await c
      .query(
        `INSERT INTO contacts (account_id, phone, first_name, last_name, fields, opted_out)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [a, b.phone, b.first_name ?? null, b.last_name ?? null, b.fields ?? {}, b.opted_out ?? false],
      )
      .catch((e) => {
        if (e?.code === '23505') throw conflict(`Contact with phone ${b.phone} already exists`);
        throw e;
      });
    if (b.group_ids) await setGroups(c, r.rows[0].id, b.group_ids);
    return r.rows[0].id as string;
  });
  ok(res, await getContact(a, id), 201);
});

const patchHandler = async (req: any, res: any) => {
  const b = contactSchema.partial().parse(req.body);
  const a = acc(req);
  const existing = await getContact(a, req.params.id);
  if (!existing) throw notFound('Contact');
  if (b.group_ids) await assertGroups(a, b.group_ids);
  await tx(async (c) => {
    const sets: string[] = [];
    const vals: unknown[] = [req.params.id, a];
    const add = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };
    if (b.phone !== undefined) add('phone', b.phone);
    if (b.first_name !== undefined) add('first_name', b.first_name);
    if (b.last_name !== undefined) add('last_name', b.last_name);
    if (b.fields !== undefined) add('fields', b.fields);
    if (b.opted_out !== undefined) add('opted_out', b.opted_out);
    if (sets.length)
      await c.query(`UPDATE contacts SET ${sets.join(', ')} WHERE id = $1 AND account_id = $2`, vals).catch((e) => {
        if (e?.code === '23505') throw conflict(`Another contact already has phone ${b.phone}`);
        throw e;
      });
    if (b.group_ids) await setGroups(c, req.params.id, b.group_ids);
  });
  ok(res, await getContact(a, req.params.id));
};
contactsRouter.patch('/contacts/:id', dash, patchHandler);
contactsRouter.put('/contacts/:id', dash, patchHandler);

contactsRouter.delete('/contacts/:id', dash, async (req, res) => {
  const r = await queryOne('DELETE FROM contacts WHERE id = $1 AND account_id = $2 RETURNING id', [req.params.id, acc(req)]);
  if (!r) throw notFound('Contact');
  res.status(204).end();
});

/** Not in spec: bulk delete helper for the UI. */
contactsRouter.post('/contacts/bulk-delete', dash, async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string().uuid()).min(1).max(5000) }).parse(req.body);
  const r = await query('DELETE FROM contacts WHERE account_id = $1 AND id = ANY($2::uuid[]) RETURNING id', [acc(req), ids]);
  ok(res, { deleted: r.length });
});

/* ---------------------------------------------------------------- CSV import */

const RESERVED = new Set(['phone', 'first_name', 'last_name']);
const ALIASES: Record<string, string> = {
  msisdn: 'phone', mobile: 'phone', number: 'phone', phone_number: 'phone', simu: 'phone', namba: 'phone',
  firstname: 'first_name', first: 'first_name', jina: 'first_name', name: 'first_name',
  lastname: 'last_name', last: 'last_name', surname: 'last_name',
};

contactsRouter.post('/contacts/import', dash, upload.single('file'), async (req, res) => {
  const a = acc(req);
  if (!req.file) throw badRequest('Upload a CSV file in multipart field "file"');
  const groupId = req.body?.group_id ? z.string().uuid().parse(req.body.group_id) : null;
  if (groupId) await assertGroups(a, [groupId]);

  let records: Record<string, string>[];
  try {
    records = parse(req.file.buffer, {
      columns: (header: string[]) =>
        header.map((h) => {
          const k = h.trim().toLowerCase().replace(/\s+/g, '_').replace(/^﻿/, '');
          return ALIASES[k] ?? k;
        }),
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    });
  } catch (e: any) {
    throw badRequest(`Could not parse CSV: ${e.message}`);
  }
  if (!records.length) throw badRequest('CSV has no rows');
  if (!('phone' in records[0])) throw badRequest('CSV must have a "phone" column');
  if (records.length > 50_000) throw badRequest('Maximum 50,000 rows per import');

  const errors: { row: number; phone: string; reason: string }[] = [];
  const byPhone = new Map<string, { first_name: string | null; last_name: string | null; fields: Record<string, string> }>();
  records.forEach((r, i) => {
    const phone = normalizePhone(r.phone);
    if (!phone) {
      errors.push({ row: i + 2, phone: r.phone ?? '', reason: 'invalid_phone' });
      return;
    }
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) if (!RESERVED.has(k) && k && v !== undefined && v !== '') fields[k] = v;
    byPhone.set(phone, { first_name: r.first_name || null, last_name: r.last_name || null, fields });
  });
  const duplicates = records.length - errors.length - byPhone.size;

  let created = 0;
  let updated = 0;
  await tx(async (c) => {
    const entries = [...byPhone.entries()];
    const CHUNK = 1000;
    for (let i = 0; i < entries.length; i += CHUNK) {
      const chunk = entries.slice(i, i + CHUNK);
      const r = await c.query<{ id: string; inserted: boolean }>(
        `INSERT INTO contacts (account_id, phone, first_name, last_name, fields)
         SELECT $1, x.phone, x.first_name, x.last_name, x.fields
         FROM jsonb_to_recordset($2::jsonb) AS x(phone text, first_name text, last_name text, fields jsonb)
         ON CONFLICT (account_id, phone) DO UPDATE SET
           first_name = COALESCE(EXCLUDED.first_name, contacts.first_name),
           last_name = COALESCE(EXCLUDED.last_name, contacts.last_name),
           fields = contacts.fields || EXCLUDED.fields
         RETURNING id, (xmax = 0) AS inserted`,
        [a, JSON.stringify(chunk.map(([phone, v]) => ({ phone, ...v })))],
      );
      for (const row of r.rows) row.inserted ? created++ : updated++;
      if (groupId && r.rows.length)
        await c.query(
          `INSERT INTO contact_group_members (group_id, contact_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
          [groupId, r.rows.map((x) => x.id)],
        );
    }
  });
  ok(res, {
    total_rows: records.length,
    imported: created + updated,
    created,
    updated,
    skipped: errors.length + duplicates,
    invalid: errors.length,
    duplicates,
    errors: errors.slice(0, 100),
    group_id: groupId,
  });
});

/* ---------------------------------------------------------------- groups */

const GROUP_COLS = `g.id, g.name, g.description, g.created_at,
  (SELECT count(*)::int FROM contact_group_members m WHERE m.group_id = g.id) AS contact_count`;
const groupSchema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().max(500).optional().nullable() });

contactsRouter.get('/groups', dash, async (req, res) => {
  const { q } = z.object({ q: z.string().optional() }).parse(req.query);
  const { page, per_page, offset, limit } = pagination(req.query);
  const w = new Where().add('g.account_id = ?', acc(req));
  if (q) w.add('g.name ILIKE ?', `%${q}%`);
  const total = await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM contact_groups g ${w.sql}`, w.params);
  const rows = await query(`SELECT ${GROUP_COLS} FROM contact_groups g ${w.sql} ORDER BY g.name LIMIT ${limit} OFFSET ${offset}`, w.params);
  ok(res, rows, 200, { page, per_page, total: total?.n ?? 0 });
});

const getGroup = (a: string, id: string) => queryOne(`SELECT ${GROUP_COLS} FROM contact_groups g WHERE g.id = $1 AND g.account_id = $2`, [id, a]);

contactsRouter.get('/groups/:id', dash, async (req, res) => {
  const g = await getGroup(acc(req), req.params.id as string);
  if (!g) throw notFound('Group');
  ok(res, g);
});

contactsRouter.post('/groups', dash, async (req, res) => {
  const b = groupSchema.parse(req.body);
  const r = await queryOne<{ id: string }>(
    'INSERT INTO contact_groups (account_id, name, description) VALUES ($1, $2, $3) RETURNING id',
    [acc(req), b.name, b.description ?? null],
  );
  ok(res, await getGroup(acc(req), r!.id), 201);
});

const groupPatch = async (req: any, res: any) => {
  const b = groupSchema.partial().parse(req.body);
  const r = await queryOne(
    `UPDATE contact_groups SET name = COALESCE($3, name), description = CASE WHEN $4::boolean THEN $5 ELSE description END
     WHERE id = $1 AND account_id = $2 RETURNING id`,
    [req.params.id, acc(req), b.name ?? null, b.description !== undefined, b.description ?? null],
  );
  if (!r) throw notFound('Group');
  ok(res, await getGroup(acc(req), req.params.id));
};
contactsRouter.patch('/groups/:id', dash, groupPatch);
contactsRouter.put('/groups/:id', dash, groupPatch);

contactsRouter.delete('/groups/:id', dash, async (req, res) => {
  const r = await queryOne('DELETE FROM contact_groups WHERE id = $1 AND account_id = $2 RETURNING id', [req.params.id, acc(req)]);
  if (!r) throw notFound('Group');
  res.status(204).end();
});

contactsRouter.post('/groups/:id/contacts', dash, async (req, res) => {
  const { contact_ids } = z.object({ contact_ids: z.array(z.string().uuid()).min(1).max(10000) }).parse(req.body);
  const a = acc(req);
  if (!(await getGroup(a, req.params.id as string))) throw notFound('Group');
  const r = await query(
    `INSERT INTO contact_group_members (group_id, contact_id)
     SELECT $1, c.id FROM contacts c WHERE c.account_id = $2 AND c.id = ANY($3::uuid[])
     ON CONFLICT DO NOTHING RETURNING contact_id`,
    [req.params.id, a, contact_ids],
  );
  ok(res, { added: r.length, group: await getGroup(a, req.params.id as string) });
});

contactsRouter.delete('/groups/:id/contacts/:contactId', dash, async (req, res) => {
  const a = acc(req);
  if (!(await getGroup(a, req.params.id as string))) throw notFound('Group');
  const r = await queryOne(
    `DELETE FROM contact_group_members m USING contacts c
     WHERE m.group_id = $1 AND m.contact_id = $2 AND c.id = m.contact_id AND c.account_id = $3 RETURNING m.contact_id`,
    [req.params.id, req.params.contactId, a],
  );
  if (!r) throw notFound('Group member');
  res.status(204).end();
});

/* ---------------------------------------------------------------- templates */

const tplSchema = z.object({ name: z.string().trim().min(1).max(120), body: z.string().min(1).max(3000) });
const TPL_COLS = 'id, name, body, created_at';

contactsRouter.get('/templates', dash, async (req, res) => {
  const { page, per_page, offset, limit } = pagination(req.query);
  const total = await queryOne<{ n: number }>('SELECT count(*)::int AS n FROM templates WHERE account_id = $1', [acc(req)]);
  const rows = await query(`SELECT ${TPL_COLS} FROM templates WHERE account_id = $1 ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, [
    acc(req),
  ]);
  ok(res, rows, 200, { page, per_page, total: total?.n ?? 0 });
});

contactsRouter.get('/templates/:id', dash, async (req, res) => {
  const t = await queryOne(`SELECT ${TPL_COLS} FROM templates WHERE id = $1 AND account_id = $2`, [req.params.id, acc(req)]);
  if (!t) throw notFound('Template');
  ok(res, t);
});

contactsRouter.post('/templates', dash, async (req, res) => {
  const b = tplSchema.parse(req.body);
  ok(res, await queryOne(`INSERT INTO templates (account_id, name, body) VALUES ($1, $2, $3) RETURNING ${TPL_COLS}`, [acc(req), b.name, b.body]), 201);
});

const tplPatch = async (req: any, res: any) => {
  const b = tplSchema.partial().parse(req.body);
  const t = await queryOne(
    `UPDATE templates SET name = COALESCE($3, name), body = COALESCE($4, body) WHERE id = $1 AND account_id = $2 RETURNING ${TPL_COLS}`,
    [req.params.id, acc(req), b.name ?? null, b.body ?? null],
  );
  if (!t) throw notFound('Template');
  ok(res, t);
};
contactsRouter.patch('/templates/:id', dash, tplPatch);
contactsRouter.put('/templates/:id', dash, tplPatch);

contactsRouter.delete('/templates/:id', dash, async (req, res) => {
  const r = await queryOne('DELETE FROM templates WHERE id = $1 AND account_id = $2 RETURNING id', [req.params.id, acc(req)]);
  if (!r) throw notFound('Template');
  res.status(204).end();
});
