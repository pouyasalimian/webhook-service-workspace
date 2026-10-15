import { Module } from '@nestjs/common';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { WebhookModule } from './webhook/webhook.module.js';

@Module({
  imports: [InfrastructureModule, WebhookModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
