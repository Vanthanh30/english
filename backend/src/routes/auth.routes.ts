import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from '../services/auth.service';
import { EmailService } from '../services/mail.service';
import { AUTH_REPOSITORY } from '../repositories/auth.repository';
import { PrismaAuthRepository } from '../repositories/prisma-auth.repository';
import { AuthController } from '../controllers/auth.controller';
import { JwtAuthGuard } from '../middlewares/auth.middleware';
import { RolesGuard } from '../middlewares/admin.middleware';
import { SessionGenerationService } from '../services/session-generation.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailService,
    SessionGenerationService,
    JwtAuthGuard,
    RolesGuard,
    {
      provide: AUTH_REPOSITORY,
      useClass: PrismaAuthRepository,
    },
  ],
  exports: [
    JwtModule,
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    SessionGenerationService,
  ],
})
export class AuthModule {}
