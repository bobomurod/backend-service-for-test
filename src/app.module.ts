import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { EventsModule } from './events/events.module';
import { RabbitMqModule } from './queue/rabbitmq.module';
import { OutboxRelayModule } from './outbox-relay/outbox-relay.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EventsModule,
    RabbitMqModule,
    OutboxRelayModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
