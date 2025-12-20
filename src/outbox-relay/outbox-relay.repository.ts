// outbox/outbox.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DeliveryRow, OutboxEventRow } from './types';

@Injectable()
export class OutboxRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  /**
   * Забираем пачку event_id из outbox_delivery и помечаем SENDING
   * атомарно, чтобы несколько воркеров не взяли одно и то же.
   */
  async claimBatch(workerId: string, limit = 50): Promise<DeliveryRow[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const res = await client.query<DeliveryRow>(
        `
        SELECT event_id, attempts
        FROM outbox_delivery
        WHERE (status='NEW' OR status='RETRY')
          AND (next_retry_at IS NULL OR next_retry_at <= now())
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT $1
      `,
        [limit],
      );

      if (res.rowCount === 0) {
        await client.query('COMMIT');
        return [];
      }

      const ids = res.rows.map((r) => r.event_id);

      await client.query(
        `
        UPDATE outbox_delivery
        SET status='SENDING',
            locked_at=now(),
            locked_by=$1,
            updated_at=now()
        WHERE event_id = ANY($2::uuid[])
      `,
        [workerId, ids],
      );

      await client.query('COMMIT');
      return res.rows;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }

  async getEventById(eventId: string): Promise<OutboxEventRow | null> {
    const res = await this.pool.query<OutboxEventRow>(
      `
      SELECT event_id, type, payload, occurred_at, company_id, entity_id, source
      FROM outbox_events
      WHERE event_id = $1::uuid
    `,
      [eventId],
    );

    return res.rowCount ? res.rows[0] : null;
  }

  async markSent(eventId: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE outbox_delivery
      SET status='SENT',
          last_error=NULL,
          updated_at=now()
      WHERE event_id=$1::uuid
    `,
      [eventId],
    );
  }

  async markRetry(
    eventId: string,
    attempts: number,
    delayMs: number,
    err: string,
  ): Promise<void> {
    await this.pool.query(
      `
      UPDATE outbox_delivery
      SET status='RETRY',
          attempts=$2,
          next_retry_at=now() + ($3 || ' milliseconds')::interval,
          last_error=$4,
          updated_at=now()
      WHERE event_id=$1::uuid
    `,
      [eventId, attempts, String(delayMs), err],
    );
  }

  async markDead(
    eventId: string,
    attempts: number,
    err: string,
  ): Promise<void> {
    await this.pool.query(
      `
      UPDATE outbox_delivery
      SET status='DEAD',
          attempts=$2,
          last_error=$3,
          updated_at=now()
      WHERE event_id=$1::uuid
    `,
      [eventId, attempts, err],
    );
  }

  /**
   * Опционально: "reaper" для зависших SENDING (если воркер умер).
   */
  async releaseStuckSending(olderThanSeconds = 300): Promise<number> {
    const res = await this.pool.query(
      `
      UPDATE outbox_delivery
      SET status='RETRY',
          locked_at=NULL,
          locked_by=NULL,
          next_retry_at=now(),
          updated_at=now()
      WHERE status='SENDING'
        AND locked_at < now() - ($1 || ' seconds')::interval
    `,
      [String(olderThanSeconds)],
    );
    return res.rowCount ?? 0;
  }
}
