import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { getAllowedNavPaths, type AuthUserProfile, type UserRole as SharedRole } from '@kabmeet/shared';
import { PrismaService } from '@/prisma/prisma.service';
import type { LoginDto, RegisterDto } from '@/modules/auth/auth.schemas';
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from '@/modules/auth/password.util';
import type { AuthenticatedUser } from '@/modules/auth/auth.guard';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthSessionResponse {
  user: AuthUserProfile;
  accessToken: string;
  allowedRoutes: string[];
  expiresAt: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private toProfile(user: {
    id: string;
    email: string;
    universityId: string | null;
    fullName: string;
    department: string | null;
    avatarUrl: string | null;
    role: UserRole;
    createdAt: Date;
  }): AuthUserProfile {
    return {
      id: user.id,
      email: user.email,
      universityId: user.universityId,
      fullName: user.fullName,
      department: user.department,
      avatarUrl: user.avatarUrl,
      role: user.role as SharedRole,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private async issueSession(
    userId: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async register(
    dto: RegisterDto,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthSessionResponse> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          ...(dto.universityId ? [{ universityId: dto.universityId }] : []),
        ],
      },
      select: { id: true, email: true },
    });

    if (existing) {
      throw new ConflictException(
        'An account with this email or university ID already exists.',
      );
    }

    const passwordHash = await hashPassword(dto.password);

    // Role is always forced to MEMBER on self-registration
    const created = await this.prisma.user.create({
      data: {
        email: dto.email,
        universityId: dto.universityId ?? null,
        fullName: dto.fullName,
        department: dto.department ?? null,
        passwordHash,
        role: UserRole.MEMBER,
      },
      select: {
        id: true,
        email: true,
        universityId: true,
        fullName: true,
        department: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    const { token, expiresAt } = await this.issueSession(created.id, meta);
    const profile = this.toProfile(created);

    return {
      user: profile,
      accessToken: token,
      allowedRoutes: getAllowedNavPaths(profile.role),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async login(
    dto: LoginDto,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthSessionResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        universityId: true,
        fullName: true,
        department: true,
        avatarUrl: true,
        passwordHash: true,
        role: true,
        isActive: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        createdAt: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        'Too many sign-in attempts. Please wait a few minutes and try again.',
      );
    }

    const passwordOk = await verifyPassword(dto.password, user.passwordHash);
    if (!passwordOk) {
      const nextAttempts = user.failedLoginAttempts + 1;
      const shouldLock = nextAttempts >= 5;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : nextAttempts,
          lockedUntil: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const { token, expiresAt } = await this.issueSession(user.id, meta);
    const profile = this.toProfile(user);

    return {
      user: profile,
      accessToken: token,
      allowedRoutes: getAllowedNavPaths(profile.role),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  getAuthenticatedProfile(user: AuthenticatedUser): {
    user: AuthUserProfile;
    allowedRoutes: string[];
  } {
    const profile = this.toProfile(user);
    return {
      user: profile,
      allowedRoutes: getAllowedNavPaths(profile.role),
    };
  }

  async resolveOptionalSession(token: string | null): Promise<{
    authenticated: boolean;
    role: SharedRole;
    user: AuthUserProfile | null;
    allowedRoutes: string[];
  }> {
    if (!token) {
      return {
        authenticated: false,
        role: 'VISITOR',
        user: null,
        allowedRoutes: getAllowedNavPaths('VISITOR'),
      };
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
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
      return {
        authenticated: false,
        role: 'VISITOR',
        user: null,
        allowedRoutes: getAllowedNavPaths('VISITOR'),
      };
    }

    const profile = this.toProfile(session.user);
    return {
      authenticated: true,
      role: profile.role,
      user: profile,
      allowedRoutes: getAllowedNavPaths(profile.role),
    };
  }
}
