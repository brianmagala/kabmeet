import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LiveSessionMode, LiveSessionStatus, UserRole } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthGuard, Roles, RolesGuard, type AuthenticatedRequest } from '@/modules/auth';
import { ZodValidationPipe } from '@/common/zod-validation.pipe';

const createSessionSchema = z.object({
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().min(10).max(600),
  communitySlug: z.string().trim().min(2),
  mode: z.enum(['WATCH', 'ROOM']).default('WATCH'),
  startNow: z.boolean().default(false),
  scheduledAt: z.string().datetime().optional(),
});

const statusSchema = z.object({
  status: z.enum(['LIVE', 'UPCOMING', 'REPLAY']),
});

@Controller('sessions')
class SessionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('community') community?: string,
    @Query('status') status?: string,
  ) {
    const validStatus =
      status && ['LIVE', 'UPCOMING', 'REPLAY'].includes(status.toUpperCase())
        ? (status.toUpperCase() as LiveSessionStatus)
        : undefined;

    const sessions = await this.prisma.liveSession.findMany({
      where: {
        isPrivateClass: false,
        status: validStatus,
        community: community ? { slug: community } : undefined,
        OR: q
          ? [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        community: { select: { slug: true, name: true } },
        host: { select: { fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { scheduledAt: 'desc' }],
    });

    return { sessions };
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async getOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id },
      include: {
        community: { select: { slug: true, name: true } },
        host: { select: { fullName: true } },
        enrollments: true,
      },
    });
    if (!session) throw new NotFoundException('Session not found.');

    if (session.isPrivateClass) {
      const u = req.user!;
      const allowed =
        u.role === UserRole.ADMIN ||
        session.hostId === u.id ||
        session.enrollments.some(
          (e) =>
            e.studentIdentifier.toLowerCase() === u.email.toLowerCase() ||
            (u.universityId && e.studentIdentifier.toLowerCase() === u.universityId.toLowerCase()),
        );
      if (!allowed) {
        throw new ForbiddenException('Only enrolled students and the lecturer can join this private class.');
      }
    }

    return { session };
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.HOST, UserRole.LECTURER, UserRole.ADMIN)
  async create(
    @Body(new ZodValidationPipe(createSessionSchema)) body: z.infer<typeof createSessionSchema>,
    @Req() req: AuthenticatedRequest,
  ) {
    const community = await this.prisma.community.findUnique({ where: { slug: body.communitySlug } });
    if (!community) throw new NotFoundException('Selected community was not found.');

    const now = new Date();
    const session = await this.prisma.liveSession.create({
      data: {
        title: body.title,
        description: body.description,
        communityId: community.id,
        hostId: req.user!.id,
        status: body.startNow ? LiveSessionStatus.LIVE : LiveSessionStatus.UPCOMING,
        mode: body.mode === 'ROOM' ? LiveSessionMode.ROOM : LiveSessionMode.WATCH,
        roomSlug: `kabmeet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : now,
        startedAt: body.startNow ? now : null,
      },
    });
    return { session };
  }

  @Post(':id/remind')
  @UseGuards(AuthGuard)
  async toggleReminder(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const session = await this.prisma.liveSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found.');

    const existing = await this.prisma.sessionReminder.findUnique({
      where: { sessionId_userId: { sessionId: id, userId: req.user!.id } },
    });
    if (existing) {
      await this.prisma.sessionReminder.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.sessionReminder.create({ data: { sessionId: id, userId: req.user!.id } });
    }
    return { reminded: !existing };
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.HOST, UserRole.LECTURER, UserRole.ADMIN)
  async setStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(statusSchema)) body: z.infer<typeof statusSchema>,
    @Req() req: AuthenticatedRequest,
  ) {
    const session = await this.prisma.liveSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found.');
    if (req.user!.role !== UserRole.ADMIN && session.hostId !== req.user!.id) {
      throw new ForbiddenException('Only the host or an admin can change session status.');
    }

    const updated = await this.prisma.liveSession.update({
      where: { id },
      data: {
        status: body.status as LiveSessionStatus,
        startedAt: body.status === 'LIVE' && !session.startedAt ? new Date() : session.startedAt,
        endedAt: body.status === 'REPLAY' ? new Date() : session.endedAt,
      },
    });
    return { session: updated };
  }
}

@Module({ controllers: [SessionsController] })
export class SessionsModule {}
