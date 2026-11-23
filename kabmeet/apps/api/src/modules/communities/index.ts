import { Body, Controller, Get, Module, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthGuard, Roles, RolesGuard, type AuthenticatedRequest } from '@/modules/auth';
import { ZodValidationPipe } from '@/common/zod-validation.pipe';

const createPostSchema = z.object({
  title: z.string().trim().min(3).max(140),
  body: z.string().trim().min(6).max(800),
});

@Controller('communities')
class CommunitiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const communities = await this.prisma.community.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { name: 'asc' },
    });
    return {
      communities: communities.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        accentColor: c.accentColor,
        memberCount: c._count.members,
      })),
    };
  }

  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
      include: {
        _count: { select: { members: true } },
        sessions: { where: { isPrivateClass: false }, orderBy: { scheduledAt: 'desc' } },
        posts: { include: { author: { select: { fullName: true, role: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!community) throw new NotFoundException('Community not found.');
    return {
      community: {
        id: community.id,
        slug: community.slug,
        name: community.name,
        description: community.description,
        accentColor: community.accentColor,
        memberCount: community._count.members,
      },
      sessions: community.sessions,
      posts: community.posts,
    };
  }

  @Post(':slug/follow')
  @UseGuards(AuthGuard)
  async toggleFollow(@Param('slug') slug: string, @Req() req: AuthenticatedRequest) {
    const community = await this.prisma.community.findUnique({ where: { slug } });
    if (!community) throw new NotFoundException('Community not found.');

    const existing = await this.prisma.communityMembership.findUnique({
      where: { userId_communityId: { userId: req.user!.id, communityId: community.id } },
    });

    if (existing) {
      await this.prisma.communityMembership.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.communityMembership.create({
        data: { userId: req.user!.id, communityId: community.id, role: UserRole.MEMBER },
      });
    }

    const memberCount = await this.prisma.communityMembership.count({
      where: { communityId: community.id },
    });
    return { isFollowing: !existing, memberCount };
  }

  @Post(':slug/posts')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.HOST, UserRole.MODERATOR, UserRole.LECTURER, UserRole.ADMIN)
  async createPost(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(createPostSchema)) body: z.infer<typeof createPostSchema>,
    @Req() req: AuthenticatedRequest,
  ) {
    const community = await this.prisma.community.findUnique({ where: { slug } });
    if (!community) throw new NotFoundException('Community not found.');

    const post = await this.prisma.communityPost.create({
      data: {
        communityId: community.id,
        authorId: req.user!.id,
        title: body.title,
        body: body.body,
      },
    });
    return { post };
  }
}

@Module({ controllers: [CommunitiesController] })
export class CommunitiesModule {}
