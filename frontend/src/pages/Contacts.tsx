import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Plus, Upload, Pencil, Trash2, FolderPlus, UserMinus, Check } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import type { Contact, Group } from '../lib/types';
import { groupSize, useGroups } from '../lib/hooks';
import { Button, Empty, ErrorBox, Field, Input, Modal, PageHeader, Pager, Select, StatusBadge, TableSkeleton, Textarea, cx } from '../components/ui';
import { useToast } from '../components/Toast';
import { int, parseCsv } from '../lib/format';
import { normalisePhone } from '../lib/sms';

export default function Contacts() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'groups' ? 'groups' : 'contacts';
  return (
    <div className="animate-rise">
      <PageHeader title="Contacts" subtitle="The people you send to, organised into groups." />
      <div className="inline-flex rounded-xl bg-ink/[0.05] p-1 mb-5">
        {(['contacts', 'groups'] as const).map((t) => (
          <button key={t} onClick={() => setSp(t === 'groups' ? { tab: 'groups' } : {})}
            className={cx('h-10 px-5 rounded-lg text-sm font-semibold capitalize', tab === t ? 'bg-white shadow-sm text-ink' : 'text-ink-500')}>{t}</button>
        ))}
      </div>
      {tab === 'contacts' ? <ContactsTab /> : <GroupsTab />}
    </div>
  );
}

