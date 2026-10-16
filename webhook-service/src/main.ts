import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { SwaggerConfig } from './configs/swagger.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);

  const appEnv = configService.get<string>('APP_ENV', 'development');
  if (appEnv === 'development') {
    app.enableCors();
    SwaggerConfig.configure(app);
  }

  const port = Number(configService.get('APP_PORT', 3000));
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error('APP_PORT must be an integer between 1 and 65535');
  }

  await app.listen(port);
}
await bootstrap();
