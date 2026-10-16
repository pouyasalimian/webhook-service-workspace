import { Injectable } from '@nestjs/common';
import { PrismaService } from '../infrastructure/database/prisma.service.js';
import { RedisConnectionService } from '../infrastructure/redis/redis-connection.service.js';
import { DEPENDENCY_CHECK_TIMEOUT_MS } from './health.constants.js';
import type { HealthStatus } from './health-status.interface.js';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisConnectionService,
  ) {}

  async status(): Promise<HealthStatus> {
    const [postgresqlUp, redisUp] = await Promise.all([
      this.isAvailable(() => this.prisma.$queryRaw`SELECT 1`),
      this.isAvailable(() => this.redis.client.ping()),
    ]);

    return {
      status: postgresqlUp && redisUp ? 'ok' : 'error',
      app: 'up',
      dependencies: {
        postgresql: { status: postgresqlUp ? 'up' : 'down' },
        redis: { status: redisUp ? 'up' : 'down' },
      },
    };
  }

  private async isAvailable(check: () => Promise<unknown>): Promise<boolean> {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        check(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Dependency check timed out')),
            DEPENDENCY_CHECK_TIMEOUT_MS,
          );
        }),
      ]);

      return true;
    } catch {
      return false;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
