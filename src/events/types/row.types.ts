export type EventRow = {
  event_id: string;
  company_id: string;
  entity_id: string;
  type: string;
  source: string;
  payload: any;
  occurred_at: string;
  created_at: string;
};

export type GetEventsRes = {
  items: EventRow[];
  nextCursor: { occurredAt: string; eventId: string } | null;
};
