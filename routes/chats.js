import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken } from '../utils.js';

const router = express.Router();

// --- HELPER FOR ROBUST USER RESOLUTION ---
async function resolveProfile(targetId) {
  if (!targetId) return null;
  const cleanId = String(targetId).trim().replace(/^@/, '');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

  let query = supabase.from('profiles').select('id, username, full_name, profile_image_url, is_online, last_active_at');
  if (isUuid) query = query.eq('id', cleanId);
  else query = query.eq('username', cleanId);

  const { data: profile } = await query.maybeSingle();
  return profile;
}

// =========================================================
// 1. GET INBOX CONVERSATION THREADS
// =========================================================
router.get('/api/chats/threads', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const currentUserId = req.user.id;

  try {
    // 1. Find all conversations the user is a member of
    const { data: userMemberships, error: memErr } = await supabase
      .from('conversation_members')
      .select('conversation_id, unread_count, last_read_at')
      .eq('user_id', currentUserId);

    if (memErr) throw memErr;

    const convIds = (userMemberships || []).map(m => m.conversation_id);
    const unreadMap = new Map((userMemberships || []).map(m => [m.conversation_id, m.unread_count || 0]));

    if (convIds.length === 0) {
      // 1. Fetch user's followers & following IDs from database
      const { data: followsData } = await supabase
        .from('followers')
        .select('follower_id, following_id')
        .or(`follower_id.eq.${currentUserId},following_id.eq.${currentUserId}`);

      const connectedUserIds = new Set();
      (followsData || []).forEach(f => {
        if (f.follower_id && f.follower_id !== currentUserId) connectedUserIds.add(f.follower_id);
        if (f.following_id && f.following_id !== currentUserId) connectedUserIds.add(f.following_id);
      });

      let suggestedProfiles = [];
      const connIdsArr = Array.from(connectedUserIds);

      if (connIdsArr.length > 0) {
        const { data: connProfs } = await supabase
          .from('profiles')
          .select('id, username, full_name, profile_image_url, is_online, last_active_at')
          .in('id', connIdsArr)
          .not('username', 'ilike', 'search_test_%');
        suggestedProfiles = connProfs || [];
      }

      if (suggestedProfiles.length === 0) {
        const { data: allRealProfiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, profile_image_url, is_online, last_active_at')
          .neq('id', currentUserId)
          .not('username', 'ilike', 'search_test_%')
          .limit(20);
        suggestedProfiles = allRealProfiles || [];
      }

      const emptyThreads = (suggestedProfiles || []).map(p => ({
        conversationId: null,
        type: 'direct',
        user: {
          _id: p.id,
          fullName: p.full_name || p.username,
          username: p.username,
          profileImage: p.profile_image_url || '',
          isOnline: !!p.is_online,
          lastSeen: p.last_active_at
        },
        lastMessage: null,
        unreadCount: 0
      }));
      return res.json(emptyThreads);
    }

    // 2. Fetch conversations
    const { data: conversations, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .in('id', convIds)
      .order('last_message_at', { ascending: false });

    if (convErr) throw convErr;

    // 3. Fetch members for these conversations
    const { data: allMembers, error: allMemErr } = await supabase
      .from('conversation_members')
      .select('conversation_id, user_id, profile:profiles(id, username, full_name, profile_image_url, is_online, last_active_at)')
      .in('conversation_id', convIds);

    if (allMemErr) throw allMemErr;

    // 4. Fetch latest message for each conversation
    const threadResults = await Promise.all(
      (conversations || []).map(async (conv) => {
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .eq('deleted_for_everyone', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get typing status
        const { data: typingData } = await supabase
          .from('typing_status')
          .select('user_id, is_typing, profile:profiles(username)')
          .eq('conversation_id', conv.id)
          .eq('is_typing', true)
          .neq('user_id', currentUserId)
          .maybeSingle();

        if (conv.type === 'direct') {
          const otherMember = (allMembers || []).find(m => m.conversation_id === conv.id && m.user_id !== currentUserId);
          const p = otherMember?.profile;
          if (!p || p.username.startsWith('search_test_')) return null;

          return {
            conversationId: conv.id,
            type: 'direct',
            user: {
              _id: p.id,
              fullName: p.full_name || p.username,
              username: p.username,
              profileImage: p.profile_image_url || '',
              isOnline: !!p.is_online,
              lastSeen: p.last_active_at
            },
            lastMessage: lastMsg ? {
              _id: lastMsg.id,
              content: lastMsg.content,
              mediaUrl: lastMsg.media_url,
              mediaType: lastMsg.media_type,
              sender: lastMsg.sender_id,
              createdAt: lastMsg.created_at,
              status: lastMsg.status
            } : null,
            unreadCount: unreadMap.get(conv.id) || 0,
            isTyping: !!typingData,
            typingUsername: typingData?.profile?.username || null
          };
        } else {
          // Group Chat Thread
          return {
            conversationId: conv.id,
            type: 'group',
            groupName: conv.name || 'Group Chat',
            groupImageUrl: conv.group_image_url || '',
            user: {
              _id: conv.id,
              fullName: conv.name || 'Group Chat',
              username: 'group',
              profileImage: conv.group_image_url || '',
              isOnline: false
            },
            lastMessage: lastMsg ? {
              _id: lastMsg.id,
              content: lastMsg.content,
              mediaUrl: lastMsg.media_url,
              mediaType: lastMsg.media_type,
              sender: lastMsg.sender_id,
              createdAt: lastMsg.created_at,
              status: lastMsg.status
            } : null,
            unreadCount: unreadMap.get(conv.id) || 0,
            isTyping: !!typingData,
            typingUsername: typingData?.profile?.username || null
          };
        }
      })
    );

    res.json((threadResults || []).filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// 2. OPEN OR CREATE 1-ON-1 DIRECT CONVERSATION
// =========================================================
router.post('/api/chats/direct/:targetId', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const currentUserId = req.user.id;
  const targetParam = req.params.targetId;

  try {
    const targetProfile = await resolveProfile(targetParam);
    if (!targetProfile) return res.status(404).json({ error: 'Target user profile not found.' });
    if (targetProfile.id === currentUserId) return res.status(400).json({ error: 'Cannot open chat with yourself.' });

    const targetUserId = targetProfile.id;

    // Check if 1-on-1 direct conversation already exists
    const { data: myMemberships } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', currentUserId);
    const myConvIds = (myMemberships || []).map(m => m.conversation_id);

    if (myConvIds.length > 0) {
      const { data: sharedMembership } = await supabase
        .from('conversation_members')
        .select('conversation_id, conversation:conversations!inner(type)')
        .eq('user_id', targetUserId)
        .in('conversation_id', myConvIds)
        .eq('conversation.type', 'direct')
        .maybeSingle();

      if (sharedMembership) {
        return res.json({
          conversationId: sharedMembership.conversation_id,
          targetUser: {
            _id: targetProfile.id,
            fullName: targetProfile.full_name || targetProfile.username,
            username: targetProfile.username,
            profileImage: targetProfile.profile_image_url || '',
            isOnline: !!targetProfile.is_online,
            lastSeen: targetProfile.last_active_at
          }
        });
      }
    }

    // Create new direct conversation
    const { data: newConv, error: createErr } = await supabase
      .from('conversations')
      .insert([{
        type: 'direct',
        created_by: currentUserId,
        last_message_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (createErr) throw createErr;

    // Add both members
    await supabase.from('conversation_members').insert([
      { conversation_id: newConv.id, user_id: currentUserId, role: 'member' },
      { conversation_id: newConv.id, user_id: targetUserId, role: 'member' }
    ]);

    res.status(201).json({
      conversationId: newConv.id,
      targetUser: {
        _id: targetProfile.id,
        fullName: targetProfile.full_name || targetProfile.username,
        username: targetProfile.username,
        profileImage: targetProfile.profile_image_url || '',
        isOnline: !!targetProfile.is_online,
        lastSeen: targetProfile.last_active_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// 3. FETCH MESSAGES FOR CONVERSATION
// =========================================================
router.get('/api/chats/messages/:convId', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const currentUserId = req.user.id;
  const convId = req.params.convId;

  try {
    // If param is a target user ID/username or conversation ID, resolve conversation ID
    let conversationId = convId;

    // 1. Check if convId exists in conversations table (only if valid UUID)
    let convExists = null;
    const isConvUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(convId);
    if (isConvUuid) {
      const { data } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', convId)
        .maybeSingle();
      convExists = data;
    }

    if (!convExists) {
      // 2. convId is a target user ID or username! Resolve profile & find shared conversation
      const targetProfile = await resolveProfile(convId);
      if (targetProfile) {
        const { data: myMems } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', currentUserId);

        const myIds = (myMems || []).map(m => m.conversation_id);

        if (myIds.length > 0) {
          const { data: shared } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', targetProfile.id)
            .in('conversation_id', myIds)
            .maybeSingle();

          if (shared) {
            conversationId = shared.conversation_id;
          }
        }

        if (!conversationId || conversationId === convId) {
          const { data: dmMsg } = await supabase
            .from('messages')
            .select('conversation_id')
            .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${targetProfile.id}),and(sender_id.eq.${targetProfile.id},recipient_id.eq.${currentUserId})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (dmMsg && dmMsg.conversation_id) {
            conversationId = dmMsg.conversation_id;
          }
        }
      }
    }

    // Fetch messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!sender_id(id, username, full_name, profile_image_url),
        voice_note:voice_notes!message_id(duration, waveform, audio_url)
      `)
      .eq('conversation_id', conversationId)
      .eq('deleted_for_everyone', false)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Filter out messages deleted for me
    const filtered = (messages || []).filter(m => !(m.deleted_for_me || []).includes(currentUserId));

    // Fetch reactions for these messages
    const msgIds = filtered.map(m => m.id);
    let reactionsMap = new Map();
    if (msgIds.length > 0) {
      const { data: rxData } = await supabase.from('message_reactions').select('*').in('message_id', msgIds);
      (rxData || []).forEach(rx => {
        if (!reactionsMap.has(rx.message_id)) reactionsMap.set(rx.message_id, []);
        reactionsMap.get(rx.message_id).push(rx);
      });
    }

    // Mark messages as read for current user
    await supabase.from('messages').update({ status: 'read', is_read: true }).eq('conversation_id', conversationId).neq('sender_id', currentUserId);
    await supabase.from('conversation_members').update({ unread_count: 0, last_read_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('user_id', currentUserId);

    const formattedMessages = filtered.map(m => ({
      _id: m.id,
      id: m.id,
      conversationId: m.conversation_id,
      sender: m.sender ? {
        _id: m.sender.id,
        fullName: m.sender.full_name || m.sender.username,
        username: m.sender.username,
        profileImage: m.sender.profile_image_url || ''
      } : m.sender_id,
      recipient: m.recipient_id,
      content: m.content,
      mediaUrl: m.media_url,
      mediaType: m.media_type || 'text',
      mediaName: m.media_name,
      mediaSize: m.media_size,
      replyToId: m.reply_to_id,
      status: m.status,
      isPinned: !!m.is_pinned,
      isStarred: !!m.is_starred,
      isEdited: !!m.is_edited,
      reactions: reactionsMap.get(m.id) || [],
      voiceNote: Array.isArray(m.voice_note) ? m.voice_note[0] : m.voice_note,
      createdAt: m.created_at
    }));

    res.json(formattedMessages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// SEARCH INSIDE MESSAGES (MUST BE PLACED BEFORE /api/chats/:targetUserId)
// =========================================================
router.get('/api/chats/search', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const currentUserId = req.user.id;
  const queryText = (req.query.q || '').trim();

  if (!queryText) return res.json([]);

  try {
    // 1. Fetch conversations user belongs to
    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', currentUserId);

    const convIds = (memberships || []).map(m => m.conversation_id);

    // 2. Fetch search results matching content text
    const { data: searchResults, error: searchErr } = await supabase
      .from('messages')
      .select('*')
      .ilike('content', `%${queryText}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (searchErr) throw searchErr;

    // 3. Filter messages relevant to current user
    const userMessages = (searchResults || []).filter(msg => {
      if (msg.sender_id === currentUserId || msg.recipient_id === currentUserId) return true;
      if (convIds.includes(msg.conversation_id)) return true;
      return false;
    });

    res.json(userMessages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback 1-on-1 direct user message endpoint
router.get('/api/chats/:targetUserId', authenticateToken, async (req, res) => {
  const currentUserId = req.user.id;
  const targetParam = req.params.targetUserId;
  try {
    const targetProfile = await resolveProfile(targetParam);
    if (!targetProfile) return res.json([]);

    const { data: myMems } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', currentUserId);
    const myIds = (myMems || []).map(m => m.conversation_id);
    const { data: shared } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', targetProfile.id).in('conversation_id', myIds).maybeSingle();

    if (!shared) return res.json([]);

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', shared.conversation_id)
      .eq('deleted_for_everyone', false)
      .order('created_at', { ascending: true });

    res.json(messages || []);
  } catch (err) {
    res.json([]);
  }
});

// =========================================================
// 4. SEND MESSAGE (TEXT, MEDIA, VOICE NOTES, DOCUMENTS)
// =========================================================
router.post('/api/chats/message', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const currentUserId = req.user.id;

  try {
    const { conversationId, recipient, recipientId, content, mediaUrl, mediaType, mediaName, mediaSize, replyToId, duration, waveform } = req.body;
    let targetConvId = conversationId;
    let targetRecipientId = recipientId || recipient;

    // Resolve target profile if recipient specified
    let targetProfile = null;
    if (targetRecipientId) {
      targetProfile = await resolveProfile(targetRecipientId);
      if (targetProfile) targetRecipientId = targetProfile.id;
    }

    // Auto-create/resolve conversation if conversationId is missing
    if (!targetConvId && targetRecipientId) {
      const { data: myMems } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', currentUserId);
      const myIds = (myMems || []).map(m => m.conversation_id);
      const { data: shared } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', targetRecipientId).in('conversation_id', myIds).maybeSingle();

      if (shared) {
        targetConvId = shared.conversation_id;
      } else {
        const { data: newConv } = await supabase.from('conversations').insert([{ type: 'direct', created_by: currentUserId, last_message_at: new Date().toISOString() }]).select().single();
        await supabase.from('conversation_members').insert([
          { conversation_id: newConv.id, user_id: currentUserId, role: 'member' },
          { conversation_id: newConv.id, user_id: targetRecipientId, role: 'member' }
        ]);
        targetConvId = newConv.id;
      }
    }

    if (!targetConvId) return res.status(400).json({ error: 'Conversation or Recipient ID is required.' });

    const nowIso = new Date().toISOString();

    // Insert Message
    const { data: newMsg, error: msgErr } = await supabase
      .from('messages')
      .insert([{
        conversation_id: targetConvId,
        sender_id: currentUserId,
        recipient_id: targetRecipientId,
        content: content || '',
        media_url: mediaUrl || null,
        media_type: mediaType || 'text',
        media_name: mediaName || null,
        media_size: mediaSize || null,
        reply_to_id: replyToId || null,
        status: 'sent',
        created_at: nowIso,
        updated_at: nowIso
      }])
      .select()
      .single();

    if (msgErr) throw msgErr;

    // Insert Voice Note entry if voice note
    let voiceNoteObj = null;
    if (mediaType === 'voice_note' && mediaUrl) {
      const { data: vn } = await supabase.from('voice_notes').insert([{
        message_id: newMsg.id,
        user_id: currentUserId,
        duration: duration || 0,
        waveform: waveform || [],
        audio_url: mediaUrl
      }]).select().single();
      voiceNoteObj = vn;
    }

    // Update conversation last_message_at
    await supabase.from('conversations').update({ last_message_at: nowIso, updated_at: nowIso }).eq('id', targetConvId);

    // Increment unread count for other members
    const { data: otherMembers } = await supabase.from('conversation_members').select('user_id, unread_count').eq('conversation_id', targetConvId).neq('user_id', currentUserId);
    for (const mem of (otherMembers || [])) {
      await supabase.from('conversation_members').update({ unread_count: (mem.unread_count || 0) + 1 }).eq('conversation_id', targetConvId).eq('user_id', mem.user_id);
    }

    // Notification for offline recipient
    if (targetRecipientId) {
      try {
        const { data: recOnline } = await supabase.from('online_users').select('status').eq('user_id', targetRecipientId).maybeSingle();
        const isOnline = recOnline?.status === 'online';
        if (!isOnline) {
          const { data: senderProf } = await supabase.from('profiles').select('username').eq('id', currentUserId).maybeSingle();
          const senderName = senderProf?.username || 'Someone';
          await supabase.from('notifications').insert([{
            user_id: targetRecipientId,
            recipient_id: targetRecipientId,
            sender_id: currentUserId,
            type: 'chat_message',
            message: `@${senderName} sent you a message: "${content ? content.slice(0, 30) : 'Attachment'}"`,
            is_read: false,
            created_at: nowIso
          }]);
        }
      } catch (_) {}
    }

    res.status(201).json({
      _id: newMsg.id,
      id: newMsg.id,
      conversationId: targetConvId,
      sender: currentUserId,
      recipient: targetRecipientId,
      content: newMsg.content,
      mediaUrl: newMsg.media_url,
      mediaType: newMsg.media_type,
      mediaName: newMsg.media_name,
      mediaSize: newMsg.media_size,
      replyToId: newMsg.reply_to_id,
      status: newMsg.status,
      voiceNote: voiceNoteObj,
      createdAt: newMsg.created_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// 5. TYPING INDICATOR STATUS
// =========================================================
router.post('/api/chats/typing', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const currentUserId = req.user.id;
  const { conversationId, isTyping } = req.body;

  if (!conversationId) return res.status(400).json({ error: 'Conversation ID required.' });

  try {
    await supabase.from('typing_status').upsert({
      conversation_id: conversationId,
      user_id: currentUserId,
      is_typing: !!isTyping,
      updated_at: new Date().toISOString()
    }, { onConflict: 'conversation_id,user_id' });

    res.json({ success: true, isTyping: !!isTyping });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// 6. READ RECEIPTS
// =========================================================
router.post('/api/chats/read', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const currentUserId = req.user.id;
  const { conversationId } = req.body;

  if (!conversationId) return res.status(400).json({ error: 'Conversation ID required.' });

  try {
    await supabase.from('messages').update({ status: 'read', is_read: true }).eq('conversation_id', conversationId).neq('sender_id', currentUserId);
    await supabase.from('conversation_members').update({ unread_count: 0, last_read_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('user_id', currentUserId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/chats/:userId/read', authenticateToken, async (req, res) => {
  const currentUserId = req.user.id;
  const targetParam = req.params.userId;
  try {
    const targetProfile = await resolveProfile(targetParam);
    if (targetProfile) {
      await supabase.from('messages').update({ status: 'read', is_read: true }).eq('sender_id', targetProfile.id).eq('recipient_id', currentUserId);
    }
    res.json({ success: true });
  } catch (err) {
    res.json({ success: true });
  }
});

// =========================================================
// 7. EMOJI REACTIONS
// =========================================================
router.post('/api/chats/messages/:msgId/reaction', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const currentUserId = req.user.id;
  const msgId = req.params.msgId;
  const { emoji } = req.body;

  if (!emoji) return res.status(400).json({ error: 'Emoji is required.' });

  try {
    const { data: existing } = await supabase.from('message_reactions').select('id').eq('message_id', msgId).eq('user_id', currentUserId).eq('emoji', emoji).maybeSingle();
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
      return res.json({ success: true, action: 'removed', emoji });
    }

    const { data: rx } = await supabase.from('message_reactions').insert([{ message_id: msgId, user_id: currentUserId, emoji }]).select().single();
    res.json({ success: true, action: 'added', reaction: rx });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// 8. DELETE MESSAGE (FOR ME / FOR EVERYONE)
// =========================================================
router.delete('/api/chats/messages/:msgId', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const msgId = req.params.msgId;
  const currentUserId = req.user.id;
  const forEveryone = req.query.forEveryone === 'true';

  try {
    const { data: msg } = await supabase.from('messages').select('*').eq('id', msgId).maybeSingle();
    if (!msg) return res.status(404).json({ error: 'Message not found.' });

    if (forEveryone) {
      if (msg.sender_id !== currentUserId) return res.status(403).json({ error: 'You can only delete your own messages for everyone.' });
      await supabase.from('messages').update({ deleted_for_everyone: true, content: 'This message was deleted' }).eq('id', msgId);
      return res.json({ success: true, mode: 'everyone' });
    } else {
      const updatedDeletedForMe = [...(msg.deleted_for_me || []), currentUserId];
      await supabase.from('messages').update({ deleted_for_me: updatedDeletedForMe }).eq('id', msgId);
      return res.json({ success: true, mode: 'me' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backward compatible delete route
router.delete('/api/chats/message/:msgId', authenticateToken, async (req, res) => {
  const msgId = req.params.msgId;
  const currentUserId = req.user.id;
  try {
    await supabase.from('messages').update({ deleted_for_everyone: true }).eq('id', msgId).eq('sender_id', currentUserId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// 9. GROUP CHAT CREATION
// =========================================================
router.post('/api/chats/groups', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const currentUserId = req.user.id;
  const { name, description, groupImageUrl, memberIds } = req.body;

  if (!name) return res.status(400).json({ error: 'Group name is required.' });

  try {
    const nowIso = new Date().toISOString();
    const { data: groupConv, error: groupErr } = await supabase
      .from('conversations')
      .insert([{
        type: 'group',
        name,
        description: description || null,
        group_image_url: groupImageUrl || null,
        created_by: currentUserId,
        last_message_at: nowIso
      }])
      .select()
      .single();

    if (groupErr) throw groupErr;

    const uniqueMembers = Array.from(new Set([currentUserId, ...(memberIds || [])]));
    const memberRows = uniqueMembers.map(uid => ({
      conversation_id: groupConv.id,
      user_id: uid,
      role: uid === currentUserId ? 'admin' : 'member'
    }));

    await supabase.from('conversation_members').insert(memberRows);

    res.status(201).json({
      success: true,
      conversationId: groupConv.id,
      group: groupConv
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
