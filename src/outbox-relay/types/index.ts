// outbox/types.ts
export type OutboxDeliveryStatus =
  | 'NEW'
  | 'SENDING'
  | 'SENT'
  | 'RETRY'
  | 'DEAD';

export type DeliveryRow = {
  event_id: string;
  attempts: number;
};

export type OutboxEventRow = {
  event_id: string;
  type: string;
  payload: any;
  occurred_at: string;
  company_id?: string;
  entity_id?: string;
  source?: string;
};
