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
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import type { AuthSession } from '../services/auth.service';
import { CurrentUser } from '../middlewares/decorators/current-user.decorator';
import { Roles } from '../middlewares/decorators/roles.decorator';
import { LoginDto } from './dto/auth/login.dto';
import { RegisterDto } from './dto/auth/register.dto';
import { VerifyEmailDto } from './dto/auth/verify-email.dto';
import { JwtAuthGuard } from '../middlewares/auth.middleware';
import type { AuthenticatedUser } from '../middlewares/auth.middleware';
import { RolesGuard } from '../middlewares/admin.middleware';

const REFRESH_COOKIE = 'english_quest_refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) { }

  @Post('register')
  register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  verifyEmail(@Body() input: VerifyEmailDto) {
    return this.auth.verifyEmail(input.token);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.login(input.email, input.password);
    this.setRefreshCookie(response, session);
    return this.toClientSession(session);
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) {
      response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
      return this.auth.refresh('');
    }

    try {
      const session = await this.auth.refresh(token);
      this.setRefreshCookie(response, session);
      return this.toClientSession(session);
    } catch (error) {
      response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
      throw error;
    }
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = request.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.auth.logout(token);
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getUser(user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin-check')
  adminCheck() {
    return { message: 'Admin access granted' };
  }

  private setRefreshCookie(response: Response, session: AuthSession): void {
    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...this.cookieOptions(),
      maxAge: session.refreshTokenMaxAgeMs,
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      path: '/api/v1/auth',
    };
  }

  private toClientSession(session: AuthSession) {
    return {
      accessToken: session.accessToken,
      user: session.user,
    };
  }
}
