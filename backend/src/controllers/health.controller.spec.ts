import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './health.controller';
import { AppService } from '../services/health.service';

describe('HealthController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should report the service as healthy', () => {
      expect(appController.getHealth()).toMatchObject({
        service: 'english-quest-api',
        status: 'ok',
      });
    });
  });
});
