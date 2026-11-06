import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { pool, tx } from './db.js';
import { sha256 } from './lib/crypto.js';
import { credit } from './services/billing.js';

/**
 * Idempotent demo seed. Re-running resets the demo account.
 * Fixed demo API keys (so docs/frontend can reference them in local dev):
 */
const DEMO_EMAIL = 'demo@bermiconnect.co.tz';
const DEMO_PASSWORD = 'demo1234';
export const DEMO_TEST_KEY = 'bc_test_demo0000000000000000000000000000';
export const DEMO_LIVE_KEY = 'bc_live_demo0000000000000000000000000000';

const CONTACTS: [string, string, string, Record<string, string>, string[]][] = [
  // phone, first, last, fields, groups (P = Form 4 Parents, T = Teachers)
  ['0712345601', 'Amina', 'Mwakyusa', { student: 'Neema Mwakyusa', class: 'Form 4A', fee_balance: '150,000' }, ['P']],
  ['0754123402', 'Juma', 'Kassim', { student: 'Ali Juma', class: 'Form 4B', fee_balance: '80,000' }, ['P']],
  ['0765987603', 'Grace', 'Massawe', { student: 'Daniel Massawe', class: 'Form 4A', fee_balance: '0' }, ['P']],
  ['0688112204', 'Hassan', 'Mohamed', { student: 'Zuhura Hassan', class: 'Form 4C', fee_balance: '220,000' }, ['P']],
  ['0623456705', 'Rehema', 'Said', { student: 'Mussa Said', class: 'Form 4B', fee_balance: '45,000' }, ['P']],
  ['0744556606', 'Emmanuel', 'Mrema', { student: 'Esther Mrema', class: 'Form 4A', fee_balance: '120,000' }, ['P']],
  ['0715667707', 'Mwanaisha', 'Ally', { student: 'Rashidi Ally', class: 'Form 4C', fee_balance: '0' }, ['P']],
  ['0786778808', 'Peter', 'Kimaro', { student: 'Joyce Kimaro', class: 'Form 4B', fee_balance: '60,000' }, ['P']],
  ['0656889909', 'Fatuma', 'Mfinanga', { student: 'Salma Mfinanga', class: 'Form 4A', fee_balance: '95,000' }, ['P']],
  ['0767990010', 'Joseph', 'Lyimo', { student: 'Baraka Lyimo', class: 'Form 4C', fee_balance: '30,000' }, ['P']],
  ['0713101011', 'Zainabu', 'Omari', { student: 'Halima Omari', class: 'Form 4B', fee_balance: '175,000' }, ['P']],
  ['0755212112', 'Godfrey', 'Shirima', { student: 'Lucy Shirima', class: 'Form 4A', fee_balance: '0' }, ['P']],
  ['0689323213', 'Mariam', 'Nyerere', { student: 'Kelvin Nyerere', class: 'Form 4C', fee_balance: '110,000' }, ['P']],
  ['0717434314', 'Baraka', 'Mollel', { subject: 'Mathematics' }, ['T']],
  ['0762545415', 'Neema', 'Swai', { subject: 'Kiswahili' }, ['T']],
  ['0658656516', 'Daudi', 'Mushi', { subject: 'Physics' }, ['T']],
  ['0745767617', 'Upendo', 'Minja', { subject: 'English' }, ['T']],
  ['0784878718', 'Salum', 'Bakari', { subject: 'Biology' }, ['T']],
  ['0629989819', 'Esther', 'Temba', { subject: 'Chemistry', student: 'Gift Temba', class: 'Form 4A', fee_balance: '0' }, ['T', 'P']],
  ['0718090920', 'Khamis', 'Juma', { subject: 'History' }, ['T']],
];

const TEMPLATES: [string, string][] = [
  [
    'Fee reminder / Kumbusho la ada',
    'Ndugu {{first_name}}, tunakukumbusha ada ya {{student}} ({{class}}) ni TZS {{fee_balance}}. Tafadhali lipa kabla ya tarehe 30. Dear parent, fee balance is TZS {{fee_balance}}. Asante — Demo Secondary School',
  ],
  [
    'Exam results / Matokeo ya mtihani',
    'Habari {{first_name}}, matokeo ya mtihani wa {{student}} ({{class}}) yametoka. Exam results for {{student}} are ready — collect the report at the school office. Demo Secondary School',
  ],
  [
    'Parents meeting / Mkutano wa wazazi',
    'Ndugu mzazi {{first_name}}, unakaribishwa kwenye mkutano wa wazazi Jumamosi saa 3 asubuhi shuleni. Parents meeting this Saturday at 9:00 AM at the school hall. Karibu!',
  ],
];

