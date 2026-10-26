import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: Role;
        patientId: string | null;
        providerId: string | null;
      };
      requestId?: string;
    }
  }
}

export {};
