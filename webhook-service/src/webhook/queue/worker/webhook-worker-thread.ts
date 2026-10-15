import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { parentPort, workerData } from 'node:worker_threads';
import { WebhookWorkerModule } from './webhook-worker.module.js';

const { workerIndex } = workerData as { workerIndex: number };
let app: INestApplicationContext | undefined;
let shutdownRequested = false;
let closing = false;

async function closeWorker() {
  if (closing) {
    return;
  }

  closing = true;

  await app?.close();
  parentPort?.postMessage({ type: 'stopped', workerIndex });
  parentPort?.close();
}

parentPort?.on('message', (message: { type?: string }) => {
  if (message?.type === 'shutdown') {
    shutdownRequested = true;
    if (app) {
      void closeWorker();
    }
  }
});

try {
  app = await NestFactory.createApplicationContext(WebhookWorkerModule);

  if (shutdownRequested) {
    await closeWorker();
  } else {
    parentPort?.postMessage({ type: 'ready', workerIndex });
  }
} catch (error) {
  console.error(`Webhook worker thread ${workerIndex} failed to start`, error);
  throw error;
}
