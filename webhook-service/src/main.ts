import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { SwaggerConfig } from './configs/swagger.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const appEnv = configService.get<string>('APP_ENV', 'production');
  if (appEnv === 'development') {
    app.enableCors();
    SwaggerConfig.configure(app);
  }

  const port = configService.get<number>('APP_PORT', 3000);
  await app.listen(port);
}
await bootstrap();
