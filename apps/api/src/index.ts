import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' }); // fallback

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { chatRouter } from './routes/chat';
import { paymentsRouter } from './routes/payments';
import { walletRouter } from './routes/wallet';
import { conversationsRouter } from './routes/conversations';
import { adminRouter } from './routes/admin';
import { generateImageRouter } from './routes/generate-image';
import type { AppVariables } from './types';

const app = new Hono<{ Variables: AppVariables }>();

app.use('*', logger());
app.use('*', cors({
  origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
}));

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/api/chat', chatRouter);
app.route('/api/payments', paymentsRouter);
app.route('/api/wallet', walletRouter);
app.route('/api/conversations', conversationsRouter);
app.route('/api/admin', adminRouter);
app.route('/api/generate-image', generateImageRouter);

const port = parseInt(process.env.PORT || '3001');

serve({ fetch: app.fetch, port }, () => {
  console.log(`API server running on http://localhost:${port}`);
});

export default app;
