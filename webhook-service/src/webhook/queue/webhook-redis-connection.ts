import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class WebhookRedisConnection implements OnApplicationShutdown {
  readonly client: Redis;

  constructor(config: ConfigService) {
    const host = config.get<string>('REDIS_HOST', '127.0.0.1');
    const port = Number(config.get<string | number>('REDIS_PORT', 6379));
    const password = config.get<string>('REDIS_PASSWORD');

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('REDIS_PORT must be an integer between 1 and 65535');
    }

    this.client = new Redis({
      host,
      port,
      ...(password ? { password } : {}),
      // Workers need this setting and BullMQ duplicates this client for blocking reads.
      maxRetriesPerRequest: null,
    });
  }

  async onApplicationShutdown() {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}
