// outbox/outbox-relay.service.ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import { OutboxRepository } from './outbox-relay.repository';
import { RabbitPublisher } from '../queue/rabbitmq.publisher';

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly workerId = `relay-${randomUUID()}`;

  private listenClient: Client | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private stopping = false;
  private readonly channel = 'outbox_event_created';

  constructor(
    private readonly outboxRepo: OutboxRepository,
    private readonly rabbit: RabbitPublisher,
  ) {}

  async onModuleInit() {
    try {
      await this.startListen();
    } catch (error) {
      this.logger.error('Failed to start listening', error);
    }

    // Safety poll with error handling
    this.pollTimer = setInterval(
      () =>
        this.flush().catch((error) => {
          this.logger.error('Error during periodic flush', error);
        }),
      5000,
    );

    // Start flush
    try {
      await this.flush();
    } catch (error) {
      this.logger.error('Error during initial flush', error);
    }
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    try {
      await this.listenClient?.end();
    } catch {}
  }

  private backoffMs(attempts: number) {
    // 1s,2s,4s... max 60s
    return Math.min(60_000, 3000 * Math.pow(2, Math.max(0, attempts)));
  }

  private async startListen() {
    const cs = process.env.DATABASE_URL;
    if (!cs) throw new Error('DATABASE_URL is not set');

    this.listenClient = new Client({ connectionString: cs });
    await this.listenClient.connect();
    await this.listenClient.query(`LISTEN ${this.channel}`);

    this.listenClient.on('notification', async (msg) => {
      if (msg.channel !== this.channel) return;
      // payload=event_id, doljen srabotat kogda new event
      await this.flush().catch((e) =>
        this.logger.error(String(e?.message ?? e)),
      );
    });

    this.logger.log('Listening channel ', this.channel);
  }

  private async flush() {
    if (this.stopping) return;

    while (!this.stopping) {
      const batch = await this.outboxRepo.claimBatch(this.workerId, 50);
      if (batch.length === 0) return;

      for (const d of batch) {
        const eventId = d.event_id;

        try {
          const ev = await this.outboxRepo.getEventById(eventId);
          if (!ev)
            throw new Error(`outbox_events not found for eventId=${eventId}`);

          await this.rabbit.publish(ev.type, {
            eventId: ev.event_id,
            type: ev.type,
            payload: ev.payload,
            occurredAt: ev.occurred_at,
            companyId: ev.company_id,
            entityId: ev.entity_id,
            source: ev.source,
          });

          await this.outboxRepo.markSent(eventId);
        } catch (e: any) {
          const attempts = (d.attempts ?? 0) + 1;
          const err = String(e?.message ?? e);

          // после 20 попыток — DEAD
          if (attempts >= 20) {
            await this.outboxRepo.markDead(eventId, attempts, err);
            this.logger.error(
              `DEAD eventId=${eventId} attempts=${attempts}: ${err}`,
            );
            continue;
          }

          const delay = this.backoffMs(attempts);
          await this.outboxRepo.markRetry(eventId, attempts, delay, err);
          this.logger.warn(
            `RETRY eventId=${eventId} attempts=${attempts}: ${err}`,
          );
        }
      }
    }
  }
}
