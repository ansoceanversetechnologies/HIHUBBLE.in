import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

// Helper to format counts (e.g. 1500 -> 1.5K)
function formatCount(num) {
  if (!num || isNaN(num)) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
}

// Helper to map DB reel object to frontend format
function mapReelToFrontend(reel, currentUserId = null) {
  if (!reel) return null;
  const author = reel.author;
  const mappedAuthor = author ? {
    _id: author.id,
    fullName: author.full_name || author.username || 'Hubble User',
    username: author.username || 'hubble_user',
    profileImage: author.profile_image_url || ''
  } : {
    _id: reel.author_id,
    fullName: 'Hubble User',
    username: 'hubble_user',
    profileImage: ''
  };

  const rawLikeCount = reel.like_count || (Array.isArray(reel.reel_likes) ? reel.reel_likes.length : 0);
  const rawCommentCount = reel.comment_count || (Array.isArray(reel.reel_comments) ? reel.reel_comments.length : 0);
  const rawShareCount = reel.share_count || 0;
  const rawViewCount = reel.view_count || 0;

  const isLiked = currentUserId && Array.isArray(reel.reel_likes)
    ? reel.reel_likes.some(l => l.user_id === currentUserId)
    : false;

  const isSaved = currentUserId && Array.isArray(reel.saved_reels)
    ? reel.saved_reels.some(s => s.user_id === currentUserId)
    : false;

  return {
    _id: reel.id,
    id: reel.id,
    author: mappedAuthor,
    videoUrl: reel.video_url,
    thumbnailUrl: reel.thumbnail_url || '',
    caption: reel.caption || '',
    audioTrackName: reel.audio_track_name || `Original Audio - ${mappedAuthor.username}`,
    durationSeconds: reel.duration_seconds || 0,
    viewCount: rawViewCount,
    likeCount: rawLikeCount,
    commentCount: rawCommentCount,
    shareCount: rawShareCount,
    formattedLikes: formatCount(rawLikeCount),
    formattedComments: formatCount(rawCommentCount),
    formattedShares: formatCount(rawShareCount),
    isLiked: !!isLiked,
    isSaved: !!isSaved,
    likes: Array.isArray(reel.reel_likes) ? reel.reel_likes.map(l => l.user_id) : [],
    createdAt: reel.created_at,
    updatedAt: reel.updated_at
  };
}

// 1. POST /api/reels - Create new reel
router.post('/api/reels', authenticateToken, async (req, res) => {
  const { videoUrl, caption, audioTrackName, thumbnailUrl } = req.body;
  if (!videoUrl) return res.status(400).json({ error: 'Video URL or media data is required.' });

  // Extract & validate duration_seconds
  let rawDuration = req.body.durationSeconds !== undefined ? req.body.durationSeconds : req.body.duration_seconds;
  let durationSeconds = Math.round(Number(rawDuration));

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return res.status(400).json({ error: 'Unable to determine Reel duration. Please check your clips.' });
  }

  if (durationSeconds > 90) {
    return res.status(400).json({ error: 'Reel duration must not exceed 90 seconds.' });
  }

  console.log(`[API REEL POST] Received duration_seconds: ${rawDuration} -> Insert value: ${durationSeconds}`);

  try {
    let finalVideoUrl = videoUrl;
    const userId = req.user.id;

    // Handle base64 video upload to Supabase storage if applicable
    if (typeof videoUrl === 'string' && videoUrl.startsWith('data:')) {
      try {
        const matches = videoUrl.match(/^data:([^;]+);(?:[^;]+;)*base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          const ext = mimeType.split('/')[1] || 'webm';
          const filename = `${userId}/reel_${Date.now()}.${ext}`;

          const { error: uploadErr } = await supabase.storage
            .from('post-videos')
            .upload(filename, buffer, { contentType: mimeType, upsert: true });

          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage.from('post-videos').getPublicUrl(filename);
            if (publicUrlData?.publicUrl) {
              finalVideoUrl = publicUrlData.publicUrl;
            }
          } else {
            console.warn("Reel storage upload notice:", uploadErr.message);
          }
        }
      } catch (e) {
        console.warn("Reel storage exception notice:", e.message);
      }
    }

    // Ensure valid profile exists
    let validAuthorId = userId;
    const { data: userProfile } = await supabase.from('profiles').select('id').eq('id', userId).single();
    if (!userProfile) {
      const userObj = req.user || {};
      const { data: createdProf } = await supabase.from('profiles').insert([{
        id: userId,
        username: userObj.username || 'hubble_user',
        full_name: userObj.full_name || userObj.username || 'Hubble User',
        profile_image_url: userObj.profile_image_url || ''
      }]).select('id').single();
      if (createdProf) validAuthorId = createdProf.id;
    }

    const { data: newReel, error } = await supabase.from('reels').insert([{
      author_id: validAuthorId,
      video_url: finalVideoUrl,
      caption: caption || '',
      audio_track_name: audioTrackName || '',
      thumbnail_url: thumbnailUrl || '',
      duration_seconds: durationSeconds,
      view_count: 0,
      like_count: 0,
      comment_count: 0,
      share_count: 0
    }]).select('*, author:profiles(id, full_name, username, profile_image_url)').single();

    if (error) {
      console.error("Reel insert error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json(mapReelToFrontend(newReel, userId));
  } catch (err) {
    console.error("POST /api/reels error:", err);
    res.status(500).json({ error: err.message });
  }
});

