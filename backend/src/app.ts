import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './controllers/health.controller';
import { AppService } from './services/health.service';
import { PrismaModule } from './configs/database.module';
import { AuthModule } from './routes/auth.routes';
import { ContentModule } from './routes/admin.routes';
import { LessonModule } from './routes/lesson.routes';
import { NoteModule } from './routes/note.routes';
import { FlashcardModule } from './routes/flashcard.routes';
import { GameModule } from './routes/game.routes';
import { ReadingModule } from './routes/reading.routes';
import { ChatbotModule } from './routes/chatbot.routes';
import { ImageWritingModule } from './routes/image-writing.routes';
import { ListeningModule } from './routes/listening.routes';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().port().default(4000),
        API_PORT: Joi.number().port().optional(),
        WEB_ORIGIN: Joi.string().uri().default('http://localhost:3000'),
        DATABASE_URL: Joi.string()
          .pattern(/^mongodb(\+srv)?:\/\//)
          .required(),
        REDIS_URL: Joi.string().uri().required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('24h'),
        EMAIL_VERIFICATION_EXPIRES_IN_HOURS: Joi.number()
          .integer()
          .positive()
          .default(24),
        SMTP_HOST: Joi.string().allow('').optional(),
        SMTP_PORT: Joi.number().port().default(587),
        SMTP_SECURE: Joi.boolean().default(false),
        SMTP_USER: Joi.string().allow('').optional(),
        SMTP_PASSWORD: Joi.string().allow('').optional(),
        EMAIL_FROM: Joi.string().default(
          'English Quest <no-reply@englishquest.local>',
        ),
        CLOUDINARY_CLOUD_NAME: Joi.string().required(),
        CLOUDINARY_API_KEY: Joi.string().required(),
        CLOUDINARY_API_SECRET: Joi.string().required(),
        GEMINI_API_KEY: Joi.string().required(),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    PrismaModule,
    AuthModule,
    ContentModule,
    LessonModule,
    NoteModule,
    FlashcardModule,
    GameModule,
    ReadingModule,
    ChatbotModule,
    ImageWritingModule,
    ListeningModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
