import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger.js';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new ApiError(400, 'validation_error', msg, details);
export const unauthorized = (msg = 'Authentication required') => new ApiError(401, 'unauthorized', msg);
export const forbidden = (msg = 'You do not have access to this resource') => new ApiError(403, 'forbidden', msg);
export const notFound = (what = 'Resource') => new ApiError(404, 'not_found', `${what} not found`);
export const conflict = (msg: string) => new ApiError(409, 'conflict', msg);
export const insufficientBalance = (needed: number, balance: number) =>
  new ApiError(402, 'insufficient_balance', `Insufficient balance: need TZS ${needed}, have TZS ${balance}`, {
    required_tzs: needed,
    balance_tzs: balance,
  });
export const senderNotApproved = (name: string) =>
  new ApiError(422, 'sender_not_approved', `Sender ID "${name}" is not approved for this account`);

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'not_found', message: `Route ${req.method} ${req.path} not found` } });
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    res.status(400).json({
      error: { code: 'validation_error', message: issues.map((i) => `${i.path || 'body'}: ${i.message}`).join('; '), details: issues },
    });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'validation_error', message: 'Malformed JSON body' } });
    return;
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: { code: 'validation_error', message: 'File too large' } });
    return;
  }
  if (err?.code === '22P02') {
    // invalid uuid / text representation
    res.status(404).json({ error: { code: 'not_found', message: 'Resource not found' } });
    return;
  }
  logger.error({ err, path: req.path }, 'unhandled error');
  res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong' } });
}
