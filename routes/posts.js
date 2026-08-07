import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

// HELPER: Map Supabase Postgres schema to Frontend schema
function mapPostToFrontend(post, media, author, comments, likes) {
  const authorObj = author ? {
    _id: author.id,
    fullName: author.full_name || author.username,
    username: author.username,
    profileImage: author.profile_image_url || ''
  } : {
    _id: post.author_id || 'usr_unknown',
    fullName: 'User',
    username: 'user',
    profileImage: ''
  };

  return {
    _id: post.id,
    author: authorObj,
    caption: post.caption || '',
    mediaUrl: media && media.length > 0 ? media[0].media_url : '',
    mediaType: media && media.length > 0 ? media[0].media_type : 'image',
    location: post.location || '',
    createdAt: post.created_at,
    likes: likes || [],
    comments: comments || []
  };
}

// Helper to map DB comment object to frontend format
function mapCommentToFrontend(c, userLikes = new Set()) {
  const cAuthor = c.author_profile || {
    id: c.author_id,
    full_name: 'User',
    username: 'user',
    profile_image_url: ''
  };

  return {
    _id: c.id,
    text: c.content,
    createdAt: c.created_at,
    postId: c.post_id,
    parentCommentId: c.parent_comment_id || null,
    likeCount: c.like_count || 0,
    replyCount: c.reply_count || 0,
    isLiked: userLikes.has(c.id),
    author: {
      _id: cAuthor.id,
      fullName: cAuthor.full_name || cAuthor.username,
      username: cAuthor.username,
      profileImage: cAuthor.profile_image_url || ''
    }
  };
}

