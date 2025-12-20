
-- EVENTS (append-only)
CREATE TABLE IF NOT EXISTS events (
  event_id     uuid        NOT NULL,
  company_id   text        NOT NULL,
  entity_id    text        NOT NULL,
  type         text        NOT NULL,
  source       text        NOT NULL,
  payload      jsonb       NOT NULL,
  occurred_at  timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_pk PRIMARY KEY (event_id)
);

-- OUTBOX (append-only)
CREATE TABLE IF NOT EXISTS outbox_events (
  event_id     uuid        NOT NULL,
  company_id   text        NOT NULL,
  entity_id    text        NOT NULL,
  type         text        NOT NULL,
  source       text        NOT NULL,
  payload      jsonb       NOT NULL,
  occurred_at  timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outbox_events_pk PRIMARY KEY (event_id)
);

CREATE TABLE IF NOT EXISTS outbox_delivery (
  event_id      uuid        PRIMARY KEY REFERENCES outbox_events(event_id) ON DELETE RESTRICT,

  status        text        NOT NULL DEFAULT 'NEW',   -- NEW | SENDING | SENT | RETRY | DEAD
  attempts      int         NOT NULL DEFAULT 0,
  next_retry_at timestamptz NULL,
  last_error    text        NULL,

  locked_at     timestamptz NULL,
  locked_by     text        NULL,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbox_delivery_pick_idx
  ON outbox_delivery (status, next_retry_at, created_at);

-- Общая функция запрета UPDATE / DELETE
CREATE OR REPLACE FUNCTION forbid_update_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'UPDATE and DELETE are forbidden on this table';
END;
$$ LANGUAGE plpgsql;

-- Триггеры
CREATE TRIGGER events_no_update_delete
BEFORE UPDATE OR DELETE ON events
FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

CREATE TRIGGER outbox_no_update_delete
BEFORE UPDATE OR DELETE ON outbox_events
FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- Функция уведомления
CREATE OR REPLACE FUNCTION notify_outbox_event_created()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'outbox_event_created',   -- имя канала
    NEW.event_id::text        -- только eventId
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер
DROP TRIGGER IF EXISTS outbox_events_notify_created ON outbox_events;

CREATE TRIGGER outbox_events_notify_created
AFTER INSERT ON outbox_events
FOR EACH ROW
EXECUTE FUNCTION notify_outbox_event_created();
