import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from './../src/app';
import { configureApp } from './../src/configs/app';
import { SessionGenerationService } from './../src/services/session-generation.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          service: 'english-quest-api',
          status: 'ok',
        });
      });
  });

  it('/api/v1/admin/content/topics rejects missing authentication', () => {
    return request(app.getHttpServer())
      .get('/api/v1/admin/content/topics')
      .expect(401);
  });

  it('/api/v1/admin/content/topics rejects student role', async () => {
    const sessionGeneration = app.get(SessionGenerationService);
    const token = await new JwtService().signAsync(
      {
        sub: '507f1f77bcf86cd799439011',
        email: 'student@example.com',
        role: 'STUDENT',
        type: 'access',
        sid: sessionGeneration.id,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: 60,
      },
    );

    return request(app.getHttpServer())
      .get('/api/v1/admin/content/topics')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  afterEach(async () => {
    await app?.close();
  });
});
