import { Module } from '@nestjs/common';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';

@Module({
  imports: [InfrastructureModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
