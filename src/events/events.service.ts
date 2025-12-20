import { Injectable, Logger } from '@nestjs/common';
import { CreateEventRequestDto } from './DTOs/create-event.request.dto';
import { EventsRepository } from './events.repository';
import { FindEventsFilters } from './types/filter.types';
import { GetEventsRes } from './types/row.types';
import { RabbitPublisher } from '../queue/rabbitmq.publisher';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  constructor(
    private readonly eventsRepository: EventsRepository,
    private readonly rabbitPublisher: RabbitPublisher,
  ) {}

  createIdempotentEvent(event: CreateEventRequestDto) {
    setImmediate(() => {
      this.processEventInBackground(event);
    });

    return { eventId: event.eventId, status: 'accepted' };
  }

  async getEvents(filters: FindEventsFilters): Promise<GetEventsRes> {
    return await this.eventsRepository.findEvents(filters);
  }

  private processEventInBackground(event: CreateEventRequestDto) {
    this.eventsRepository.insertEventAndOutbox(event).catch((error) => {
      this.logger.error(`Failed to process event ${event.eventId}`, error);
      this.rabbitPublisher
        .publish('UNHANDLED', {
          event,
          error: error.message,
          failedAt: new Date(),
          attempts: 1,
        })
        .catch((publishError) => {
          this.logger.error(`Failed to publish to RabbitMQ`, publishError);
        });
    });
  }
}
