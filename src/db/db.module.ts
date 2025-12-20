import { Module, OnModuleDestroy } from '@nestjs/common';
import { pgPool } from './pg.pool';

@Module({
  providers: [
    {
      provide: 'PG_POOL',
      useValue: pgPool,
    },
  ],
  exports: ['PG_POOL'],
})
export class DbModule implements OnModuleDestroy {
  async onModuleDestroy() {
    await pgPool.end();
  }
}
