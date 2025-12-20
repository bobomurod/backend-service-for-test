import { Module } from '@nestjs/common';
import { RabbitPublisher } from './rabbitmq.publisher';
import { RabbitMqConsumerService } from './rabbitmq.consumer.service';

@Module({
  providers: [RabbitMqConsumerService, RabbitPublisher],
  exports: [RabbitPublisher],
})
export class RabbitMqModule {}
