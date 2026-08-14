import express from 'express';
import fs from 'fs';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

// Helper to map DB story object to frontend format
function mapStoryToFrontend(s, likes = [], reqUserId = null) {
  if (!s) return null;
  const author = s.author || {};
  const createdAtIso = s.created_at || new Date().toISOString();
  const likeUserIds = Array.isArray(likes) ? likes : [];
  const isLiked = reqUserId ? likeUserIds.some(uid => uid && uid.toString() === reqUserId.toString()) : false;
  return {
    _id: s.id,
    id: s.id,
    author: {
      _id: author.id || s.author_id,
      id: author.id || s.author_id,
      fullName: author.full_name || author.username || 'User',
      username: author.username || 'user',
      profileImage: author.profile_image_url || ''
    },
    mediaUrl: s.media_url,
    mediaType: s.media_type || 'image',
    caption: s.caption || '',
    createdAt: createdAtIso,
    created_at: createdAtIso,
    updatedAt: s.updated_at || createdAtIso,
    updated_at: s.updated_at || createdAtIso,
    isScheduled: s.isScheduled || false,
    scheduledAt: s.scheduledAt || null,
    status: s.status || 'published',
    likes: likeUserIds,
    likesCount: likeUserIds.length,
    isLiked: isLiked
  };
}

