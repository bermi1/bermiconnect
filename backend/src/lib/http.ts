import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

/** Wrap async route handlers (Express 5 handles rejected promises natively, kept for clarity). */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(200).default(50),
});

export function pagination(q: unknown) {
  const { page, per_page } = paginationSchema.parse(q ?? {});
  return { page, per_page, offset: (page - 1) * per_page, limit: per_page };
}

export function ok(res: Response, data: unknown, status = 200, meta?: unknown) {
  res.status(status).json(meta ? { data, meta } : { data });
}

export const uuidParam = z.string().uuid();

/** Small helper for building parametrised WHERE clauses. */
export class Where {
  parts: string[] = [];
  params: unknown[] = [];
  add(sqlWithQ: string, ...vals: unknown[]) {
    let s = sqlWithQ;
    for (const v of vals) {
      this.params.push(v);
      s = s.replace('?', `$${this.params.length}`);
    }
    this.parts.push(s);
    return this;
  }
  get sql() {
    return this.parts.length ? 'WHERE ' + this.parts.join(' AND ') : '';
  }
  next() {
    return `$${this.params.length + 1}`;
  }
}
