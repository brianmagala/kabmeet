import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AuthGuard,
  extractSessionToken,
  SESSION_COOKIE_NAME,
  verifyCookieOriginIfNeeded,
  type AuthenticatedRequest,
} from '@/modules/auth/auth.guard';
import { AuthService } from '@/modules/auth/auth.service';
import { loginSchema, registerSchema, type LoginDto, type RegisterDto } from '@/modules/auth/auth.schemas';
import { ZodValidationPipe } from '@/common/zod-validation.pipe';

const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function isHttpsRequest(req: Request): boolean {
  return (
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production'
  );
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const secure = isHttpsRequest(req);
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (secure) {
    attributes.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const secure = isHttpsRequest(req);
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (secure) {
    attributes.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', attributes.join('; '));
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(body, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    setSessionCookie(req, res, result.accessToken);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    setSessionCookie(req, res, result.accessToken);
    return result;
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    verifyCookieOriginIfNeeded(req);
    if (req.sessionId) {
      await this.authService.logout(req.sessionId);
    }
    clearSessionCookie(req, res);
    return { message: 'Signed out cleanly.' };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@Req() req: AuthenticatedRequest) {
    return this.authService.getAuthenticatedProfile(req.user!);
  }

  @Get('session')
  async getSession(@Req() req: Request) {
    const token = extractSessionToken(req);
    return this.authService.resolveOptionalSession(token);
  }
}
