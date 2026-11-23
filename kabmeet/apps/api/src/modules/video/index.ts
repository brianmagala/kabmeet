import {
  Body,
  Controller,
  ForbiddenException,
  Module,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { LiveKitVideoProvider } from '@kabmeet/video';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthGuard, Roles, RolesGuard, type AuthenticatedRequest } from '@/modules/auth';
import { ZodValidationPipe } from '@/common/zod-validation.pipe';

const tokenRequestSchema = z.object({
  sessionId: z.string().min(1),
});

const peerActionSchema = z.object({
  sessionId: z.string().min(1),
  participantIdentity: z.string().min(1),
});

function createVideoProvider(): LiveKitVideoProvider {
  return new LiveKitVideoProvider(
    process.env.LIVEKIT_API_KEY ?? 'devkey',
    process.env.LIVEKIT_API_SECRET ?? 'secret',
    process.env.LIVEKIT_URL ?? 'http://localhost:7880',
  );
}

@Controller('video')
@UseGuards(AuthGuard)
class VideoController {
  private readonly provider = createVideoProvider();

  constructor(private readonly prisma: PrismaService) {}

  @Post('token')
  async issueToken(
    @Body(new ZodValidationPipe(tokenRequestSchema)) body: z.infer<typeof tokenRequestSchema>,
    @Req() req: AuthenticatedRequest,
  ) {
    const u = req.user!;
    const session = await this.prisma.liveSession.findUnique({
      where: { id: body.sessionId },
      include: { enrollments: true },
    });
    if (!session) throw new NotFoundException('Session not found.');

    if (session.isPrivateClass) {
      const allowed =
        u.role === UserRole.ADMIN ||
        session.hostId === u.id ||
        session.enrollments.some(
          (e) =>
            e.studentIdentifier.toLowerCase() === u.email.toLowerCase() ||
            (u.universityId && e.studentIdentifier.toLowerCase() === u.universityId.toLowerCase()),
        );
      if (!allowed) {
        throw new ForbiddenException('You are not enrolled in this virtual class.');
      }
    }

    const speakerRoles: UserRole[] = [
      UserRole.SPEAKER,
      UserRole.MODERATOR,
      UserRole.HOST,
      UserRole.LECTURER,
      UserRole.ADMIN,
    ];
    const canPublish = speakerRoles.includes(u.role) || session.hostId === u.id;

    return this.provider.createRoomToken({
      roomName: session.roomSlug,
      participantIdentity: u.id,
      participantName: u.fullName,
      canPublish,
    });
  }

  @Post('promote')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HOST, UserRole.MODERATOR, UserRole.LECTURER, UserRole.ADMIN)
  async promote(
    @Body(new ZodValidationPipe(peerActionSchema)) body: z.infer<typeof peerActionSchema>,
  ) {
    const session = await this.prisma.liveSession.findUnique({ where: { id: body.sessionId } });
    if (!session) throw new NotFoundException('Session not found.');
    await this.provider.promoteSpeaker(session.roomSlug, body.participantIdentity);
    return { promoted: true };
  }

  @Post('mute')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HOST, UserRole.MODERATOR, UserRole.LECTURER, UserRole.ADMIN)
  async mute(
    @Body(new ZodValidationPipe(peerActionSchema)) body: z.infer<typeof peerActionSchema>,
  ) {
    const session = await this.prisma.liveSession.findUnique({ where: { id: body.sessionId } });
    if (!session) throw new NotFoundException('Session not found.');
    await this.provider.muteParticipant(session.roomSlug, body.participantIdentity);
    return { muted: true };
  }
}

@Module({ controllers: [VideoController] })
export class VideoModule {}
