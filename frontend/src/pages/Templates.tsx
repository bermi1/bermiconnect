import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Pencil, Trash2, Send } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import type { Template } from '../lib/types';
import { useTemplates } from '../lib/hooks';
import { PRESET_TEMPLATES } from '../lib/presets';
import { Button, Empty, ErrorBox, Field, Input, Modal, PageHeader, TableSkeleton } from '../components/ui';
import { Composer } from '../components/Composer';
import { useToast } from '../components/Toast';
import { analyse } from '../lib/sms';

export default function Templates() {
  const t = useTemplates();
  const [edit, setEdit] = useState<Partial<Template> | null>(null);
  const [del, setDel] = useState<Template | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/templates/${id}`),
    onSuccess: () => { toast.success('Template deleted.'); setDel(null); qc.invalidateQueries({ queryKey: ['templates'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="animate-rise">
      <PageHeader title="Templates" subtitle="Save messages you send often, then reuse them in one tap."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({})}>New template</Button>} />
      {t.isLoading ? <div className="panel"><TableSkeleton rows={3} /></div> : t.isError ? <ErrorBox error={t.error} onRetry={() => t.refetch()} /> : !t.data?.length ? (
        <div className="panel"><Empty icon={<FileText className="h-6 w-6" />} title="No templates saved" body="Start from one of the examples below, or write your own." /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {t.data.map((x) => (
            <div key={x.id} className="panel p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-lg">{x.name}</h3>
                <div className="flex shrink-0 -mr-2 -mt-1">
                  <button onClick={() => setEdit(x)} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-ink/5" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDel(x)} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-bad/10 text-bad" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="mt-2 text-[15px] text-ink-700 whitespace-pre-wrap">{x.body}</p>
              <div className="mt-auto pt-4 flex items-center justify-between text-[13px] text-ink-500">
                <span>{analyse(x.body).segments} SMS part{analyse(x.body).segments === 1 ? '' : 's'}</span>
                <Link to="/app/campaigns/new" className="inline-flex items-center gap-1 font-semibold text-brand"><Send className="h-3.5 w-3.5" />Use in campaign</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-10 mb-3 font-bold text-lg">Examples to start from</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {PRESET_TEMPLATES.map((p) => (
          <button key={p.name} onClick={() => setEdit({ name: p.name, body: p.body })} className="text-left rounded-2xl border border-dashed border-ink-300 p-4 hover:border-brand hover:bg-white">
            <div className="font-semibold">{p.name}</div>
            <p className="mt-1 text-sm text-ink-500 line-clamp-3">{p.body}</p>
            <div className="mt-3 text-[13px] font-semibold text-brand">Save as my template</div>
          </button>
        ))}
      </div>

      {edit && <TemplateModal t={edit} onClose={() => setEdit(null)} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete template?"
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Keep</Button><Button variant="danger" loading={remove.isPending} onClick={() => del && remove.mutate(del.id)}>Delete template</Button></>}>
        <p className="text-ink-500">“{del?.name}” will be removed. Campaigns already sent are not affected.</p>
      </Modal>
    </div>
  );
}

function TemplateModal({ t, onClose }: { t: Partial<Template>; onClose: () => void }) {
  const [name, setName] = useState(t.name || '');
  const [body, setBody] = useState(t.body || '');
  const [err, setErr] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const save = useMutation({
    mutationFn: () => {
      if (!name.trim() || !body.trim()) throw new Error('Add a name and a message.');
      return t.id ? api.patch(`/templates/${t.id}`, { name: name.trim(), body }) : api.post('/templates', { name: name.trim(), body });
    },
    onSuccess: () => { toast.success('Template saved.'); qc.invalidateQueries({ queryKey: ['templates'] }); onClose(); },
    onError: (e) => setErr(errMsg(e)),
  });
  return (
    <Modal open onClose={onClose} title={t.id ? 'Edit template' : 'New template'} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save template</Button></>}>
      <div className="space-y-4">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fee reminder" /></Field>
        <div><span className="field-label">Message</span><Composer value={body} onChange={setBody} /></div>
        {err && <p className="err">{err}</p>}
      </div>
    </Modal>
  );
}