// Helper to upload media item (base64 or URL) to permanent Supabase Storage
async function uploadMediaItem(userId, mediaUrl, mediaType) {
  if (!mediaUrl) return { url: '', type: 'image' };
  let finalMediaUrl = mediaUrl;
  let finalType = mediaType || 'image';

  if (typeof mediaUrl === 'string' && mediaUrl.startsWith('data:')) {
    try {
      const matches = mediaUrl.match(/^data:([a-zA-Z0-9\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const isVideo = mimeType.startsWith('video');
        finalType = isVideo ? 'video' : 'image';
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const ext = mimeType.split('/')[1] || (isVideo ? 'mp4' : 'png');
        const bucketName = isVideo ? 'post-videos' : 'post-images';
        const filename = `${userId}/story_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from(bucketName)
          .upload(filename, buffer, { contentType: mimeType, upsert: true });

        if (!uploadErr) {
          const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filename);
          if (publicUrlData?.publicUrl) {
            finalMediaUrl = publicUrlData.publicUrl;
          }
        }
      }
    } catch (uploadExc) {
      console.warn("Story storage upload notice:", uploadExc.message);
    }
  }

  return { url: finalMediaUrl, type: finalType };
}

router.post('/api/stories', authenticateToken, async (req, res) => {
  const { mediaUrl: rawMediaUrl, mediaType: rawMediaType, isDraft, caption } = req.body;
  if (!rawMediaUrl) return res.status(400).json({ error: 'Media URL is required.' });

  try {
    const userId = req.user.id;
    const { url: mediaUrl, type: mediaType } = await uploadMediaItem(userId, rawMediaUrl, rawMediaType);
    const finalMediaType = isDraft ? `draft-${mediaType || 'image'}` : (mediaType || 'image');
    const nowIso = new Date().toISOString();
    
    const { data: newStory, error } = await supabase.from('stories').insert([{
      author_id: userId,
      media_url: mediaUrl,
      media_type: finalMediaType,
      caption: caption || '',
      status: 'published',
      created_at: nowIso
    }]).select('*, author:profiles!author_id(id, full_name, username, profile_image_url)').single();
    
    if (error) throw error;

    console.log(`[BACKEND POST /api/stories SUCCESS] StoryId: ${newStory.id} | created_at: ${newStory.created_at}`);
    res.status(201).json(mapStoryToFrontend(newStory, []));
  } catch (err) {
    console.error('Error creating story:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/stories/schedule', authenticateToken, async (req, res) => {
  const { mediaUrl: rawMediaUrl, mediaType: rawMediaType, scheduledAt, caption } = req.body;
  if (!rawMediaUrl) return res.status(400).json({ error: 'Media URL is required.' });
  if (!scheduledAt) return res.status(400).json({ error: 'Scheduled time is required.' });

  try {
    const userId = req.user.id;
    let scheduledStories = [];
    try {
      if (fs.existsSync('scheduled_stories.json')) {
        scheduledStories = JSON.parse(fs.readFileSync('scheduled_stories.json', 'utf8'));
      }
    } catch (e) {
      console.warn('Read scheduled_stories.json warning:', e.message);
    }

    const newScheduledStory = {
      id: Math.random().toString(36).substring(2, 9),
      userId,
      mediaUrl: rawMediaUrl,
      mediaType: rawMediaType || 'image',
      caption: caption || '',
      scheduledAt: new Date(scheduledAt).toISOString()
    };

    scheduledStories.push(newScheduledStory);
    fs.writeFileSync('scheduled_stories.json', JSON.stringify(scheduledStories, null, 2), 'utf8');

    res.status(201).json({
      id: newScheduledStory.id,
      media_url: rawMediaUrl,
      media_type: rawMediaType || 'image',
      caption: caption || '',
      scheduled: true,
      scheduledAt: newScheduledStory.scheduledAt
    });
  } catch (err) {
    console.error('Error scheduling story:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/stories', authenticateToken, async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: storiesData, error } = await supabase.from('stories')
      .select('*, author:profiles!author_id(id, full_name, username, profile_image_url)')
      .gt('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });
      
    if (error) throw error;

    const stories = [];
    if (storiesData) {
      for (const s of storiesData) {
        if (s.media_type && s.media_type.startsWith('draft-')) continue;
        if (s.status === 'scheduled') continue;
        const { data: likes } = await supabase.from('story_reactions').select('user_id').eq('story_id', s.id);
        const likeUserIds = likes ? likes.map(l => l.user_id) : [];
        const isLikedByMe = req.user ? likeUserIds.some(uid => uid && uid.toString() === req.user.id.toString()) : false;
        
        const storyObj = mapStoryToFrontend(s, likeUserIds, req.user?.id);
        storyObj.likesCount = likeUserIds.length;
        storyObj.isLiked = isLikedByMe;
        stories.push(storyObj);

        console.log(`[BACKEND GET /api/stories] Story: ${s.id} | likesCount: ${storyObj.likesCount} | isLiked: ${storyObj.isLiked} | reqUser: ${req.user?.id}`);
      }
    }

    res.json(stories);
  } catch (err) {
    console.error('Error getting stories:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/stories/drafts', authenticateToken, async (req, res) => {
  try {
    const { data: drafts, error } = await supabase.from('stories')
      .select('*, author:profiles!author_id(id, full_name, username, profile_image_url)')
      .like('media_type', 'draft-%')
      .eq('author_id', req.user.id)
      .order('created_at', { ascending: false });
      
    if (error) throw error;

    res.json((drafts || []).map(d => mapStoryToFrontend(d, [])));
  } catch (err) {
    console.error('Error getting drafts:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/stories/:id/publish', authenticateToken, async (req, res) => {
  const storyId = req.params.id;
  try {
    const { data: story, error: fetchError } = await supabase.from('stories').select('author_id, media_type').eq('id', storyId).single();
    if (fetchError || !story) return res.status(404).json({ error: 'Story not found.' });
    if (story.author_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized.' });

    const newMediaType = story.media_type ? story.media_type.replace('draft-', '') : 'image';
    const { data: updatedStory, error: updateError } = await supabase.from('stories')
      .update({ media_type: newMediaType, created_at: new Date().toISOString() })
      .eq('id', storyId)
      .select('*, author:profiles!author_id(id, full_name, username, profile_image_url)')
      .single();
      
    if (updateError) throw updateError;
    res.json(mapStoryToFrontend(updatedStory, []));
  } catch (err) {
    console.error('Error publishing draft story:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/stories/:id', authenticateToken, async (req, res) => {
  const storyId = req.params.id;
  try {
    const { data: story, error: fetchError } = await supabase.from('stories').select('author_id').eq('id', storyId).single();
    if (fetchError || !story) return res.status(404).json({ error: 'Story not found.' });
    if (story.author_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized.' });

    const { error: deleteError } = await supabase.from('stories').delete().eq('id', storyId);
    if (deleteError) throw deleteError;
    
    res.json({ message: 'Story deleted successfully.' });
  } catch (err) {
    console.error('Error deleting story:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/stories/:id/like', authenticateToken, async (req, res) => {
  const storyId = req.params.id;
  const userId = req.user.id;

  try {
    const { data: story, error: storyError } = await supabase.from('stories').select('author_id').eq('id', storyId).single();
    if (storyError || !story) return res.status(404).json({ error: 'Story not found.' });

    const { data: existingLike } = await supabase.from('story_reactions').select('id, user_id').eq('story_id', storyId).eq('user_id', userId).maybeSingle();
    const isLiked = !existingLike;

    console.log(`[BACKEND POST /like] StoryId: ${storyId} | UserId: ${userId} | Current isLiked: ${!!existingLike} -> Next isLiked: ${isLiked}`);

    if (isLiked) {
      await supabase.from('story_reactions').insert([{ story_id: storyId, user_id: userId, reaction_emoji: '❤️' }]);
      if (story.author_id && story.author_id !== userId) {
        try {
          await supabase.from('notifications').delete().eq('recipient_id', story.author_id).eq('sender_id', userId).eq('type', 'like_story').eq('story_id', storyId);
          await supabase.from('notifications').insert([{
            recipient_id: story.author_id,
            sender_id: userId,
            type: 'like_story',
            story_id: storyId,
            message: 'liked your Hub story'
          }]);
        } catch (notifErr) {
          console.error("Failed to create story like notification:", notifErr);
        }
      }
    } else {
      await supabase.from('story_reactions').delete().eq('story_id', storyId).eq('user_id', userId);
    }

    const { data: updatedLikes } = await supabase.from('story_reactions').select('user_id').eq('story_id', storyId);
    const updatedLikeIds = updatedLikes ? updatedLikes.map(l => l.user_id) : [];
    const likesCount = updatedLikeIds.length;

    console.log(`[BACKEND POST /like SUCCESS] StoryId: ${storyId} | New likesCount: ${likesCount} | isLiked: ${isLiked} | likeUserIds:`, updatedLikeIds);

    res.json({
      likesCount,
      isLiked,
      likes: updatedLikeIds
    });
  } catch (err) {
    console.error('Error liking story:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
