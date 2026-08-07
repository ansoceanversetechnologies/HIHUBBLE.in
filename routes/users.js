import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

router.post('/api/users/profile', authenticateToken, async (req, res) => {
  const { profileImage, bio, fullName, username, phoneNumber } = req.body;
  try {
    const userId = req.user.id;
    let newProfileImageUrl = null;

    // 1. If there is a profile image in base64, upload it to Supabase Storage
    if (profileImage && profileImage.startsWith('data:image')) {
      const matches = profileImage.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `${userId}/avatar-${Date.now()}.${ext}`;

        // Upload using native fetch to bypass Supabase JS client Auth header interference
        const uploadRes = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/profile-images/${filename}`, {
          method: 'POST',
          headers: {
            'apikey': process.env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${req.token}`,
            'Content-Type': `image/${ext}`
          },
          body: buffer
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.message || 'Failed to upload profile image to storage.');
        }

        // The public URL is a deterministic path
        newProfileImageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/profile-images/${filename}`;
      } else if (profileImage.startsWith('http')) {
        // If it's already a URL, just use it
        newProfileImageUrl = profileImage;
      }
    } else if (profileImage && profileImage.startsWith('http')) {
       newProfileImageUrl = profileImage;
    }

    // 2. Prepare updates for the PostgreSQL `profiles` table
    const updates = {};
    if (newProfileImageUrl) updates.profile_image_url = newProfileImageUrl;
    if (bio !== undefined) updates.bio = bio;
    if (fullName !== undefined) updates.full_name = fullName;
    
    // Check username uniqueness if provided
    if (username !== undefined) {
      const trimmedUsername = username.trim().toLowerCase();
      // Check using native fetch or client. We can use native fetch.
      const checkRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?username=eq.${trimmedUsername}&id=neq.${userId}&select=id`, {
        method: 'GET',
        headers: { 'apikey': process.env.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${req.token}` }
      });
      const checkData = await checkRes.json();
      if (checkData && checkData.length > 0) {
        return res.status(400).json({ error: 'Username already taken.' });
      }
      updates.username = trimmedUsername;
    }

    if (phoneNumber !== undefined) {
      let targetNumber = phoneNumber.trim().replace(/\s+/g, '');
      if (targetNumber && !targetNumber.startsWith('+')) {
        if (targetNumber.length === 10) targetNumber = '+91' + targetNumber;
        else return res.status(400).json({ error: "Phone number must include a country code starting with '+' (e.g. +919347712945)" });
      }
      updates.phone_number = targetNumber || null;
    }

    // 3. Update the profile
    const updateRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${req.token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updates)
    });

    if (!updateRes.ok) {
      const errData = await updateRes.json();
      throw new Error(errData.message || 'Failed to update profile in database.');
    }

    const updatedProfiles = await updateRes.json();
    const updatedUser = updatedProfiles[0];

    // Return the updated user mapped to the camelCase fields expected by frontend
    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: updatedUser.id,
        fullName: updatedUser.full_name,
        email: updatedUser.email,
        username: updatedUser.username,
        profileImage: updatedUser.profile_image_url,
        bio: updatedUser.bio,
        phoneNumber: updatedUser.phone_number
      }
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- PRESENCE HEARTBEAT ---
const handlePresenceHeartbeat = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const userId = req.user.id;
  const socketId = req.body.socketId || null;
  const nowIso = new Date().toISOString();

  try {
    const { error } = await supabase
      .from('online_users')
      .upsert({
        user_id: userId,
        socket_id: socketId,
        status: 'online',
        last_seen: nowIso,
        updated_at: nowIso
      }, { onConflict: 'user_id' });

    if (error) throw error;
    res.json({ success: true, status: 'online' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

router.post('/api/users/presence', authenticateToken, handlePresenceHeartbeat);
router.post('/api/presence/heartbeat', authenticateToken, handlePresenceHeartbeat);

router.post('/api/users/logout-presence', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const userId = req.user.id;
  const nowIso = new Date().toISOString();

  try {
    await supabase
      .from('online_users')
      .update({
        status: 'offline',
        last_seen: nowIso,
        updated_at: nowIso
      })
      .eq('user_id', userId);

    res.json({ success: true, status: 'offline' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET ONLINE USERS (ACTIVE HUBBERS) ---
const handleGetOnlineUsers = async (req, res) => {
  if (!req.user) return res.json({ onlineCount: 0, users: [] });
  try {
    const currentUserId = req.user.id;
    // Heartbeat threshold: 90 seconds
    const ninetySecAgo = new Date(Date.now() - 90 * 1000).toISOString();

    // 1. Auto-cleanup stale online records (older than 90 seconds)
    try {
      await supabase
        .from('online_users')
        .update({ status: 'offline' })
        .eq('status', 'online')
        .lt('last_seen', ninetySecAgo);
    } catch (_) {}

    // 2. Fetch active online users
    const { data: onlineRecords, error: onlineErr } = await supabase
      .from('online_users')
      .select(`
        user_id,
        status,
        last_seen,
        profile:profiles!user_id(id, full_name, username, profile_image_url)
      `)
      .eq('status', 'online')
      .gte('last_seen', ninetySecAgo);

    if (onlineErr || !onlineRecords) {
      return res.json({ onlineCount: 0, users: [] });
    }

    const onlineUsers = onlineRecords
      .filter(r => r.profile && r.user_id !== currentUserId && !r.profile.username?.toLowerCase().startsWith('test_runner_'))
      .map(r => ({
        _id: r.profile.id,
        fullName: r.profile.full_name || r.profile.username,
        username: r.profile.username,
        profileImage: r.profile.profile_image_url || '',
        status: r.status,
        lastSeen: r.last_seen
      }));

    res.json({
      onlineCount: onlineUsers.length,
      users: onlineUsers.slice(0, 5)
    });
  } catch (err) {
    res.json({ onlineCount: 0, users: [] });
  }
};

router.get('/api/online-users', authenticateToken, handleGetOnlineUsers);
router.get('/api/users/active', authenticateToken, handleGetOnlineUsers);

// --- SUGGESTED HUBBERS WIDGET ---
router.get('/api/users/suggestions', authenticateToken, async (req, res) => {
  if (!req.user) return res.json([]);
  try {
    const currentUserId = req.user.id;
    const limitVal = parseInt(req.query.limit) || 50;

    // 1. Get IDs of users already followed
    const { data: followedRecords } = await supabase
      .from('followers')
      .select('following_id')
      .eq('follower_id', currentUserId);
    const followedIds = (followedRecords || []).map(f => f.following_id);

    // 2. Get IDs of users with pending follow requests
    const { data: pendingRecords } = await supabase
      .from('follow_requests')
      .select('receiver_id')
      .eq('sender_id', currentUserId)
      .eq('status', 'pending');
    const pendingIds = (pendingRecords || []).map(r => r.receiver_id);

    const excludeIds = new Set([currentUserId, ...followedIds, ...pendingIds]);

    // 3. Query profiles ordered by newly joined (created_at DESC)
    const { data: profilesData, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, profile_image_url, follower_count, following_count, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const filteredSuggestions = (profilesData || [])
      .filter(p => !excludeIds.has(p.id) && !p.username?.toLowerCase().startsWith('test_runner_') && !p.username?.toLowerCase().startsWith('test_'))
      .slice(0, limitVal)
      .map(u => ({
        _id: u.id,
        fullName: u.full_name || u.username,
        username: u.username,
        profileImage: u.profile_image_url || '',
        followersCount: u.follower_count || 0,
        followingCount: u.following_count || 0,
        followStatus: 'none'
      }));

    res.json(filteredSuggestions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- HELPER FOR ROBUST PROFILE LOOKUP (UUID OR USERNAME) ---
async function resolveProfileByIdOrUsername(targetId) {
  if (!targetId) return null;
  const cleanId = String(targetId).trim().replace(/^@/, '');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

  const filterColumn = isUuid ? 'id' : 'username';
  console.log(`[Database Query Executed] SELECT id, username, full_name, profile_image_url FROM profiles WHERE ${filterColumn} = '${cleanId}'`);

  let query = supabase.from('profiles').select('id, username, full_name, profile_image_url');
  if (isUuid) {
    query = query.eq('id', cleanId);
  } else {
    query = query.eq('username', cleanId);
  }

  const { data: profile, error } = await query.maybeSingle();
  console.log(`[Database Query Result] Found Profile:`, profile, `Error:`, error ? error.message : null);

  if (error) {
    console.error(`[User Lookup Error] Target: '${targetId}', isUuid: ${isUuid}, error:`, error.message);
    return null;
  }
  return profile;
}

// --- FOLLOW ACTION (CREATES PENDING REQUEST & NOTIFICATION) ---
router.post('/api/users/:id/follow', authenticateToken, async (req, res) => {
  console.log('==================================================');
  console.log('BACKEND DEBUG - FOLLOW REQUEST RECEIVED');
  console.log('==================================================');
  console.log('1. req.params:', req.params);
  console.log('2. req.body:', req.body);
  console.log('3. req.query:', req.query);
  console.log('4. Authenticated User ID (req.user.id):', req.user ? req.user.id : 'UNAUTHENTICATED');
  console.log('5. Raw Target Identifier Param (:id):', req.params.id);

  if (!req.user) {
    console.log('==================================================');
    console.log('API RESPONSE SENT: 401 Unauthorized');
    console.log('==================================================');
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const rawParam = req.params.id;
  const currentUserId = req.user.id;

  try {
    const targetProfile = await resolveProfileByIdOrUsername(rawParam);
    if (!targetProfile) {
      console.warn(`⚠️ Target user '${rawParam}' lookup returned NULL from Supabase profiles table!`);
      console.log('==================================================');
      console.log('API RESPONSE SENT: 404 Not Found');
      console.log('==================================================');
      return res.status(404).json({ error: `User '${rawParam}' not found.` });
    }

    const targetUserId = targetProfile.id;
    console.log(`✓ Resolved Target User Profile -> UUID: ${targetUserId}, Username: @${targetProfile.username}`);

    if (targetUserId === currentUserId) {
      console.log('API RESPONSE SENT: 400 Cannot follow self');
      return res.status(400).json({ error: 'You cannot follow yourself.' });
    }

    // Check if already following
    const { data: existingFollow } = await supabase
      .from('followers')
      .select('id')
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId)
      .maybeSingle();

    if (existingFollow) {
      const respObj = { success: true, status: 'following', isFollowing: true, message: `Already following @${targetProfile.username}.` };
      console.log('API RESPONSE SENT: 200 OK (Already Following):', respObj);
      return res.json(respObj);
    }

    // Insert pending follow request
    const followReqData = {
      sender_id: currentUserId,
      receiver_id: targetUserId,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    console.log('[Database Insert Executed] UPSERT INTO follow_requests:', followReqData);

    const { error: reqErr } = await supabase
      .from('follow_requests')
      .upsert(followReqData, { onConflict: 'sender_id,receiver_id' });

    if (reqErr) {
      console.error('[Database Error] Failed to insert follow_request:', reqErr.message);
      throw reqErr;
    }
    console.log('✓ Successfully inserted pending follow request into public.follow_requests!');

    // Create Notification for Target User
    try {
      const { data: senderProf } = await supabase.from('profiles').select('username').eq('id', currentUserId).maybeSingle();
      const senderName = senderProf?.username || 'Someone';

      const notifData = {
        user_id: targetUserId,
        recipient_id: targetUserId,
        sender_id: currentUserId,
        type: 'follow_request',
        message: `@${senderName} sent you a follow request.`,
        is_read: false,
        created_at: new Date().toISOString()
      };
      console.log('[Database Insert Executed] INSERT INTO notifications:', notifData);
      await supabase.from('notifications').insert([notifData]);
      console.log('✓ Successfully inserted notification into public.notifications table!');
    } catch (nErr) {
      console.warn("Notification insert notice:", nErr.message);
    }

    const finalResp = {
      success: true,
      status: 'pending',
      isFollowing: false,
      message: `Follow request sent to @${targetProfile.username}.`
    };
    console.log('==================================================');
    console.log('API RESPONSE SENT: 200 OK', finalResp);
    console.log('==================================================');
    res.json(finalResp);
  } catch (err) {
    console.error("Follow route error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- ACCEPT FOLLOW REQUEST ---
router.post('/api/users/:id/accept-follow-request', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const rawParam = req.params.id; // User who sent request
  const currentUserId = req.user.id; // Receiver

  try {
    const senderProfile = await resolveProfileByIdOrUsername(rawParam);
    if (!senderProfile) return res.status(404).json({ error: 'Sender user not found.' });
    const senderId = senderProfile.id;

    // 1. Update follow_requests status to accepted
    await supabase
      .from('follow_requests')
      .update({ status: 'accepted' })
      .eq('sender_id', senderId)
      .eq('receiver_id', currentUserId);

    // 2. Insert follower relationship
    await supabase.from('followers').upsert([{
      follower_id: senderId,
      following_id: currentUserId
    }], { onConflict: 'follower_id,following_id' });

    // 3. Increment counters atomically
    try {
      await supabase.rpc('increment_follower_following_counts', { sender: senderId, receiver: currentUserId });
    } catch (_) {
      const { count: fCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', currentUserId);
      await supabase.from('profiles').update({ follower_count: fCount || 0 }).eq('id', currentUserId);

      const { count: fgCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', senderId);
      await supabase.from('profiles').update({ following_count: fgCount || 0 }).eq('id', senderId);
    }

    // 4. Send notification to sender
    try {
      const { data: recProf } = await supabase.from('profiles').select('username').eq('id', currentUserId).maybeSingle();
      const recName = recProf?.username || 'Someone';
      await supabase.from('notifications').insert([{
        user_id: senderId,
        recipient_id: senderId,
        sender_id: currentUserId,
        type: 'follow_accept',
        message: `@${recName} accepted your follow request.`,
        is_read: false,
        created_at: new Date().toISOString()
      }]);
    } catch (_) {}

    res.json({ success: true, message: `Accepted follow request from @${senderProfile.username}!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- REJECT FOLLOW REQUEST ---
router.post('/api/users/:id/reject-follow-request', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const rawParam = req.params.id;
  const currentUserId = req.user.id;

  try {
    const senderProfile = await resolveProfileByIdOrUsername(rawParam);
    if (!senderProfile) return res.status(404).json({ error: 'Sender user not found.' });
    const senderId = senderProfile.id;

    // Update status to rejected
    await supabase
      .from('follow_requests')
      .update({ status: 'rejected' })
      .eq('sender_id', senderId)
      .eq('receiver_id', currentUserId);

    // Send notification to sender
    try {
      const { data: recProf } = await supabase.from('profiles').select('username').eq('id', currentUserId).maybeSingle();
      const recName = recProf?.username || 'Someone';
      await supabase.from('notifications').insert([{
        user_id: senderId,
        recipient_id: senderId,
        sender_id: currentUserId,
        type: 'follow_reject',
        message: `@${recName} rejected your follow request.`,
        is_read: false,
        created_at: new Date().toISOString()
      }]);
    } catch (_) {}

    res.json({ success: true, message: 'Follow request rejected.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- UNFOLLOW ---
router.post('/api/users/:id/unfollow', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const rawParam = req.params.id;
  const currentUserId = req.user.id;

  try {
    const targetProfile = await resolveProfileByIdOrUsername(rawParam);
    if (!targetProfile) return res.status(404).json({ error: 'User to unfollow not found.' });
    const targetUserId = targetProfile.id;

    await supabase.from('followers').delete().eq('follower_id', currentUserId).eq('following_id', targetUserId);
    await supabase.from('follow_requests').delete().eq('sender_id', currentUserId).eq('receiver_id', targetUserId);

    try {
      await supabase.rpc('decrement_follower_following_counts', { sender: currentUserId, receiver: targetUserId });
    } catch (_) {
      const { count: fCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', targetUserId);
      await supabase.from('profiles').update({ follower_count: Math.max(0, fCount || 0) }).eq('id', targetUserId);

      const { count: fgCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', currentUserId);
      await supabase.from('profiles').update({ following_count: Math.max(0, fgCount || 0) }).eq('id', currentUserId);
    }

    res.json({ success: true, message: 'Unfollowed user.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/:id/relations', async (req, res) => {
  const userId = req.params.id;
  try {
    const { count: followersCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', userId);
    const { count: followingCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', userId);

    res.json({ followersCount: followersCount || 0, followingCount: followingCount || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/search', authenticateToken, async (req, res) => {
  const query = req.query.q || '';
  if (!query.trim()) return res.json([]);
  if (!req.user) return res.json([]);

  try {
    const { data: matchingUsers, error } = await supabase.from('profiles')
      .select('id, full_name, username, profile_image_url, bio')
      .neq('id', req.user.id)
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`);

    if (error) throw error;

    const { data: myFollowing } = await supabase.from('followers').select('following_id').eq('follower_id', req.user.id);
    const myFollowingSet = new Set(myFollowing ? myFollowing.map(f => f.following_id) : []);

    const results = (matchingUsers || []).map(u => ({
      _id: u.id,
      fullName: u.full_name || u.username,
      username: u.username,
      profileImage: u.profile_image_url || '',
      bio: u.bio || '',
      isFollowing: myFollowingSet.has(u.id)
    }));

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/users/:id/profile', authenticateToken, async (req, res) => {
  let targetId = req.params.id;
  if (!targetId || targetId === 'me' || targetId === 'undefined' || targetId === 'null') {
    targetId = req.user ? (req.user.id || req.user.username) : null;
  }
  if (!targetId) return res.status(401).json({ error: 'Unauthorized user.' });

  const currentUserId = req.user ? req.user.id : null;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
    let profileQuery = supabase
      .from('profiles')
      .select('id, full_name, username, profile_image_url, bio, created_at');

    if (isUuid) {
      profileQuery = profileQuery.eq('id', targetId);
    } else {
      profileQuery = profileQuery.eq('username', targetId);
    }

    const { data: userProfile, error: userError } = await profileQuery.maybeSingle();

    if (userError || !userProfile) {
      console.warn(`[Profile Debug] User profile lookup failed for targetId '${targetId}':`, userError?.message);
      return res.status(404).json({ error: 'User not found.' });
    }

    const resolvedUserId = userProfile.id;

    const { count: followersCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', resolvedUserId);
    const { count: followingCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', resolvedUserId);
    
    // Fetch all posts authored by this user from public.posts
    const { data: postsData } = await supabase
      .from('posts')
      .select(`
        *,
        author_profile:profiles!author_id(id, full_name, username, profile_image_url),
        media:post_media(media_url, media_type)
      `)
      .eq('author_id', resolvedUserId)
      .order('created_at', { ascending: false });

    const postsList = [];
    if (postsData) {
      for (const p of postsData) {
        const authorObj = {
          _id: userProfile.id,
          fullName: userProfile.full_name || userProfile.username,
          username: userProfile.username,
          profileImage: userProfile.profile_image_url || ''
        };

        const { data: commentsData } = await supabase
          .from('comments')
          .select('*, author_profile:profiles!author_id(id, full_name, username, profile_image_url)')
          .eq('post_id', p.id)
          .order('created_at', { ascending: true });

        const { data: likesData } = await supabase
          .from('likes')
          .select('user_id')
          .eq('post_id', p.id);

        const mappedLikes = (likesData || []).map(l => l.user_id);
        const mappedComments = (commentsData || []).map(c => ({
          _id: c.id,
          text: c.content,
          createdAt: c.created_at,
          postId: c.post_id,
          parentCommentId: c.parent_comment_id || null,
          likeCount: c.like_count || 0,
          replyCount: c.reply_count || 0,
          author: {
            _id: c.author_profile?.id || c.author_id,
            fullName: c.author_profile?.full_name || c.author_profile?.username || 'User',
            username: c.author_profile?.username || 'user',
            profileImage: c.author_profile?.profile_image_url || ''
          }
        }));

        postsList.push({
          _id: p.id,
          author: authorObj,
          caption: p.caption || '',
          mediaUrl: p.media && p.media.length > 0 ? p.media[0].media_url : '',
          mediaType: p.media && p.media.length > 0 ? p.media[0].media_type : 'image',
          location: p.location || '',
          createdAt: p.created_at,
          likes: mappedLikes,
          comments: mappedComments
        });
      }
    }

    let isFollowing = false;
    let isPending = false;

    if (currentUserId) {
      const { count: followCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', currentUserId).eq('following_id', resolvedUserId);
      isFollowing = (followCount || 0) > 0;

      const { count: reqCount } = await supabase.from('follow_requests').select('*', { count: 'exact', head: true }).eq('sender_id', currentUserId).eq('receiver_id', resolvedUserId).eq('status', 'pending');
      isPending = (reqCount || 0) > 0;
    }

    res.json({
      user: {
        _id: userProfile.id,
        fullName: userProfile.full_name || userProfile.username,
        username: userProfile.username,
        profileImage: userProfile.profile_image_url || '',
        bannerImage: userProfile.cover_image_url || '',
        bio: userProfile.bio || '',
        isPrivate: userProfile.is_private || false,
        followersCount: followersCount || 0,
        followingCount: followingCount || 0,
        postsCount: postsList.length,
        isFollowing,
        isPending
      },
      posts: postsList,
      reels: []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
