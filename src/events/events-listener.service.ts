import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Client } from 'pg';

@Injectable()
export class EventsListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsListenerService.name);

  private client: Client | null = null;
  private stopping = false;

  // Канал в Postgres
  private readonly channel = 'outbox_event_created';

  async onModuleInit() {
    await this.connectAndListen();
  }

  async onModuleDestroy() {
    this.stopping = true;
    await this.safeClose();
  }

  private async connectAndListen() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }

    const client = new Client({ connectionString });

    client.on('notification', (msg) => {
      if (msg.channel !== this.channel) return;
      this.logger.log(
        `NOTIFY received on "${msg.channel}": payload=${msg.payload}`,
      );
    });

    // Ловим ошибку но не падаем
    client.on('error', (err) => {
      this.logger.error(`Postgres client error: ${err?.message ?? err}`);
      // логируем
      // Переподключение
    });

    // Соединение закрыто - переподключиться
    client.on('end', () => {
      this.logger.warn(
        'Postgres LISTEN connection ended, attempting reconnect...',
      );
      this.client = null;
      this.scheduleReconnect();
    });

    try {
      await client.connect();
      await client.query(`LISTEN ${this.channel}`);
      this.client = client;
      this.logger.log(`Listening PostgreSQL channel "${this.channel}"`);
    } catch (error) {
      this.logger.error(
        `Failed to connect to PostgreSQL: ${(error as Error).message}`,
      );
      // Не падаем, просто пытаемся переподключиться
      this.scheduleReconnect();
    }
  }

  // Автоматическое переподключение с exponential backoff
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly INITIAL_RECONNECT_DELAY = 5000; // 5 сек
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.logger.error(
        `Max reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) exceeded`,
      );
      return;
    }

    const delay =
      this.INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.logger.warn(
      `Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`,
    );

    this.reconnectTimeout = setTimeout(() => {
      this.logger.log('Attempting to reconnect...');
      this.connectAndListen().catch((error) => {
        this.logger.error(`Reconnect failed: ${(error as Error).message}`);
      });
    }, delay);
  }

  // Сброс попыток если успешно подключились
  private resetReconnectAttempts() {
    this.reconnectAttempts = 0;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
  private async safeClose() {
    try {
      if (this.client) {
        // UNLISTEN
        await this.client
          .query(`UNLISTEN ${this.channel}`)
          .catch(() => undefined);
        await this.client.end().catch(() => undefined);
      }
    } finally {
      this.client = null;
    }
  }
}
