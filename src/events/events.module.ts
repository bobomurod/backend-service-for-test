import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { DbModule } from '../db/db.module';
import { EventsRepository } from './events.repository';
import { EventsListenerService } from './events-listener.service';
import { RabbitMqModule } from 'src/queue/rabbitmq.module';

@Module({
  imports: [DbModule, RabbitMqModule],
  providers: [EventsRepository, EventsService, EventsListenerService],
  controllers: [EventsController],
  exports: [EventsService, EventsListenerService],
})
export class EventsModule {}