import jwt from 'jsonwebtoken';

// Helper to extract userId from optional token in GET requests
function getUserIdFromToken(req) {
  const authHeader = req.headers.authorization || req.headers['x-user-token'];
  if (!authHeader) return null;

  let token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  if (!token || token === 'undefined' || token === 'null') return null;

  const possibleSecrets = [
    process.env.SUPABASE_JWT_SECRET,
    process.env.JWT_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    'hihubble-secure-jwt-secret',
    'hi_hubble_super_secure_jwt_secret_key_2026_spec'
  ].filter(Boolean);

  if (token.includes('.')) {
    for (const secret of possibleSecrets) {
      try {
        const decoded = jwt.verify(token, secret);
        if (decoded && (decoded.id || decoded.sub)) {
          return decoded.id || decoded.sub;
        }
      } catch (_) {}
    }
  }
  return token.length > 10 ? token : null;
}

// 2. GET /api/reels - Get all user-posted reels from DB
router.get('/api/reels', async (req, res) => {
  console.log('[REELS GET] request received');
  try {
    const currentUserId = getUserIdFromToken(req);
    console.log('[REELS GET] authenticated user:', currentUserId || 'guest');
    console.log('[REELS GET] database query starting');

    const { data: reelsData, error } = await supabase.from('reels')
      .select('*, author:profiles(id, full_name, username, profile_image_url), reel_likes(user_id), reel_comments(id), saved_reels(user_id)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[REELS GET] database error:', error.message);
      throw error;
    }

    console.log('[REELS GET] database row count:', reelsData ? reelsData.length : 0);
    console.log('[REELS GET] raw rows count:', reelsData ? reelsData.length : 0);

    const reels = (reelsData || []).map(r => mapReelToFrontend(r, currentUserId));
    console.log('[REELS GET] mapped rows count:', reels.length);
    console.log('[REELS GET] final response count:', reels.length);

    res.json(reels);
  } catch (err) {
    console.error("[REELS GET] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. POST /api/reels/:id/like - Toggle reel like in DB
router.post('/api/reels/:id/like', authenticateToken, async (req, res) => {
  const reelId = req.params.id;
  const userId = req.user.id;

  console.log(`[REEL LIKE DEBUG] Processing like request for reelId: ${reelId}, userId: ${userId}`);

  try {
    const { data: reel, error: reelError } = await supabase
      .from('reels')
      .select('id, author_id, like_count')
      .eq('id', reelId)
      .single();

    if (reelError || !reel) {
      console.log(`[REEL LIKE DEBUG] Reel not found: ${reelId}`);
      return res.status(404).json({ error: 'Reel not found.' });
    }

    // Check existing like in public.reel_likes
    const { data: existingLike } = await supabase
      .from('reel_likes')
      .select('id')
      .eq('reel_id', reelId)
      .eq('user_id', userId)
      .maybeSingle();

    const isLiked = !existingLike;
    console.log(`[REEL LIKE DEBUG] Existing like: ${!!existingLike} -> Action: ${isLiked ? 'LIKE' : 'UNLIKE'}`);

    if (isLiked) {
      const { error: insertErr } = await supabase
        .from('reel_likes')
        .insert([{ reel_id: reelId, user_id: userId }]);

      if (insertErr) {
        console.error('[REEL LIKE DEBUG] Insert reel_likes error:', insertErr.message);
        return res.status(500).json({ error: insertErr.message });
      }

      // Notify reel author if not self
      if (reel.author_id && reel.author_id !== userId) {
        try {
          await supabase.from('notifications').insert([{
            user_id: reel.author_id,
            recipient_id: reel.author_id,
            sender_id: userId,
            type: 'like_reel',
            message: 'liked your reel',
            is_read: false
          }]);
        } catch (notifErr) {
          console.warn('[REEL LIKE DEBUG] Notification notice:', notifErr.message);
        }
      }
    } else {
      const { error: deleteErr } = await supabase
        .from('reel_likes')
        .delete()
        .eq('reel_id', reelId)
        .eq('user_id', userId);

      if (deleteErr) {
        console.error('[REEL LIKE DEBUG] Delete reel_likes error:', deleteErr.message);
        return res.status(500).json({ error: deleteErr.message });
      }
    }

    // Get exact new count from public.reel_likes
    const { count: likesCount } = await supabase
      .from('reel_likes')
      .select('*', { count: 'exact', head: true })
      .eq('reel_id', reelId);

    const newCount = likesCount || 0;
    await supabase.from('reels').update({ like_count: newCount }).eq('id', reelId);

    console.log(`[REEL LIKE DEBUG] Final DB like_count: ${newCount}, isLiked: ${isLiked}`);

    res.status(200).json({
      likesCount: newCount,
      formattedLikes: formatCount(newCount),
      isLiked
    });
  } catch (err) {
    console.error('[REEL LIKE DEBUG] Unexpected error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 4. GET /api/reels/:id/comments - Fetch reel comments
router.get('/api/reels/:id/comments', async (req, res) => {
  const reelId = req.params.id;
  try {
    const { data: comments, error } = await supabase.from('reel_comments')
      .select('*, author:profiles(id, full_name, username, profile_image_url)')
      .eq('reel_id', reelId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const formatted = (comments || []).map(c => ({
      _id: c.id,
      id: c.id,
      reelId: c.reel_id,
      content: c.content,
      createdAt: c.created_at,
      author: c.author ? {
        _id: c.author.id,
        fullName: c.author.full_name || c.author.username || 'Hubble User',
        username: c.author.username || 'hubble_user',
        profileImage: c.author.profile_image_url || ''
      } : { fullName: 'Hubble User', username: 'hubble_user', profileImage: '' }
    }));

    res.json(formatted);
  } catch (err) {
    console.error("GET /api/reels/:id/comments error:", err.message);
    res.status(500).json({ error: 'Unable to load comments.' });
  }
});

// 5. POST /api/reels/:id/comments - Post comment to reel
router.post('/api/reels/:id/comments', authenticateToken, async (req, res) => {
  const reelId = req.params.id;
  const userId = req.user.id;
  const { content, text } = req.body;
  const commentText = (content || text || '').trim();

  if (!commentText) {
    return res.status(400).json({ error: 'Comment text is required.' });
  }

  try {
    const { data: reel, error: reelErr } = await supabase
      .from('reels')
      .select('id, author_id, comment_count')
      .eq('id', reelId)
      .single();

    if (reelErr || !reel) {
      return res.status(404).json({ error: 'Reel not found.' });
    }

    // Insert comment row into public.reel_comments
    const { data: newComment, error: insertErr } = await supabase
      .from('reel_comments')
      .insert([{
        reel_id: reelId,
        author_id: userId,
        content: commentText
      }])
      .select('*, author:profiles(id, full_name, username, profile_image_url)')
      .single();

    if (insertErr) {
      console.error('[REEL COMMENT DEBUG] Insert reel_comments error:', insertErr.message);
      return res.status(500).json({ error: insertErr.message });
    }

    // Get exact new comment count from public.reel_comments
    const { count: commentsCount } = await supabase
      .from('reel_comments')
      .select('*', { count: 'exact', head: true })
      .eq('reel_id', reelId)
      .is('deleted_at', null);

    const newCount = commentsCount || 0;
    await supabase.from('reels').update({ comment_count: newCount }).eq('id', reelId);

    // Notify reel author if not self
    if (reel.author_id && reel.author_id !== userId) {
      try {
        await supabase.from('notifications').insert([{
          user_id: reel.author_id,
          recipient_id: reel.author_id,
          sender_id: userId,
          type: 'comment_reel',
          message: 'commented on your reel',
          is_read: false
        }]);
      } catch (notifErr) {
        console.warn('[REEL COMMENT DEBUG] Notification notice:', notifErr.message);
      }
    }

    const mapped = {
      _id: newComment.id,
      id: newComment.id,
      reelId: newComment.reel_id,
      content: newComment.content,
      createdAt: newComment.created_at,
      commentCount: newCount,
      formattedComments: formatCount(newCount),
      author: newComment.author ? {
        _id: newComment.author.id,
        fullName: newComment.author.full_name || newComment.author.username || 'Hubble User',
        username: newComment.author.username || 'hubble_user',
        profileImage: newComment.author.profile_image_url || ''
      } : {
        fullName: req.user?.full_name || req.user?.username || 'Hubble User',
        username: req.user?.username || 'hubble_user',
        profileImage: ''
      }
    };

    res.status(201).json(mapped);
  } catch (err) {
    console.error("[REEL COMMENT DEBUG] Error posting comment:", err.message);
    res.status(500).json({ error: 'Unable to post comment. Please try again.' });
  }
});

// 6. POST /api/reels/:id/share - Increment share count for reel
router.post('/api/reels/:id/share', async (req, res) => {
  const reelId = req.params.id;
  try {
    const { data: reel, error: reelErr } = await supabase.from('reels').select('share_count').eq('id', reelId).single();
    if (reelErr || !reel) return res.status(404).json({ error: 'Reel not found.' });

    const newShareCount = (reel.share_count || 0) + 1;
    await supabase.from('reels').update({ share_count: newShareCount }).eq('id', reelId);

    res.json({
      shareCount: newShareCount,
      formattedShares: formatCount(newShareCount)
    });
  } catch (err) {
    console.error("POST /api/reels/:id/share error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 7. POST /api/reels/:id/save - Toggle bookmark/save for reel
router.post('/api/reels/:id/save', authenticateToken, async (req, res) => {
  const reelId = req.params.id;
  const userId = req.user.id;

  try {
    const { data: existingSave } = await supabase.from('saved_reels')
      .select('id')
      .eq('reel_id', reelId)
      .eq('user_id', userId)
      .maybeSingle();

    const isSaved = !existingSave;

    if (isSaved) {
      await supabase.from('saved_reels').insert([{ reel_id: reelId, user_id: userId }]);
    } else {
      await supabase.from('saved_reels').delete().eq('reel_id', reelId).eq('user_id', userId);
    }

    res.json({ isSaved });
  } catch (err) {
    console.error("POST /api/reels/:id/save error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 8. DELETE /api/reels/:id - Delete a reel if author
router.delete('/api/reels/:id', authenticateToken, async (req, res) => {
  const reelId = req.params.id;
  const userId = req.user.id;

  try {
    const { data: reel, error } = await supabase.from('reels').select('author_id').eq('id', reelId).single();
    if (error || !reel) return res.status(404).json({ error: 'Reel not found.' });

    if (reel.author_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this reel.' });
    }

    await supabase.from('reels').delete().eq('id', reelId);
    res.json({ message: 'Reel deleted successfully.' });
  } catch (err) {
    console.error("DELETE /api/reels/:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