// ------------------------------------------------------------------------------
// 1. CREATE NEW POST
// ------------------------------------------------------------------------------
router.post('/api/posts', authenticateToken, async (req, res) => {
  const { mediaUrl, mediaType, caption } = req.body;
  if (!mediaUrl && !caption) {
    return res.status(400).json({ error: 'Media URL or caption is required.' });
  }

  const userId = req.user.id;

  try {
    // 1. Get profile
    const { data: dbProfile, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, username, email, profile_image_url')
      .eq('id', userId)
      .single();

    if (profErr || !dbProfile) {
      return res.status(400).json({ error: 'Author profile not found.' });
    }

    // 2. Insert Post
    const { data: newPost, error: postErr } = await supabase
      .from('posts')
      .insert([{
        author_id: userId,
        caption: caption || ''
      }])
      .select('id, author_id, caption, created_at')
      .single();

    if (postErr) {
      console.error("Supabase post insert error:", postErr);
      return res.status(500).json({ error: postErr.message || 'Database error creating post.' });
    }

    // 3. Upload / Insert Post Media if provided
    let newMediaArr = [];
    if (mediaUrl) {
      let finalMediaUrl = mediaUrl;

      if (typeof mediaUrl === 'string' && mediaUrl.startsWith('data:')) {
        try {
          const matches = mediaUrl.match(/^data:([a-zA-Z0-9\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const mimeType = matches[1];
            const isVideo = mimeType.startsWith('video');
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');
            const ext = mimeType.split('/')[1] || (isVideo ? 'mp4' : 'png');
            const bucketName = isVideo ? 'post-videos' : 'post-images';
            const filename = `${userId}/post_${Date.now()}.${ext}`;

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
          console.warn("Storage upload exception:", uploadExc.message);
        }
      }

      const { data: mediaData, error: mediaErr } = await supabase
        .from('post_media')
        .insert([{
          post_id: newPost.id,
          media_url: finalMediaUrl,
          media_type: mediaType || (mediaUrl.includes('video') || mediaUrl.includes('.mp4') || mediaUrl.includes('.webm') ? 'video' : 'image'),
          display_order: 1
        }])
        .select();

      if (mediaErr) console.warn("Media insert warning:", mediaErr.message);
      newMediaArr = mediaData || [];
    }

    // Update user post count if column exists
    try {
      const { count: currentPostCount } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId);
      if (currentPostCount) {
        await supabase.from('profiles').update({ post_count: currentPostCount }).eq('id', userId).catch(() => {});
      }
    } catch (_) {}

    const mappedPost = mapPostToFrontend(newPost, newMediaArr, dbProfile, [], []);
    res.status(201).json(mappedPost);
  } catch (err) {
    console.error("POST /api/posts error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------------------
// 2. GET FEED POSTS
// ------------------------------------------------------------------------------
router.get('/api/posts', async (req, res) => {
  const { userId, authorId } = req.query;
  const targetAuthor = authorId || userId;

  try {
    let query = supabase
      .from('posts')
      .select(`
        *,
        author_profile:profiles!author_id(id, full_name, username, profile_image_url),
        media:post_media(media_url, media_type)
      `)
      .order('created_at', { ascending: false });

    if (targetAuthor) {
      if (targetAuthor.includes('-')) {
        query = query.eq('author_id', targetAuthor);
      } else {
        const { data: prof } = await supabase.from('profiles').select('id').eq('username', targetAuthor).maybeSingle();
        if (prof) {
          query = query.eq('author_id', prof.id);
        }
      }
    }

    const { data: postsData, error } = await query;

    if (error) {
      console.warn("GET /api/posts error:", error.message);
      return res.json([]);
    }

    const posts = [];
    if (postsData) {
      for (const p of postsData) {
        const authorObj = p.author_profile || {
          id: p.author_id,
          username: 'user',
          full_name: 'User',
          profile_image_url: ''
        };

        if (authorObj.username === 'hubble_user' || p.author_id === '00000000-0000-0000-0000-000000000001') {
          continue;
        }

        // Fetch comments for post
        const { data: commentsData } = await supabase
          .from('comments')
          .select('*, author_profile:profiles!author_id(id, full_name, username, profile_image_url)')
          .eq('post_id', p.id)
          .order('created_at', { ascending: true });

        const mappedComments = (commentsData || []).map(c => mapCommentToFrontend(c));

        // Fetch post likes
        const { data: likesData } = await supabase
          .from('likes')
          .select('user_id')
          .eq('post_id', p.id);

        const mappedLikes = (likesData || []).map(l => l.user_id);

        posts.push(mapPostToFrontend(p, p.media || [], authorObj, mappedComments, mappedLikes));
      }
    }

    res.json(posts);
  } catch (err) {
    console.error("GET /api/posts error:", err);
    res.json([]);
  }
});

// ------------------------------------------------------------------------------
// 3. GET COMMENTS FOR A POST
// ------------------------------------------------------------------------------
router.get('/api/posts/:id/comments', async (req, res) => {
  const postId = req.params.id;
  try {
    const { data: commentsData, error } = await supabase
      .from('comments')
      .select('*, author_profile:profiles!author_id(id, full_name, username, profile_image_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const mappedComments = (commentsData || []).map(c => mapCommentToFrontend(c));
    res.json(mappedComments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------------------
// 4. CREATE COMMENT ON A POST
// ------------------------------------------------------------------------------
router.post('/api/posts/:id/comment', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const { text, parentCommentId } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comment text cannot be empty.' });
  }

  if (text.trim().length > 1000) {
    return res.status(400).json({ error: 'Comment length cannot exceed 1000 characters.' });
  }

  const userId = req.user.id;

  try {
    // 1. Verify Post Exists
    const { data: targetPost, error: postErr } = await supabase
      .from('posts')
      .select('id, author_id')
      .eq('id', postId)
      .maybeSingle();

    if (postErr || !targetPost) {
      return res.status(404).json({ error: 'Target post does not exist or has been deleted.' });
    }

    // 2. Insert Comment into public.comments
    const insertPayload = {
      post_id: targetPost.id,
      author_id: userId,
      content: text.trim()
    };

    if (parentCommentId) {
      insertPayload.parent_comment_id = parentCommentId;
    }

    const { data: insertedComment, error: commentErr } = await supabase
      .from('comments')
      .insert([insertPayload])
      .select('*, author_profile:profiles!author_id(id, full_name, username, profile_image_url)')
      .single();

    if (commentErr) {
      console.error("Comment DB insert error:", commentErr);
      return res.status(500).json({ error: `Database insert failed: ${commentErr.message}` });
    }

    // 3. Update comment_count in public.posts
    try {
      const { count: totalComments } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', targetPost.id);

      await supabase.from('posts').update({ comment_count: totalComments || 1 }).eq('id', targetPost.id);
    } catch (_) {}

    // 4. Update reply_count on parent comment if replying
    if (parentCommentId) {
      try {
        const { count: replyCount } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('parent_comment_id', parentCommentId);

        await supabase.from('comments').update({ reply_count: replyCount || 1 }).eq('id', parentCommentId);
      } catch (_) {}
    }

    // 5. Send Notification to post author or parent comment author
    const notificationRecipient = parentCommentId ? null : targetPost.author_id;
    if (notificationRecipient && notificationRecipient !== userId) {
      try {
        await supabase.from('notifications').insert([{
          recipient_id: notificationRecipient,
          sender_id: userId,
          type: 'comment',
          target_type: 'post',
          post_id: targetPost.id
        }]);
      } catch (_) {}
    }

    // Return the newly created comment object + updated post comments list
    const { data: allPostComments } = await supabase
      .from('comments')
      .select('*, author_profile:profiles!author_id(id, full_name, username, profile_image_url)')
      .eq('post_id', targetPost.id)
      .order('created_at', { ascending: true });

    const mappedCommentsList = (allPostComments || []).map(c => mapCommentToFrontend(c));
    const newlyCreatedComment = mapCommentToFrontend(insertedComment);

    return res.status(201).json({
      comment: newlyCreatedComment,
      comments: mappedCommentsList
    });
  } catch (err) {
    console.error("Comment handler error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------------------
// 5. CREATE COMMENT REPLY
// ------------------------------------------------------------------------------
router.post('/api/comments/:id/reply', authenticateToken, async (req, res) => {
  const parentCommentId = req.params.id;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Reply text cannot be empty.' });
  }

  const userId = req.user.id;

  try {
    // 1. Fetch parent comment
    const { data: parentComment, error: parentErr } = await supabase
      .from('comments')
      .select('id, post_id, author_id')
      .eq('id', parentCommentId)
      .maybeSingle();

    if (parentErr || !parentComment) {
      return res.status(404).json({ error: 'Parent comment not found.' });
    }

    // 2. Insert reply
    const { data: insertedReply, error: replyErr } = await supabase
      .from('comments')
      .insert([{
        post_id: parentComment.post_id,
        parent_comment_id: parentComment.id,
        author_id: userId,
        content: text.trim()
      }])
      .select('*, author_profile:profiles!author_id(id, full_name, username, profile_image_url)')
      .single();

    if (replyErr) {
      return res.status(500).json({ error: replyErr.message });
    }

    // 3. Update reply_count on parent comment & comment_count on post
    try {
      const { count: replyCount } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('parent_comment_id', parentComment.id);
      await supabase.from('comments').update({ reply_count: replyCount || 1 }).eq('id', parentComment.id);

      const { count: totalPostComments } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', parentComment.post_id);
      await supabase.from('posts').update({ comment_count: totalPostComments || 1 }).eq('id', parentComment.post_id);
    } catch (_) {}

    // 4. Send Notification to parent comment author
    if (parentComment.author_id && parentComment.author_id !== userId) {
      try {
        await supabase.from('notifications').insert([{
          recipient_id: parentComment.author_id,
          sender_id: userId,
          type: 'reply',
          target_type: 'comment',
          post_id: parentComment.post_id,
          comment_id: parentComment.id
        }]);
      } catch (_) {}
    }

    return res.status(201).json(mapCommentToFrontend(insertedReply));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------------------
// 6. TOGGLE POST LIKE
// ------------------------------------------------------------------------------
router.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  try {
    // 1. Resolve Post ID
    const { data: postData, error: postErr } = await supabase
      .from('posts')
      .select('id, author_id')
      .eq('id', postId)
      .maybeSingle();

    if (postErr || !postData) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const targetPostId = postData.id;
    const postAuthorId = postData.author_id;

    // 2. Check existing like in public.likes
    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', targetPostId)
      .eq('user_id', userId)
      .maybeSingle();

    const isLiked = !existingLike;

    if (isLiked) {
      await supabase.from('likes').insert([{ post_id: targetPostId, user_id: userId, target_type: 'post' }]);

      // Notification
      if (postAuthorId && postAuthorId !== userId) {
        try {
          await supabase.from('notifications').insert([{
            recipient_id: postAuthorId,
            sender_id: userId,
            type: 'like',
            target_type: 'post',
            post_id: targetPostId
          }]);
        } catch (_) {}
      }
    } else {
      await supabase.from('likes').delete().eq('post_id', targetPostId).eq('user_id', userId);
    }

    // 3. Update like count in public.posts
    const { count: likesCount } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', targetPostId);

    await supabase.from('posts').update({ like_count: likesCount || 0 }).eq('id', targetPostId);

    return res.json({ success: true, likesCount: likesCount || 0, isLiked });
  } catch (err) {
    console.error("Like error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------------------
// 7. TOGGLE COMMENT LIKE
// ------------------------------------------------------------------------------
router.post('/api/comments/:id/like', authenticateToken, async (req, res) => {
  const commentId = req.params.id;
  const userId = req.user.id;

  try {
    const { data: commentData, error: cErr } = await supabase
      .from('comments')
      .select('id, author_id, post_id')
      .eq('id', commentId)
      .maybeSingle();

    if (cErr || !commentData) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    // Check existing like
    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .maybeSingle();

    const isLiked = !existingLike;

    if (isLiked) {
      await supabase.from('likes').insert([{ comment_id: commentId, user_id: userId, target_type: 'comment' }]);

      if (commentData.author_id && commentData.author_id !== userId) {
        try {
          await supabase.from('notifications').insert([{
            recipient_id: commentData.author_id,
            sender_id: userId,
            type: 'comment_like',
            target_type: 'comment',
            post_id: commentData.post_id,
            comment_id: commentId
          }]);
        } catch (_) {}
      }
    } else {
      await supabase.from('likes').delete().eq('comment_id', commentId).eq('user_id', userId);
    }

    // Recalculate comment like count
    const { count: likesCount } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('comment_id', commentId);

    await supabase.from('comments').update({ like_count: likesCount || 0 }).eq('id', commentId);

    return res.json({ success: true, likesCount: likesCount || 0, isLiked });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------------------
// 8. DELETE COMMENT
// ------------------------------------------------------------------------------
router.delete('/api/comments/:id', authenticateToken, async (req, res) => {
  const commentId = req.params.id;
  const userId = req.user.id;

  try {
    const { data: commentData } = await supabase
      .from('comments')
      .select('id, author_id, post_id')
      .eq('id', commentId)
      .maybeSingle();

    if (!commentData) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    if (commentData.author_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own comments.' });
    }

    await supabase.from('comments').delete().eq('id', commentId);

    // Update post comment count
    const { count: totalComments } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', commentData.post_id);

    await supabase.from('posts').update({ comment_count: totalComments || 0 }).eq('id', commentData.post_id);

    return res.json({ success: true, message: 'Comment deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
