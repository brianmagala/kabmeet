import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReportStatus, UserRole } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthGuard, Roles, RolesGuard, type AuthenticatedRequest } from '@/modules/auth';
import { ZodValidationPipe } from '@/common/zod-validation.pipe';

const updateRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
  reason: z.string().trim().max(240).optional(),
});

const createCommunitySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().min(10).max(320),
  accentColor: z.string().default('#065A4B'),
});

const reportStatusSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']),
});

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  async overview() {
    const [users, communities, reports, roleAuditLog] = await Promise.all([
      this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          universityId: true,
          fullName: true,
          department: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.community.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.moderationReport.findMany({
        include: { session: { select: { title: true } }, reporter: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.roleAuditLog.findMany({
        include: { targetUser: { select: { fullName: true } }, actorUser: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return { users, communities, reports, roleAuditLog };
  }

  @Patch('users/:id/role')
  async updateRole(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRoleSchema)) body: z.infer<typeof updateRoleSchema>,
    @Req() req: AuthenticatedRequest,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found.');
    if (target.id === req.user!.id && body.role !== UserRole.ADMIN) {
      throw new BadRequestException('You cannot remove your own ADMIN role.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { role: body.role },
      });
      await tx.roleAuditLog.create({
        data: {
          targetUserId: id,
          actorUserId: req.user!.id,
          previousRole: target.role,
          newRole: body.role,
          reason: body.reason,
        },
      });
      return user;
    });

    return { user: updated };
  }

  @Post('communities')
  async createCommunity(
    @Body(new ZodValidationPipe(createCommunitySchema)) body: z.infer<typeof createCommunitySchema>,
  ) {
    const community = await this.prisma.community.create({ data: body });
    return { community };
  }

  @Patch('reports/:id')
  async updateReport(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reportStatusSchema)) body: z.infer<typeof reportStatusSchema>,
  ) {
    const report = await this.prisma.moderationReport.update({
      where: { id },
      data: { status: body.status as ReportStatus },
    });
    return { report };
  }
}

@Module({ controllers: [AdminController] })
export class AdminModule {}
