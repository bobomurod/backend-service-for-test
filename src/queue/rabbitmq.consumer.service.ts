import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import amqp from 'amqplib';
import { ChannelModel, Connection, ConfirmChannel } from 'amqplib';

@Injectable()
export class RabbitMqConsumerService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMqConsumerService.name);

  private conn!: ChannelModel;
  private ch!: ConfirmChannel;

  private readonly exchange = 'events.x';

  async onModuleInit() {
    await this.connect();
    await this.setupTopology();
    // await this.startConsume();
  }

  private async connect() {
    const url = process.env.RABBITMQ_URL!;
    this.conn = await amqp.connect(url);
    this.ch = await this.conn.createConfirmChannel();
  }

  private async setupTopology() {
    await this.ch.assertExchange(this.exchange, 'topic', { durable: true });

    await this.assertQueueWithBinding('ACCIDENT', 'ACCIDENT');
    await this.assertQueueWithBinding('SERVICE', 'SERVICE');
    await this.assertQueueWithBinding('TRANSFER', 'TRANSFER');
    await this.assertQueueWithBinding('UNHANDLED', 'UNHANDLED');

    this.logger.log('RabbitMQ topology initialized');
  }

  private async assertQueueWithBinding(queue: string, routingKey: string) {
    await this.ch.assertQueue(queue, { durable: true });
    await this.ch.bindQueue(queue, this.exchange, routingKey);
  }

  // тест очередей

  // private async startConsume() {
  //   await this.ch.consume('ACCIDENT', (msg) => {
  //     if (!msg) return;
  //     this.logger.log(`ACCIDENT received: ${msg.content.toString()}`);
  //     this.ch.ack(msg);
  //   });

  //   await this.ch.consume('SERVICE', (msg) => {
  //     if (!msg) return;
  //     this.logger.log(`SERVICE received: ${msg.content.toString()}`);
  //     this.ch.ack(msg);
  //   });

  //   await this.ch.consume('TRANSFER', (msg) => {
  //     if (!msg) return;
  //     this.logger.log(`TRANSFER received: ${msg.content.toString()}`);
  //     this.ch.ack(msg);
  //   });

  //   await this.ch.consume('UNHANDLED', (msg) => {
  //     if (!msg) return;
  //     this.logger.log(`UNHANDLED received: ${msg.content.toString()}`);
  //     this.ch.ack(msg);
  //   });
  // }
}
