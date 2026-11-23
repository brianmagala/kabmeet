import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { LiveSessionMode, LiveSessionStatus, UserRole } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthGuard, Roles, RolesGuard, type AuthenticatedRequest } from '@/modules/auth';
import { ZodValidationPipe } from '@/common/zod-validation.pipe';

const createClassSchema = z.object({
  courseCode: z.string().trim().min(2).max(24),
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().min(8).max(500),
  communitySlug: z.string().trim().min(2).default('kab-ai'),
  allowedStudents: z.array(z.string().trim().min(2)).min(1),
});

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

@Controller('classes')
@UseGuards(AuthGuard)
class ClassesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const u = req.user!;
    const classes = await this.prisma.liveSession.findMany({
      where: { isPrivateClass: true },
      include: {
        host: { select: { fullName: true } },
        community: { select: { slug: true, name: true } },
        enrollments: true,
        _count: { select: { attendance: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      classes: classes.map((cls) => {
        const isManager = u.role === UserRole.ADMIN || cls.hostId === u.id;
        const canJoin =
          isManager ||
          cls.enrollments.some(
            (e) =>
              e.studentIdentifier.toLowerCase() === u.email.toLowerCase() ||
              (u.universityId && e.studentIdentifier.toLowerCase() === u.universityId.toLowerCase()),
          );

        return {
          id: cls.id,
          courseCode: cls.courseCode,
          title: cls.title,
          description: cls.description,
          hostName: cls.host.fullName,
          communityName: cls.community.name,
          status: cls.status,
          canJoin,
          allowedStudents: isManager ? cls.enrollments.map((e) => e.studentIdentifier) : [],
          attendanceCount: isManager ? cls._count.attendance : undefined,
        };
      }),
    };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.LECTURER, UserRole.ADMIN)
  async create(
    @Body(new ZodValidationPipe(createClassSchema)) body: z.infer<typeof createClassSchema>,
    @Req() req: AuthenticatedRequest,
  ) {
    const community = await this.prisma.community.findUnique({ where: { slug: body.communitySlug } });
    if (!community) throw new NotFoundException('Community not found.');

    const created = await this.prisma.liveSession.create({
      data: {
        title: `${body.courseCode} — ${body.title}`,
        description: body.description,
        communityId: community.id,
        hostId: req.user!.id,
        status: LiveSessionStatus.LIVE,
        mode: LiveSessionMode.CLASS,
        roomSlug: `class-${Date.now()}`,
        scheduledAt: new Date(),
        startedAt: new Date(),
        isPrivateClass: true,
        courseCode: body.courseCode,
        enrollments: {
          create: body.allowedStudents.map((id) => ({ studentIdentifier: id.toLowerCase() })),
        },
      },
    });
    return { classSession: created };
  }

  @Get(':id/attendance.csv')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LECTURER, UserRole.ADMIN)
  async exportCsv(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const cls = await this.prisma.liveSession.findUnique({ where: { id } });
    if (!cls || !cls.isPrivateClass) throw new NotFoundException('Virtual class not found.');
    if (req.user!.role !== UserRole.ADMIN && cls.hostId !== req.user!.id) {
      throw new ForbiddenException('Only the class lecturer or admin can export attendance.');
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where: { sessionId: id },
      include: { user: { select: { universityId: true, fullName: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    const header = ['University ID', 'Full Name', 'Email', 'Joined At', 'Last Active', 'Duration (min)'];
    const rows = records.map((r) => [
      escapeCsvCell(r.user.universityId ?? 'N/A'),
      escapeCsvCell(r.user.fullName),
      escapeCsvCell(r.user.email),
      escapeCsvCell(r.joinedAt.toISOString()),
      escapeCsvCell(r.lastSeenAt.toISOString()),
      escapeCsvCell((r.durationSeconds / 60).toFixed(1)),
    ]);

    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const safeCode = (cls.courseCode ?? 'class').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeCode}_attendance.csv"`);
    res.send(csv);
  }
}

@Module({ controllers: [ClassesController] })
export class ClassesModule {}
