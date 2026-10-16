import type { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  it('creates its adapter from DATABASE_URL and connects/disconnects with the module lifecycle', async () => {
    const config = {
      getOrThrow: vi
        .fn()
        .mockReturnValue('postgresql://user:pass@localhost/db'),
    };
    const prisma = new PrismaService(config as unknown as ConfigService);
    const connect = vi.spyOn(prisma, '$connect').mockResolvedValue(undefined);
    const disconnect = vi
      .spyOn(prisma, '$disconnect')
      .mockResolvedValue(undefined);

    expect(config.getOrThrow).toHaveBeenCalledWith('DATABASE_URL');

    await prisma.onModuleInit();
    await prisma.onModuleDestroy();

    expect(connect).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
