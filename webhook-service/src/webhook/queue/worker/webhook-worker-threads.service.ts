import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker as NodeWorker } from 'node:worker_threads';

@Injectable()
export class WebhookWorkerThreadsService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(WebhookWorkerThreadsService.name);
  private readonly workers = new Map<number, NodeWorker>();
  private shuttingDown = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const workerCount = Number(this.config.get('WEBHOOK_WORKER_COUNT', 1));
    if (!Number.isSafeInteger(workerCount) || workerCount < 0) {
      throw new Error('WEBHOOK_WORKER_COUNT must be a non-negative integer');
    }

    if (workerCount === 0) {
      this.logger.log('Webhook worker threads are disabled');
      return;
    }

    this.logger.log(`Starting ${workerCount} webhook worker thread(s)`);
    for (let index = 0; index < workerCount; index++) {
      this.startWorker(index);
    }
  }

  async onApplicationShutdown() {
    this.shuttingDown = true;
    const workers = [...this.workers.values()];
    const exited = Promise.all(
      workers.map(
        (worker) =>
          new Promise<void>((resolve) => {
            if (worker.threadId === -1) {
              resolve();
              return;
            }
            worker.once('exit', () => resolve());
          }),
      ),
    );

    for (const worker of workers) {
      worker.postMessage({ type: 'shutdown' });
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      exited,
      new Promise<void>((resolve) => {
        timeoutHandle = setTimeout(resolve, 10_000);
      }),
    ]);

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    await Promise.all(workers.map((worker) => worker.terminate()));
    this.workers.clear();
  }

  private startWorker(workerIndex: number) {
    if (this.shuttingDown) {
      return;
    }

    const worker = new NodeWorker(
      new URL('./webhook-worker-thread.js', import.meta.url),
      { workerData: { workerIndex } },
    );
    this.workers.set(workerIndex, worker);

    worker.on('message', (message: { type?: string }) => {
      if (message.type === 'ready') {
        this.logger.log(`Webhook worker thread ${workerIndex} is ready`);
      }
    });

    worker.on('error', (error) => {
      this.logger.error(
        `Webhook worker thread ${workerIndex} error`,
        error.stack,
      );
    });

    worker.on('exit', (code) => {
      if (this.workers.get(workerIndex) === worker) {
        this.workers.delete(workerIndex);
      }

      if (!this.shuttingDown) {
        this.logger.error(
          `Webhook worker thread ${workerIndex} exited with code ${code}; restarting in 1 second`,
        );

        const restartTimer = setTimeout(
          () => this.startWorker(workerIndex),
          1_000,
        );

        restartTimer.unref();
      }
    });
  }
}
