export interface RenderContact {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  fields?: Record<string, unknown> | null;
}

/** Render {{first_name}}, {{last_name}}, {{phone}} and {{any_field}} placeholders. Unknown tags → ''. */
export function renderTemplate(body: string, c: RenderContact | null | undefined, extra: Record<string, unknown> = {}): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key: string) => {
    if (key in extra) return String(extra[key] ?? '');
    if (!c) return '';
    if (key === 'first_name') return c.first_name ?? '';
    if (key === 'last_name') return c.last_name ?? '';
    if (key === 'phone') return c.phone ?? '';
    if (key === 'full_name') return [c.first_name, c.last_name].filter(Boolean).join(' ');
    const v = c.fields?.[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

export function hasPlaceholders(body: string): boolean {
  return /\{\{\s*[a-zA-Z0-9_.-]+\s*\}\}/.test(body);
}