async function main() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const out = await tx(async (c) => {
    // reset existing demo account
    const old = await c.query<{ account_id: string }>('SELECT account_id FROM users WHERE email = $1', [DEMO_EMAIL]);
    if (old.rows[0]) await c.query('DELETE FROM accounts WHERE id = $1', [old.rows[0].account_id]);
    await c.query('DELETE FROM api_keys WHERE key_hash = ANY($1)', [[sha256(DEMO_TEST_KEY), sha256(DEMO_LIVE_KEY)]]);

    const acc = (
      await c.query<{ id: string }>(`INSERT INTO accounts (name, type, phone) VALUES ('Demo Secondary School', 'school', '+255712000000') RETURNING id`)
    ).rows[0].id;
    await c.query(`INSERT INTO users (account_id, name, email, password_hash, role) VALUES ($1, 'Mwalimu Mkuu (Demo)', $2, $3, 'owner')`, [
      acc,
      DEMO_EMAIL,
      hash,
    ]);
    await credit(c, acc, 10000, 'bonus', 'Demo credit', 'seed');

    await c.query(`INSERT INTO sender_ids (account_id, name, purpose, status) VALUES ($1, 'DEMOSCHOOL', 'School notices to parents and staff', 'approved')`, [acc]);
    await c.query(`INSERT INTO sender_ids (account_id, name, purpose, status) VALUES ($1, 'DSS-ALERT', 'Emergency alerts', 'pending')`, [acc]);

    const gP = (await c.query(`INSERT INTO contact_groups (account_id, name, description) VALUES ($1, 'Form 4 Parents', 'Parents & guardians of Form 4 students') RETURNING id`, [acc])).rows[0].id;
    const gT = (await c.query(`INSERT INTO contact_groups (account_id, name, description) VALUES ($1, 'Teachers', 'Teaching staff') RETURNING id`, [acc])).rows[0].id;

    for (const [phone, first, last, fields, groups] of CONTACTS) {
      const e164 = '+255' + phone.slice(1);
      const id = (
        await c.query(`INSERT INTO contacts (account_id, phone, first_name, last_name, fields) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [
          acc,
          e164,
          first,
          last,
          fields,
        ])
      ).rows[0].id;
      for (const g of groups) await c.query('INSERT INTO contact_group_members (group_id, contact_id) VALUES ($1, $2)', [g === 'P' ? gP : gT, id]);
    }
    for (const [name, body] of TEMPLATES) await c.query('INSERT INTO templates (account_id, name, body) VALUES ($1, $2, $3)', [acc, name, body]);

    await c.query(`INSERT INTO api_keys (account_id, name, prefix, key_hash, mode) VALUES ($1, 'Demo test key', $2, $3, 'test')`, [
      acc,
      DEMO_TEST_KEY.slice(0, 12),
      sha256(DEMO_TEST_KEY),
    ]);
    await c.query(`INSERT INTO api_keys (account_id, name, prefix, key_hash, mode) VALUES ($1, 'Demo live key', $2, $3, 'live')`, [
      acc,
      DEMO_LIVE_KEY.slice(0, 12),
      sha256(DEMO_LIVE_KEY),
    ]);
    return { acc, gP, gT };
  });

  console.log('\n  Bermi Connect demo data seeded\n  ------------------------------');
  console.log(`  Account:     Demo Secondary School (${out.acc})`);
  console.log(`  Login:       ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Balance:     TZS 10,000   (price TZS ${config.smsPriceTzs}/segment)`);
  console.log('  Sender ID:   DEMOSCHOOL (approved), DSS-ALERT (pending)');
  console.log(`  Groups:      Form 4 Parents (${out.gP}), Teachers (${out.gT})`);
  console.log(`  Contacts:    ${CONTACTS.length}, Templates: ${TEMPLATES.length}`);
  console.log(`  Test key:    ${DEMO_TEST_KEY}   (simulated, no charge)`);
  console.log(`  Live key:    ${DEMO_LIVE_KEY}   (real sends via SMS_PROVIDER, charged)\n`);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
