import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import amqp from 'amqplib';
import type { Connection, ConfirmChannel, ChannelModel } from 'amqplib';

type ExchangeType = 'direct' | 'topic' | 'headers' | 'fanout';
interface AmqpConnection extends Connection {
  createConfirmChannel(): Promise<ConfirmChannel>;
}

@Injectable()
export class RabbitPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitPublisher.name);
  private conn: ChannelModel | null = null;
  private ch: ConfirmChannel | null = null;
  private connecting: Promise<void> | null = null;

  private readonly url = process.env.RABBITMQ_URL!;
  private readonly exchange = process.env.RABBITMQ_EXCHANGE || 'events.x';
  private readonly exchangeType: ExchangeType = 'topic';

  constructor() {}

  async onModuleInit() {
    // podnyat connection pri starte
    await this.ensureConnected();
    this.logger.log('RabbitMQ connected');
  }

  async publish<T = unknown>(routingKey: string, message: T): Promise<void> {
    await this.ensureConnected();

    const body = Buffer.from(JSON.stringify(message));

    this.ch!.sendToQueue(routingKey, body, {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now(),
    });

    await this.ch!.waitForConfirms();
  }

  async publishByType(type: string, message: unknown): Promise<void> {
    await this.ensureConnected();
    this.logger.log(`Publishing ${JSON.stringify(message)} to ${type}`);
    const body = Buffer.from(JSON.stringify(message));
    const ch = this.ch!;

    // routingKey = type
    ch.publish(this.exchange, type, body, {
      persistent: true,
      contentType: 'application/json',
    });

    // подтверждение от брокера
    await ch.waitForConfirms();
  }

  private async ensureConnected(): Promise<void> {
    if (this.conn && this.ch) return;

    // chtov race condition ne bilo
    if (this.connecting) {
      await this.connecting;
      return;
    }

    this.connecting = this.connect();

    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async connect(): Promise<void> {
    this.conn = await amqp.connect(this.url);

    this.conn.on('error', (err) => {
      this.logger.error(`RabbitMQ connection error: ${err.message}`);
    });

    this.conn.on('close', () => {
      this.logger.warn(
        'RabbitMQ connection closed, will reconnect on next publish',
      );
      this.conn = null;
      this.ch = null;
    });

    this.ch = await this.conn.createConfirmChannel();

    await this.ch.assertExchange(this.exchange, this.exchangeType, {
      durable: true,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.ch?.close().catch(() => {});
    await this.conn?.close().catch(() => {});
    this.logger.log('RabbitMQ disconnected');
  }
}
