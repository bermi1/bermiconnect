import 'express';

export interface AuthContext {
  accountId: string;
  method: 'jwt' | 'api_key';
  userId?: string;
  email?: string;
  role?: 'owner' | 'admin' | 'member';
  apiKeyId?: string;
  mode: 'live' | 'test';
  isPlatformAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
