import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app';
import { configureApp } from './configs/app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  configureApp(app);

  const port =
    config.get<number>('API_PORT') ?? config.getOrThrow<number>('PORT');
  await app.listen(port);
}

void bootstrap();
