import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  AuthGuard,
  verifyCookieOriginIfNeeded,
  type AuthenticatedRequest,
} from '@/modules/auth/auth.guard';
import { Roles } from '@/modules/auth/roles.decorator';
import { RolesGuard } from '@/modules/auth/roles.guard';
import { UsersService } from '@/modules/users/users.service';
import {
  updateMyProfileSchema,
  updateUserRoleSchema,
  type UpdateMyProfileDto,
  type UpdateUserRoleDto,
} from '@/modules/users/users.schemas';
import { ZodValidationPipe } from '@/common/zod-validation.pipe';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @Patch('me')
  updateMyProfile(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(updateMyProfileSchema)) body: UpdateMyProfileDto,
  ) {
    verifyCookieOriginIfNeeded(req);
    return this.usersService.updateProfile(req.user!.id, body);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  listUsers() {
    return this.usersService.listUsers();
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  updateRole(
    @Param('id') targetUserId: string,
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(updateUserRoleSchema)) body: UpdateUserRoleDto,
  ) {
    verifyCookieOriginIfNeeded(req);
    return this.usersService.updateRole(targetUserId, req.user!.id, body);
  }
}
