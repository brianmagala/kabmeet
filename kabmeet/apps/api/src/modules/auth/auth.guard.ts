import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { hashSessionToken } from '@/modules/auth/password.util';

export const SESSION_COOKIE_NAME = 'kabmeet_session';

export interface AuthenticatedUser {
  id: string;
  email: string;
  universityId: string | null;
  fullName: string;
  department: string | null;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: Date;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  sessionId?: string;
}

export function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.length > 0) {
      return token;
    }
  }

  const rawCookie = req.headers.cookie;
  if (typeof rawCookie === 'string' && rawCookie.length > 0) {
    for (const part of rawCookie.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === SESSION_COOKIE_NAME && rest.length > 0) {
        return decodeURIComponent(rest.join('='));
      }
    }
  }

  return null;
}

export function verifyCookieOriginIfNeeded(req: Request): void {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return;
  }
  const rawCookie = req.headers.cookie;
  const hasCookie =
    typeof rawCookie === 'string' && rawCookie.includes(SESSION_COOKIE_NAME);
  if (!hasCookie) {
    return;
  }
  if (req.headers['x-requested-with']) {
    return;
  }
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  if (origin && typeof host === 'string') {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) {
        return;
      }
    } catch {
      // Invalid origin URL
    }
  }
  throw new UnauthorizedException('Cross-origin cookie request blocked.');
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractSessionToken(req);

    if (!token) {
      throw new UnauthorizedException('Please sign in to continue.');
    }

    const tokenHash = hashSessionToken(token);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            universityId: true,
            fullName: true,
            department: true,
            avatarUrl: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date() ||
      !session.user.isActive
    ) {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      universityId: session.user.universityId,
      fullName: session.user.fullName,
      department: session.user.department,
      avatarUrl: session.user.avatarUrl,
      role: session.user.role,
      createdAt: session.user.createdAt,
    };
    req.sessionId = session.id;

    return true;
  }
}
