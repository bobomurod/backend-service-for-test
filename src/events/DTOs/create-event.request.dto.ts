import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsISO8601,
  IsEnum,
  IsObject,
} from 'class-validator';

export enum EventTypeDto {
  ACCIDENT = 'ACCIDENT',
  SERVICE = 'SERVICE',
  TRANSFER = 'TRANSFER',
}

export enum EventSourceDto {
  mobile = 'mobile',
  partner = 'partner',
  manual = 'manual',
}

// {
//   "eventId": "uuid",
//   "companyId": "string",
//   "entityId": "string",
//   "type": "ACCIDENT | SERVICE | TRANSFER",
//   "source": "mobile | partner | manual",
//   "payload": {},
//   "occurredAt": "ISO date"
// }

export class CreateEventRequestDto {
  @IsUUID()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  entityId: string;

  @IsEnum(EventTypeDto)
  type: EventTypeDto;

  @IsEnum(EventSourceDto)
  source: EventSourceDto;

  @IsObject()
  payload: Record<string, any>;

  @IsISO8601()
  occurredAt: string;
}
