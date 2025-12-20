import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventRequestDto } from './DTOs/create-event.request.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  createEvent(@Body() event: CreateEventRequestDto) {
    return this.eventsService.createIdempotentEvent(event);
  }

  @Get()
  async listEvents(
    @Query('companyId') companyId: string,
    @Query('entityId') entityId?: string,
    @Query('type') type?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('cursorOccurredAt') cursorOccurredAt?: string,
    @Query('cursorEventId') cursorEventId?: string,
  ) {
    return await this.eventsService.getEvents({
      companyId,
      entityId,
      type,
      dateFrom,
      dateTo,
      limit: limit ? Number(limit) : undefined,
      cursorOccurredAt,
      cursorEventId,
    });
  }
}
