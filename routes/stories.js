import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

// Helper to map DB story object to frontend format
function mapStoryToFrontend(story) {
  if (!story) return null;
  const author = story.author;
  const mappedAuthor = author ? {
    _id: author.id,
    fullName: author.full_name || author.username,
    username: author.username,
    profileImage: author.profile_image_url || ''
  } : null;

  return {
    _id: story.id,
    author: mappedAuthor,
    mediaUrl: story.media_url,
    mediaType: story.media_type,
    caption: story.caption || '',
    linkUrl: story.link_url || '',
    viewCount: story.view_count || 0,
    expiresAt: story.expires_at,
    createdAt: story.created_at,
    isScheduled: story.isScheduled || false,
    scheduledAt: story.scheduledAt || null,
    status: story.status || 'published'
  };
}

router.post('/api/stories', authenticateToken, async (req, res) => {
  const { mediaUrl, mediaType, isDraft } = req.body;
  if (!mediaUrl) return res.status(400).json({ error: 'Media URL is required.' });

  try {
    const finalMediaType = isDraft ? `draft-${mediaType || 'image'}` : (mediaType || 'image');
    
    const { data: newStory, error } = await supabase.from('stories').insert([{
      author_id: req.user.id,
      media_url: mediaUrl,
      media_type: finalMediaType
    }]).select('*, author:profiles(id, full_name, username, profile_image_url)').single();
    if (error) throw error;

    res.status(201).json({ ...mapStoryToFrontend(newStory), likes: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/stories/schedule', authenticateToken, async (req, res) => {
  const { mediaUrl, mediaType, scheduledAt } = req.body;
  if (!mediaUrl) return res.status(400).json({ error: 'Media URL is required.' });
  if (!scheduledAt) return res.status(400).json({ error: 'Scheduled time is required.' });

  try {
    const finalMediaType = mediaType || 'image';
    
    const { data: newStory, error } = await supabase.from('stories').insert([{
      author_id: req.user.id,
      media_url: mediaUrl,
      media_type: finalMediaType,
      isScheduled: true,
      scheduledAt: new Date(scheduledAt).toISOString(),
      status: 'scheduled'
    }]).select('*, author:profiles(id, full_name, username, profile_image_url)').single();
    if (error) throw error;

    res.status(201).json({ ...mapStoryToFrontend(newStory), likes: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/stories', authenticateToken, async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: storiesData, error } = await supabase.from('stories')
      .select('*, author:profiles(id, full_name, username, profile_image_url)')
      .gt('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const stories = [];
    if (storiesData) {
      for (const s of storiesData) {
        if (s.media_type && s.media_type.startsWith('draft-')) continue;
        if (s.status === 'scheduled') continue;
        
        const { data: likes } = await supabase.from('likes')
          .select('user_id')
          .eq('target_type', 'story')
          .eq('story_id', s.id);
          
        stories.push({ ...mapStoryToFrontend(s), likes: likes ? likes.map(l => l.user_id) : [] });
      }
    }

    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/stories/drafts', authenticateToken, async (req, res) => {
  try {
    const { data: drafts, error } = await supabase.from('stories')
      .select('*, author:profiles(id, full_name, username, profile_image_url)')
      .like('media_type', 'draft-%')
      .eq('author_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.json((drafts || []).map(mapStoryToFrontend));
  } catch (err) {
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
      .select('*, author:profiles(id, full_name, username, profile_image_url)')
      .single();
      
    if (updateError) throw updateError;
    res.json(mapStoryToFrontend(updatedStory));
  } catch (err) {
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
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/stories/:id/like', authenticateToken, async (req, res) => {
  const storyId = req.params.id;
  const userId = req.user.id;

  try {
    const { data: story, error: storyError } = await supabase.from('stories').select('author_id').eq('id', storyId).single();
    if (storyError || !story) return res.status(404).json({ error: 'Story not found.' });

    const { data: existingLike } = await supabase.from('likes')
      .select('id')
      .eq('target_type', 'story')
      .eq('story_id', storyId)
      .eq('user_id', userId)
      .maybeSingle();
    const isLiked = !existingLike;

    if (isLiked) {
      await supabase.from('likes').insert([{ target_type: 'story', story_id: storyId, user_id: userId }]);
      if (story.author_id !== userId) {
        try {
          await supabase.from('notifications').insert([{
            user_id: story.author_id,
            recipient_id: story.author_id,
            sender_id: userId,
            type: 'like_story',
            message: `someone liked your story`,
            is_read: false
          }]);
        } catch (notifErr) {
          console.error("Failed to create story like notification:", notifErr);
        }
      }
    } else {
      await supabase.from('likes').delete().eq('target_type', 'story').eq('story_id', storyId).eq('user_id', userId);
    }

    const { count: likesCount } = await supabase.from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', 'story')
      .eq('story_id', storyId);
      
    res.json({ likesCount: likesCount || 0, isLiked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
