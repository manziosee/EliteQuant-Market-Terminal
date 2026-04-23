import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { startBackend } from '../backend/index.ts';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));

// Socket.io is not supported in Vercel serverless — mock satisfies the startBackend signature.
// The frontend falls back to REST polling (/api/market/pulse) for live updates.
const mockIo = {
  emit: (_event: string, _data: unknown) => {},
  on: (_event: string, _cb: unknown) => {},
} as any;

startBackend(app, mockIo);

export default app;
