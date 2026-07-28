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
app.use(cors());

// Debug logger middleware
app.use((req, res, next) => {
  console.log(`[Backend Debug] ${req.method} ${req.url}`);
  next();
});

// Enable large base64 strings and video payloads
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

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

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT} with Supabase`);
  });
}

// Background Scheduler for Scheduled HUBBs
import { supabase } from './supabase.js';

setInterval(async () => {
  try {
    const now = new Date().toISOString();
    const { data: scheduledStories, error } = await supabase
      .from('stories')
      .select('_id, scheduledAt')
      .eq('status', 'scheduled')
      .lte('scheduledAt', now);

    if (error) {
      console.error('[Scheduler] Error fetching scheduled stories:', error.message);
      return;
    }

    if (scheduledStories && scheduledStories.length > 0) {
      for (const story of scheduledStories) {
        const { error: updateError } = await supabase
          .from('stories')
          .update({
            status: 'published',
            isScheduled: false,
            createdAt: now // Reset createdAt so it appears at the top of the feed now
          })
          .eq('_id', story._id);
        
        if (updateError) {
          console.error(`[Scheduler] Failed to publish story ${story._id}:`, updateError.message);
        } else {
          console.log(`[Scheduler] Successfully auto-published scheduled story ${story._id}`);
        }
      }
    }
  } catch (err) {
    console.error('[Scheduler] Unexpected error:', err.message);
  }
}, 60000); // Check every minute

export default app;
