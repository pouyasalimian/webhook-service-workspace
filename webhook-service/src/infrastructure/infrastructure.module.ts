import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './database/prisma.service.js';
import { RedisConnectionService } from './redis/redis-connection.service.js';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [PrismaService, RedisConnectionService],
  exports: [PrismaService, RedisConnectionService],
})
export class InfrastructureModule {}
