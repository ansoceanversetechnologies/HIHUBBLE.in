import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import postsRoutes from './routes/posts.js';
import reelsRoutes from './routes/reels.js';
import storiesRoutes from './routes/stories.js';
import notificationsRoutes from './routes/notifications.js';
import chatsRoutes from './routes/chats.js';
import callsRoutes from './routes/calls.js';

dotenv.config();

const app = express();

// Enable CORS for all routes and preflight requests
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Token', 'Accept']
}));

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Debug logger middleware
app.use((req, res, next) => {
  console.log(`[Backend Debug] ${req.method} ${req.url}`);
  next();
});

// Body parser limits (100mb) to support image and up to 5-minute video post uploads
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'dist')));

// Mount API Routes
app.use(authRoutes);
app.use(usersRoutes);
app.use(postsRoutes);
app.use(reelsRoutes);
app.use(storiesRoutes);
app.use(notificationsRoutes);
app.use(chatsRoutes);
app.use(callsRoutes);

const PORT = process.env.PORT || 3000;

// Fallback all other requests to frontend SPA
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

if (!process.env.NO_AUTO_LISTEN && (process.env.NODE_ENV !== 'production' || !process.env.VERCEL)) {
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT} with Supabase`);
  });
}

export default app;
