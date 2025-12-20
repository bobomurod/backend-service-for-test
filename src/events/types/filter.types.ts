export type FindEventsFilters = {
  companyId: string; // default required
  entityId?: string;
  type?: string;
  dateFrom?: string; // ISO
  dateTo?: string; // ISO
  limit?: number; // 1..200
  cursorOccurredAt?: string; // ISO
  cursorEventId?: string; // uuid
};
