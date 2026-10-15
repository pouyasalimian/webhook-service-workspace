import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './database/prisma.service.js';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class InfrastructureModule {}
