import {
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthGuard, Roles, RolesGuard, type AuthenticatedRequest } from '@/modules/auth';

@Controller('attendance')
@UseGuards(AuthGuard)
class AttendanceController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('classes/:id/ping')
  async ping(@Param('id') sessionId: string, @Req() req: AuthenticatedRequest) {
    const u = req.user!;
    const cls = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: { enrollments: true },
    });
    if (!cls || !cls.isPrivateClass) throw new NotFoundException('Virtual class not found.');

    const allowed =
      u.role === UserRole.ADMIN ||
      cls.hostId === u.id ||
      cls.enrollments.some(
        (e) =>
          e.studentIdentifier.toLowerCase() === u.email.toLowerCase() ||
          (u.universityId && e.studentIdentifier.toLowerCase() === u.universityId.toLowerCase()),
      );
    if (!allowed) throw new ForbiddenException('You are not enrolled in this virtual class.');

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { sessionId_userId: { sessionId, userId: u.id } },
    });

    if (!existing) {
      const record = await this.prisma.attendanceRecord.create({
        data: { sessionId, userId: u.id, durationSeconds: 30 },
      });
      return { record };
    }

    const delta = Math.max(
      10,
      Math.min(120, Math.round((Date.now() - existing.lastSeenAt.getTime()) / 1000)),
    );
    const record = await this.prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date(), durationSeconds: { increment: delta } },
    });
    return { record };
  }

  @Get('classes/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LECTURER, UserRole.ADMIN)
  async listForClass(@Param('id') sessionId: string, @Req() req: AuthenticatedRequest) {
    const cls = await this.prisma.liveSession.findUnique({ where: { id: sessionId } });
    if (!cls || !cls.isPrivateClass) throw new NotFoundException('Virtual class not found.');
    if (req.user!.role !== UserRole.ADMIN && cls.hostId !== req.user!.id) {
      throw new ForbiddenException('Only the class lecturer or admin can inspect attendance.');
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where: { sessionId },
      include: { user: { select: { universityId: true, fullName: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return { records };
  }
}

@Module({ controllers: [AttendanceController] })
export class AttendanceModule {}
