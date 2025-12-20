import { Pool } from 'pg';

export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

pgPool.on('error', (error: Error) => {
  console.error('Unexpected error on idle client', {
    message: error.message,
    code: error.message,
    timestamp: new Date(),
  });
});

pgPool.on('connect', () => {
  console.log('New client connected to database');
});

pgPool.on('remove', () => {
  console.log('Client removed from pool');
});