function ContactsTab() {
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [groupId, setGroupId] = useState('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Contact | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [del, setDel] = useState<Contact | null>(null);
  const groups = useGroups();
  const qc = useQueryClient();
  const toast = useToast();
  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

  const list = useQuery({ queryKey: ['contacts', dq, groupId, page], queryFn: () => api.page<Contact[]>('/contacts', { q: dq, group_id: groupId, page, per_page: 50 }) });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/contacts/${id}`),
    onSuccess: () => { toast.success('Contact deleted.'); setDel(null); qc.invalidateQueries({ queryKey: ['contacts'] }); qc.invalidateQueries({ queryKey: ['groups'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const rows = list.data?.data || [];

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone" className="pl-10" aria-label="Search contacts" />
        </div>
        <Select value={groupId} onChange={(e) => { setGroupId(e.target.value); setPage(1); }} className="sm:w-56" aria-label="Filter by group">
          <option value="">All groups</option>
          {(groups.data || []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <Button variant="outline" icon={<Upload className="h-4 w-4" />} onClick={() => setImporting(true)}>Import CSV</Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit('new')}>Add contact</Button>
        </div>
      </div>

      <div className="panel overflow-hidden">
        {list.isLoading ? <TableSkeleton /> : list.isError ? <ErrorBox error={list.error} onRetry={() => list.refetch()} /> : !rows.length ? (
          <Empty icon={<Users className="h-6 w-6" />} title={dq || groupId ? 'No contacts match' : 'Add your first contacts'}
            body={dq || groupId ? 'Try a different search or group.' : 'Import a list from Excel (save it as CSV) or add people one by one.'}
            action={!dq && !groupId && <div className="flex gap-2 justify-center"><Button variant="outline" onClick={() => setImporting(true)}>Import CSV</Button><Button onClick={() => setEdit('new')}>Add contact</Button></div>} />
        ) : (
          <>
            {/* Mobile list */}
            <ul className="sm:hidden divide-y divide-line">
              {rows.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-10 w-10 rounded-full bg-brand-50 text-brand-700 grid place-items-center font-bold text-sm shrink-0">{(c.first_name || c.phone.slice(-2)).slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{[c.first_name, c.last_name].filter(Boolean).join(' ') || 'No name'}</div>
                    <div className="text-[13px] text-ink-500 tabular-nums">{c.phone}{c.opted_out && ' · opted out'}</div>
                  </div>
                  <button onClick={() => setEdit(c)} className="h-10 w-10 grid place-items-center rounded-lg hover:bg-ink/5" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <div className="hidden sm:block overflow-x-auto">
              <table className="table-base">
                <thead><tr><th>Name</th><th>Phone</th><th>Other fields</th><th>Status</th><th className="w-24" /></tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="hover:bg-paper/60">
                      <td className="font-semibold">{[c.first_name, c.last_name].filter(Boolean).join(' ') || <span className="text-ink-400 font-normal">No name</span>}</td>
                      <td className="tabular-nums">{c.phone}</td>
                      <td className="text-ink-500 text-[13px] max-w-[260px] truncate">{Object.entries(c.fields || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'}</td>
                      <td>{c.opted_out ? <StatusBadge status="cancelled" label="Opted out" /> : <StatusBadge status="active" label="Active" />}</td>
                      <td className="text-right whitespace-nowrap">
                        <button onClick={() => setEdit(c)} className="h-9 w-9 inline-grid place-items-center rounded-lg hover:bg-ink/5" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setDel(c)} className="h-9 w-9 inline-grid place-items-center rounded-lg hover:bg-bad/10 text-bad" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <Pager page={page} perPage={50} total={list.data?.meta?.total} onPage={setPage} />
      </div>

      {edit && <ContactModal contact={edit === 'new' ? null : edit} groups={groups.data || []} onClose={() => setEdit(null)} onDelete={(c) => { setEdit(null); setDel(c); }} />}
      {importing && <ImportModal groups={groups.data || []} onClose={() => setImporting(false)} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete contact?"
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Keep</Button><Button variant="danger" loading={remove.isPending} onClick={() => del && remove.mutate(del.id)}>Delete contact</Button></>}>
        <p className="text-ink-500">{del && ([del.first_name, del.last_name].filter(Boolean).join(' ') || del.phone)} will be removed from all groups.</p>
      </Modal>
    </>
  );
}

function ContactModal({ contact, groups, onClose, onDelete }: { contact: Contact | null; groups: Group[]; onClose: () => void; onDelete: (c: Contact) => void }) {
  const [f, setF] = useState({ first_name: contact?.first_name || '', last_name: contact?.last_name || '', phone: contact?.phone || '' });
  const [extra, setExtra] = useState<{ k: string; v: string }[]>(Object.entries(contact?.fields || {}).map(([k, v]) => ({ k, v: String(v) })));
  const [gids, setGids] = useState<string[]>(contact?.group_ids || []);
  const [err, setErr] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();

  const save = useMutation({
    mutationFn: async () => {
      const phone = normalisePhone(f.phone);
      if (!phone) throw new Error('Enter a valid phone number, like 0754 123 456.');
      const fields = Object.fromEntries(extra.filter((x) => x.k.trim()).map((x) => [x.k.trim().toLowerCase().replace(/\s+/g, '_'), x.v]));
      const payload = { first_name: f.first_name.trim(), last_name: f.last_name.trim(), phone, fields, group_ids: gids };
      const saved = contact ? await api.patch<Contact>(`/contacts/${contact.id}`, payload) : await api.post<Contact>('/contacts', payload);
      const prev = contact?.group_ids || [];
      const id = saved?.id || contact?.id;
      if (id) {
        await Promise.all([
          ...gids.filter((g) => !prev.includes(g)).map((g) => api.post(`/groups/${g}/contacts`, { contact_ids: [id] })),
          ...prev.filter((g) => !gids.includes(g)).map((g) => api.del(`/groups/${g}/contacts/${id}`)),
        ]);
      }
    },
    onSuccess: () => { toast.success(contact ? 'Contact saved.' : 'Contact added.'); qc.invalidateQueries({ queryKey: ['contacts'] }); qc.invalidateQueries({ queryKey: ['groups'] }); onClose(); },
    onError: (e) => setErr(errMsg(e)),
  });

  return (
    <Modal open onClose={onClose} title={contact ? 'Edit contact' : 'Add contact'}
      footer={<>
        {contact && <Button variant="ghost" className="sm:mr-auto text-bad" onClick={() => onDelete(contact)}>Delete</Button>}
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={save.isPending} onClick={() => save.mutate()}>{contact ? 'Save contact' : 'Add contact'}</Button>
      </>}>
      <div className="space-y-4">
        <Field label="Phone"><Input type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="0754 123 456" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><Input value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></Field>
          <Field label="Last name"><Input value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></Field>
        </div>
        {groups.length > 0 && (
          <div>
            <span className="field-label">Groups</span>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => {
                const on = gids.includes(g.id);
                return <button key={g.id} type="button" onClick={() => setGids(on ? gids.filter((x) => x !== g.id) : [...gids, g.id])}
                  className={cx('h-9 px-3 rounded-full border text-sm font-medium inline-flex items-center gap-1.5', on ? 'bg-brand text-white border-brand' : 'bg-white border-line')}>{on && <Check className="h-3.5 w-3.5" />}{g.name}</button>;
              })}
            </div>
          </div>
        )}
        <div>
          <span className="field-label">Extra details <span className="font-normal text-ink-400">(optional — e.g. student_name, class)</span></span>
          <div className="space-y-2">
            {extra.map((x, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input value={x.k} placeholder="Field" onChange={(e) => setExtra(extra.map((y, j) => (j === i ? { ...y, k: e.target.value } : y)))} />
                <Input value={x.v} placeholder="Value" onChange={(e) => setExtra(extra.map((y, j) => (j === i ? { ...y, v: e.target.value } : y)))} />
                <button type="button" className="h-12 w-10 grid place-items-center text-ink-400 hover:text-bad" onClick={() => setExtra(extra.filter((_, j) => j !== i))} aria-label="Remove field"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <Button size="sm" variant="outline" type="button" onClick={() => setExtra([...extra, { k: '', v: '' }])}>Add a field</Button>
          </div>
        </div>
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    </Modal>
  );
}

function ImportModal({ groups, onClose }: { groups: Group[]; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [groupId, setGroupId] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const toast = useToast();

  const header = rows[0]?.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_')) || [];
  const phoneIdx = header.findIndex((h) => ['phone', 'phone_number', 'mobile', 'simu', 'number'].includes(h));
  const body = rows.slice(1);
  const stats = useMemo(() => {
    if (phoneIdx < 0) return { ok: 0, bad: 0 };
    let ok = 0; let bad = 0;
    body.forEach((r) => (normalisePhone(r[phoneIdx] || '') ? ok++ : bad++));
    return { ok, bad };
  }, [body, phoneIdx]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    if (f.size > 10 * 1024 * 1024) { setErr('That file is larger than 10 MB.'); return; }
    if (/\.xlsx?$/i.test(f.name)) { setErr('Excel files need to be saved as CSV first: File → Save As → CSV.'); return; }
    const text = await f.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) { setErr('The file looks empty. It needs a header row and at least one contact.'); return; }
    setFile(f); setRows(parsed);
  };

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('file', file!);
      if (groupId) fd.append('group_id', groupId);
      return api.upload<{ imported?: number; created?: number; updated?: number; skipped?: number; invalid?: number }>('/contacts/import', fd);
    },
    onSuccess: (r) => {
      const n = r?.imported ?? ((r?.created ?? 0) + (r?.updated ?? 0) || stats.ok);
      toast.success(`Imported ${int(n)} contacts.`);
      qc.invalidateQueries({ queryKey: ['contacts'] }); qc.invalidateQueries({ queryKey: ['groups'] }); qc.invalidateQueries({ queryKey: ['stats'] });
      onClose();
    },
    onError: (e) => setErr(errMsg(e)),
  });

  return (
    <Modal open onClose={onClose} title="Import contacts" size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!file || phoneIdx < 0 || !stats.ok} loading={upload.isPending} onClick={() => upload.mutate()}>Import {stats.ok ? int(stats.ok) : ''} contacts</Button></>}>
      {!file ? (
        <>
          <button type="button" onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
            className="w-full rounded-2xl border-2 border-dashed border-brand/30 bg-brand-50/50 py-10 px-6 text-center hover:bg-brand-50">
            <Upload className="h-8 w-8 text-brand mx-auto" />
            <div className="mt-3 font-bold">Choose a CSV file</div>
            <div className="text-sm text-ink-500 mt-1">or drag it here</div>
          </button>
          <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <div className="mt-5 text-sm text-ink-500">
            <p className="font-semibold text-ink mb-2">Your file needs these columns:</p>
            <pre className="rounded-xl bg-paper border border-line p-3 font-mono text-[12px] overflow-x-auto">phone,first_name,last_name,student_name{'\n'}0754123456,Amina,Mushi,Neema{'\n'}+255713000111,Juma,Kombo,Baraka</pre>
            <p className="mt-2">Extra columns (like student_name) can be used in messages as {'{{student_name}}'}.</p>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-paper border border-line p-3">
            <div className="min-w-0"><div className="font-semibold truncate">{file.name}</div><div className="text-[13px] text-ink-500">{int(body.length)} rows · {header.length} columns</div></div>
            <Button size="sm" variant="ghost" onClick={() => { setFile(null); setRows([]); }}>Change file</Button>
          </div>
          {phoneIdx < 0 ? (
            <p className="err">No “phone” column found. Rename the column with numbers to “phone”.</p>
          ) : (
            <div className="flex gap-4 text-sm">
              <span className="text-ok font-semibold">{int(stats.ok)} valid numbers</span>
              {stats.bad > 0 && <span className="text-bad font-semibold">{int(stats.bad)} will be skipped</span>}
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="table-base text-[13px]">
              <thead><tr>{header.map((h, i) => <th key={i} className={cx(i === phoneIdx && 'text-brand')}>{h}</th>)}</tr></thead>
              <tbody>
                {body.slice(0, 6).map((r, i) => (
                  <tr key={i}>{header.map((_, j) => <td key={j} className={cx('whitespace-nowrap', j === phoneIdx && !normalisePhone(r[j] || '') && 'text-bad')}>{r[j]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {body.length > 6 && <p className="text-[13px] text-ink-500">Showing first 6 of {int(body.length)} rows.</p>}
          <Field label="Add everyone to a group (optional)">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Don’t add to a group</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
        </div>
      )}
      {err && <p className="err" role="alert">{err}</p>}
    </Modal>
  );
}

function GroupsTab() {
  const groups = useGroups();
  const [edit, setEdit] = useState<Group | 'new' | null>(null);
  const [open, setOpen] = useState<Group | null>(null);
  const [del, setDel] = useState<Group | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/groups/${id}`),
    onSuccess: () => { toast.success('Group deleted.'); setDel(null); qc.invalidateQueries({ queryKey: ['groups'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <>
      <div className="flex justify-end mb-4"><Button icon={<FolderPlus className="h-4 w-4" />} onClick={() => setEdit('new')}>New group</Button></div>
      {groups.isLoading ? <div className="panel"><TableSkeleton rows={3} /></div> : groups.isError ? <ErrorBox error={groups.error} onRetry={() => groups.refetch()} /> : !groups.data?.length ? (
        <div className="panel"><Empty icon={<Users className="h-6 w-6" />} title="No groups yet" body="Groups let you message everyone in a class, branch or list at once. Try “Form 4 Parents” or “VIP customers”."
          action={<Button onClick={() => setEdit('new')}>Create a group</Button>} /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.data.map((g) => (
            <div key={g.id} className="panel p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => setOpen(g)} className="text-left min-w-0">
                  <div className="font-bold text-lg truncate hover:text-brand">{g.name}</div>
                  <div className="text-sm text-ink-500 line-clamp-2">{g.description || 'No description'}</div>
                </button>
                <div className="flex shrink-0">
                  <button onClick={() => setEdit(g)} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-ink/5" aria-label="Rename"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDel(g)} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-bad/10 text-bad" aria-label="Delete group"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-auto pt-4 flex items-end justify-between">
                <div><span className="text-2xl font-extrabold tabular-nums">{groupSize(g) !== undefined ? int(groupSize(g)) : '—'}</span> <span className="text-sm text-ink-500">contacts</span></div>
                <Button size="sm" variant="outline" onClick={() => setOpen(g)}>View people</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && <GroupModal group={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      {open && <GroupMembers group={open} onClose={() => setOpen(null)} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete group?"
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Keep</Button><Button variant="danger" loading={remove.isPending} onClick={() => del && remove.mutate(del.id)}>Delete group</Button></>}>
        <p className="text-ink-500">The contacts stay saved — only the group “{del?.name}” is removed.</p>
      </Modal>
    </>
  );
}

function GroupModal({ group, onClose }: { group: Group | null; onClose: () => void }) {
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [err, setErr] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const save = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error('Give the group a name.');
      return group ? api.patch(`/groups/${group.id}`, { name: name.trim(), description }) : api.post('/groups', { name: name.trim(), description });
    },
    onSuccess: () => { toast.success(group ? 'Group saved.' : 'Group created.'); qc.invalidateQueries({ queryKey: ['groups'] }); onClose(); },
    onError: (e) => setErr(errMsg(e)),
  });
  return (
    <Modal open onClose={onClose} title={group ? 'Edit group' : 'New group'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>{group ? 'Save group' : 'Create group'}</Button></>}>
      <div className="space-y-4">
        <Field label="Group name" error={err}><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Form 4 Parents" invalid={!!err} /></Field>
        <Field label="Description (optional)"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function GroupMembers({ group, onClose }: { group: Group; onClose: () => void }) {
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const qc = useQueryClient();
  const toast = useToast();
  const members = useQuery({ queryKey: ['contacts', 'group', group.id], queryFn: () => api.get<Contact[]>('/contacts', { group_id: group.id, per_page: 200 }) });
  const search = useQuery({ queryKey: ['contacts', 'search', q], queryFn: () => api.get<Contact[]>('/contacts', { q, per_page: 50 }), enabled: adding });
  const memberIds = new Set((members.data || []).map((m) => m.id));

  const add = useMutation({
    mutationFn: () => api.post(`/groups/${group.id}/contacts`, { contact_ids: sel }),
    onSuccess: () => { toast.success(`Added ${sel.length} to ${group.name}.`); setSel([]); setAdding(false); qc.invalidateQueries({ queryKey: ['contacts'] }); qc.invalidateQueries({ queryKey: ['groups'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: (cid: string) => api.del(`/groups/${group.id}/contacts/${cid}`),
    onSuccess: () => { toast.success('Removed from group.'); qc.invalidateQueries({ queryKey: ['contacts'] }); qc.invalidateQueries({ queryKey: ['groups'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Modal open onClose={onClose} title={group.name} size="lg"
      footer={adding ? <><Button variant="ghost" onClick={() => setAdding(false)}>Back</Button><Button disabled={!sel.length} loading={add.isPending} onClick={() => add.mutate()}>Add {sel.length || ''} to group</Button></> : <Button onClick={() => setAdding(true)} icon={<Plus className="h-4 w-4" />}>Add people</Button>}>
      {adding ? (
        <>
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts" className="mb-3" />
          <ul className="divide-y divide-line max-h-[50vh] overflow-y-auto">
            {(search.data || []).filter((c) => !memberIds.has(c.id)).map((c) => {
              const on = sel.includes(c.id);
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setSel(on ? sel.filter((x) => x !== c.id) : [...sel, c.id])} className="w-full flex items-center gap-3 py-3 text-left">
                    <span className={cx('h-6 w-6 rounded-md border-2 grid place-items-center shrink-0', on ? 'bg-brand border-brand text-white' : 'border-ink-300')}>{on && <Check className="h-4 w-4" />}</span>
                    <span className="flex-1 font-medium">{[c.first_name, c.last_name].filter(Boolean).join(' ') || 'No name'}</span>
                    <span className="text-sm text-ink-500 tabular-nums">{c.phone}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : members.isLoading ? <TableSkeleton rows={3} /> : !members.data?.length ? (
        <Empty icon={<Users className="h-6 w-6" />} title="This group is empty" body="Add people from your contacts, or import a CSV into this group." />
      ) : (
        <ul className="divide-y divide-line">
          {members.data.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-3">
              <span className="flex-1 font-medium">{[c.first_name, c.last_name].filter(Boolean).join(' ') || 'No name'}</span>
              <span className="text-sm text-ink-500 tabular-nums">{c.phone}</span>
              <button onClick={() => remove.mutate(c.id)} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-bad/10 text-ink-400 hover:text-bad" aria-label="Remove from group"><UserMinus className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
