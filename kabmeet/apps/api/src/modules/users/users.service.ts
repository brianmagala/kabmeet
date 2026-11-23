import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { UpdateMyProfileDto, UpdateUserRoleDto } from '@/modules/users/users.schemas';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(userId: string, dto: UpdateMyProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName,
        ...(dto.nickname !== undefined ? { nickname: dto.nickname || null } : {}),
        ...(dto.department !== undefined ? { department: dto.department || null } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl || null } : {}),
      },
      select: {
        id: true,
        email: true,
        universityId: true,
        fullName: true,
        nickname: true,
        department: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        universityId: true,
        fullName: true,
        nickname: true,
        department: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async updateRole(
    targetUserId: string,
    actorUserId: string,
    dto: UpdateUserRoleDto,
  ) {
    if (targetUserId === actorUserId && dto.role !== UserRole.ADMIN) {
      throw new BadRequestException(
        'Administrators cannot remove their own ADMIN role.',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true },
    });

    if (!existing) {
      throw new NotFoundException('User account was not found.');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { role: dto.role },
        select: {
          id: true,
          email: true,
          universityId: true,
          fullName: true,
          department: true,
          role: true,
          isActive: true,
        },
      }),
      this.prisma.roleAuditLog.create({
        data: {
          targetUserId,
          actorUserId,
          previousRole: existing.role,
          newRole: dto.role,
          reason: dto.reason ?? null,
        },
      }),
    ]);

    return updated;
  }
}
