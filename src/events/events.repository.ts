// repository pattern чтоб работать с запросами к базе данных в отдельном куске кода
import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { pgPool } from '../db/pg.pool';
import { CreateEventRequestDto } from './DTOs/create-event.request.dto';
import { FindEventsFilters } from './types/filter.types';
import { EventRow } from './types/row.types';

@Injectable()
export class EventsRepository {
  private readonly logger = new Logger(EventsRepository.name);
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}
  async insertEventAndOutbox(
    evt: CreateEventRequestDto,
  ): Promise<{ inserted: boolean }> {
    let result;
    try {
      await pgPool.query('BEGIN');
      const sql = `
      WITH ins AS (
        INSERT INTO events (
          event_id, company_id, entity_id, type, source, payload, occurred_at
        )
        VALUES (
          $1::uuid, $2, $3, $4, $5, $6::jsonb, $7::timestamptz
        )
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id
      ),
      outbox AS (
        INSERT INTO outbox_events (
          event_id, company_id, entity_id, type, source, payload, occurred_at
        )
        SELECT
          $1::uuid, $2, $3, $4, $5, $6::jsonb, $7::timestamptz
        FROM ins
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id
      )
      INSERT INTO outbox_delivery(event_id, status)
      SELECT event_id, 'NEW'
      FROM outbox
      ON CONFLICT (event_id) DO NOTHING
      RETURNING event_id;

    `;

      result = await pgPool.query(sql, [
        evt.eventId,
        evt.companyId,
        evt.entityId,
        evt.type,
        evt.source,
        evt.payload ?? {},
        evt.occurredAt,
      ]);
      await pgPool.query('COMMIT');
    } catch (error) {
      // await pgPool.query('ROLLBACK');
      this.logger.error('Database error');
      throw error;
    }
    return { inserted: (result.rowCount ?? 0) > 0 };
  }

  async findEvents(filters: FindEventsFilters): Promise<{
    items: EventRow[];
    nextCursor: { occurredAt: string; eventId: string } | null;
  }> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);

    const where: string[] = [];
    const params: any[] = [];
    let i = 1;

    // обязательный фильтр companyId
    where.push(`company_id = $${i++}`);
    params.push(filters.companyId);

    if (filters.entityId) {
      where.push(`entity_id = $${i++}`);
      params.push(filters.entityId);
    }

    if (filters.type) {
      where.push(`type = $${i++}`);
      params.push(filters.type);
    }

    if (filters.dateFrom) {
      where.push(`occurred_at >= $${i++}::timestamptz`);
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      where.push(`occurred_at <= $${i++}::timestamptz`);
      params.push(filters.dateTo);
    }

    // keyset pagination cursor
    if (filters.cursorOccurredAt && filters.cursorEventId) {
      where.push(
        `(occurred_at, event_id) < ($${i++}::timestamptz, $${i++}::uuid)`,
      );
      params.push(filters.cursorOccurredAt, filters.cursorEventId);
    }

    // берём limit+1 чтобы понять, есть ли следующая страница
    const sql = `
        SELECT event_id, company_id, entity_id, type, source, payload, occurred_at, created_at
        FROM events
        WHERE ${where.join(' AND ')}
        ORDER BY occurred_at DESC, event_id DESC
        LIMIT $${i++};
      `;
    params.push(limit + 1);

    const res = await this.pool.query<EventRow>(sql, params);

    const hasMore = res.rows.length > limit;
    const items = hasMore ? res.rows.slice(0, limit) : res.rows;

    const nextCursor =
      hasMore && items.length
        ? {
            occurredAt: items[items.length - 1].occurred_at,
            eventId: items[items.length - 1].event_id,
          }
        : null;

    return { items, nextCursor };
  }

  // async selectBatchEvents(eventId: string, workerId: string) {
  //   const sql = `
  //   BEGIN;

  //   SELECT d.event_id
  //   FROM outbox_delivery d
  //   WHERE
  //     (d.status = 'NEW' OR d.status = 'RETRY')
  //     AND (d.next_retry_at IS NULL OR d.next_retry_at <= now())
  //   ORDER BY d.created_at
  //   FOR UPDATE SKIP LOCKED
  //   LIMIT 50;
  //   UPDATE outbox_delivery
  //   SET status='SENDING', locked_at=now(), locked_by=${workerId}, updated_at=now()
  //   WHERE event_id = ANY($ids::uuid[]);

  //   COMMIT;`;

  //   const res = await this.pool.query(sql, [workerId]);

  //   return res.rows;
  // }

  // async updateOutboxDeliveryStatus(
  //   eventId: string,
  //   workerId: string,
  //   status: string,
  // ) {
  //   const sql = `
  //     UPDATE outbox_delivery
  //     SET status=${status}, locked_at=now(), locked_by=${workerId}, updated_at=now()
  //     WHERE event_id = ANY(${eventId}::uuid[])`;

  //   await this.pool.query(sql, [status, eventId]);
  // }
}
