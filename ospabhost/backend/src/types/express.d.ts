// Типы для расширения Express Request
import { User as PrismaUser } from '@prisma/client';

declare global {
  namespace Express {
    // Используем полный тип User из Prisma
    interface User extends PrismaUser {}

    interface Request {
      user?: User;
    }
  }
}

export {};
