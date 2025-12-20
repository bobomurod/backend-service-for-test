import { Module } from '@nestjs/common';
import { OutboxRelayService } from './outbox-relay.service';
import { RabbitMqModule } from '../queue/rabbitmq.module';
import { OutboxRepository } from './outbox-relay.repository';
import { DbModule } from 'src/db/db.module';

@Module({
  imports: [DbModule, RabbitMqModule],
  providers: [OutboxRelayService, OutboxRepository],
})
export class OutboxRelayModule {}
