import { Context, Next } from 'hono';
import type { AppVariables } from '../types';
import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

const REQUESTS_PER_MINUTE = 20;

export async function rateLimitMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
  const client = getRedis();

  // Skip rate limiting if Redis is not configured
  if (!client) {
    await next();
    return;
  }

  const userId = c.get('userId') as string;
  const key = `rate_limit:${userId}:${Math.floor(Date.now() / 60000)}`;

  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, 60);
  }

  if (count > REQUESTS_PER_MINUTE) {
    return c.json(
      { error: 'Too many requests' },
      429,
      { 'Retry-After': '60' }
    );
  }

  await next();
}
