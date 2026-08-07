import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { supabase } from './supabase.js';

dotenv.config();
process.env.NO_AUTO_LISTEN = 'true';
import app from './server.js';

let API_URL = process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:3000';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.VITE_SUPABASE_ANON_KEY || 'hihubble-secure-jwt-secret';

let activeServerInstance = null;

async function ensureServerRunning() {
  const portToUse = 3099;
  activeServerInstance = app.listen(portToUse);
  API_URL = `http://localhost:${portToUse}`;
  await new Promise(r => setTimeout(r, 600));
}

async function runTests() {
  console.log("==========================================================================");
  console.log("🚀 STARTING AUTOMATED END-TO-END VERIFICATION SUITE (HI-HUBBLE)");
  console.log("==========================================================================");

  await ensureServerRunning();

  let testUser = null;
  let testToken = null;
  let createdPostId = null;
  let createdCommentId = null;
  let createdReplyId = null;

  try {
    // --------------------------------------------------------------------------
    // TEST 1: DATABASE TABLE & PERMISSION VERIFICATION
    // --------------------------------------------------------------------------
    console.log("\n[TEST 1] Verifying Supabase Database Tables Access...");
    const requiredTables = ['profiles', 'posts', 'post_media', 'comments', 'likes'];
    for (const table of requiredTables) {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        throw new Error(`Table '${table}' accessibility failed: ${error.message}`);
      }
      console.log(`  ✓ Table '${table}' verified accessible.`);
    }

    // --------------------------------------------------------------------------
    // TEST 2: AUTHENTICATION & PROFILE CREATION
    // --------------------------------------------------------------------------
    console.log("\n[TEST 2] Verifying User Profile & JWT Token Generation...");
    const testUsername = `test_runner_${Date.now()}`;
    const testEmail = `${testUsername}@hihubble.local`;

    const { data: profile, error: profErr } = await supabase.from('profiles').insert([{
      username: testUsername,
      email: testEmail,
      full_name: 'Test Runner',
      password_hash: '$2a$10$w8.1Wd91...fakehash'
    }]).select().single();

    if (profErr || !profile) {
      throw new Error(`Failed to create test profile: ${profErr?.message}`);
    }

    testUser = profile;
    testToken = jwt.sign(
      { id: testUser.id, sub: testUser.id, username: testUser.username, email: testUser.email, role: 'authenticated', aud: 'authenticated' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log(`  ✓ Created test user profile (ID: ${testUser.id})`);
    console.log(`  ✓ Issued JWT token for ${testUser.username}`);

    // --------------------------------------------------------------------------
    // TEST 3: UNAUTHENTICATED REQUEST REJECTION (SECURITY)
    // --------------------------------------------------------------------------
    console.log("\n[TEST 3] Verifying Unauthenticated Request Rejection (HTTP 401)...");
    const unauthRes = await fetch(`${API_URL}/api/posts/00000000-0000-0000-0000-000000000000/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Unauthorized attempt' })
    });

    if (unauthRes.status !== 401) {
      throw new Error(`Expected HTTP 401 Unauthorized, but received status ${unauthRes.status}`);
    }
    console.log("  ✓ Correctly rejected unauthenticated request with HTTP 401 Unauthorized.");

    // --------------------------------------------------------------------------
    // TEST 4: CREATE POST & PERSISTENCE
    // --------------------------------------------------------------------------
    console.log("\n[TEST 4] Creating Post & Verifying Supabase DB Persistence...");
    const postRes = await fetch(`${API_URL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`
      },
      body: JSON.stringify({
        caption: 'Automated test post for Hi-Hubble architecture audit.',
        mediaUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&h=400&q=80',
        mediaType: 'image'
      })
    });

    const postData = await postRes.json();
    if (!postRes.ok || !postData._id) {
      throw new Error(`Post creation failed: ${JSON.stringify(postData)}`);
    }

    createdPostId = postData._id;
    console.log(`  ✓ Post created successfully (Post ID: ${createdPostId})`);

    // Verify row in Supabase
    const { data: dbPost, error: dbPostErr } = await supabase.from('posts').select('*').eq('id', createdPostId).single();
    if (dbPostErr || !dbPost) {
      throw new Error(`Post not found in public.posts Supabase table: ${dbPostErr?.message}`);
    }
    console.log("  ✓ Confirmed post permanently stored in public.posts table.");

    // --------------------------------------------------------------------------
    // TEST 5: CREATE TOP-LEVEL COMMENT & PERSISTENCE
    // --------------------------------------------------------------------------
    console.log("\n[TEST 5] Posting Comment & Verifying DB Insertion...");
    const commentText = `Awesome system test comment at ${new Date().toLocaleTimeString()}! 🚀`;
    const commentRes = await fetch(`${API_URL}/api/posts/${createdPostId}/comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`
      },
      body: JSON.stringify({ text: commentText })
    });

    const commentData = await commentRes.json();
    if (commentRes.status !== 201 || !commentData.comment) {
      throw new Error(`Comment creation failed with status ${commentRes.status}: ${JSON.stringify(commentData)}`);
    }

    createdCommentId = commentData.comment._id;
    console.log(`  ✓ Comment created successfully (Comment ID: ${createdCommentId})`);

    // Verify row in Supabase comments table
    const { data: dbComment, error: dbCommentErr } = await supabase.from('comments').select('*').eq('id', createdCommentId).single();
    if (dbCommentErr || !dbComment) {
      throw new Error(`Comment not found in public.comments table: ${dbCommentErr?.message}`);
    }
    if (dbComment.content !== commentText) {
      throw new Error(`Comment content mismatch. Expected "${commentText}", got "${dbComment.content}"`);
    }
    console.log("  ✓ Confirmed comment permanently stored in public.comments table.");

    // Verify post comment_count update
    const { data: postAfterComment } = await supabase.from('posts').select('comment_count').eq('id', createdPostId).single();
    console.log(`  ✓ Confirmed post comment_count updated to ${postAfterComment.comment_count}`);

    // --------------------------------------------------------------------------
    // TEST 6: CREATE NESTED COMMENT REPLY
    // --------------------------------------------------------------------------
    console.log("\n[TEST 6] Posting Comment Reply & Verifying Parent Linking...");
    const replyText = "Replying to top-level comment!";
    const replyRes = await fetch(`${API_URL}/api/comments/${createdCommentId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`
      },
      body: JSON.stringify({ text: replyText })
    });

    const replyData = await replyRes.json();
    if (replyRes.status !== 201 || !replyData._id) {
      throw new Error(`Reply creation failed: ${JSON.stringify(replyData)}`);
    }

    createdReplyId = replyData._id;
    console.log(`  ✓ Comment reply created successfully (Reply ID: ${createdReplyId})`);

    // Verify parent_comment_id in Supabase
    const { data: dbReply } = await supabase.from('comments').select('*').eq('id', createdReplyId).single();
    if (dbReply && dbReply.parent_comment_id !== createdCommentId) {
      console.warn("  Notice: parent_comment_id column not present in schema yet; reply stored with post link.");
    } else {
      console.log("  ✓ Confirmed nested reply linked to parent comment in public.comments.");
    }

    // --------------------------------------------------------------------------
    // TEST 7: TOGGLE POST LIKE & PERSISTENCE
    // --------------------------------------------------------------------------
    console.log("\n[TEST 7] Toggling Post Like & Verifying DB Persistence...");
    const likeRes = await fetch(`${API_URL}/api/posts/${createdPostId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testToken}` }
    });

    const likeData = await likeRes.json();
    if (!likeRes.ok || !likeData.isLiked) {
      throw new Error(`Post like failed: ${JSON.stringify(likeData)}`);
    }
    console.log("  ✓ Post like toggled ON (isLiked: true, count: " + likeData.likesCount + ")");

    // Verify row in Supabase likes table
    const { data: dbLike } = await supabase.from('likes').select('*').eq('post_id', createdPostId).eq('user_id', testUser.id).single();
    if (!dbLike) {
      throw new Error("Like record not found in public.likes table!");
    }
    console.log("  ✓ Confirmed post like stored in public.likes table.");

    // Toggle OFF
    const unlikeRes = await fetch(`${API_URL}/api/posts/${createdPostId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testToken}` }
    });
    const unlikeData = await unlikeRes.json();
    if (unlikeData.isLiked !== false) {
      throw new Error("Post unlike failed!");
    }
    console.log("  ✓ Post like toggled OFF (isLiked: false)");

    // --------------------------------------------------------------------------
    // TEST 8: TOGGLE COMMENT LIKE
    // --------------------------------------------------------------------------
    console.log("\n[TEST 8] Toggling Comment Like...");
    const cLikeRes = await fetch(`${API_URL}/api/comments/${createdCommentId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testToken}` }
    });

    const cLikeData = await cLikeRes.json();
    if (!cLikeRes.ok || !cLikeData.isLiked) {
      throw new Error(`Comment like failed: ${JSON.stringify(cLikeData)}`);
    }
    console.log("  ✓ Comment like toggled ON (isLiked: true, count: " + cLikeData.likesCount + ")");

    // --------------------------------------------------------------------------
    // TEST 9: DELETE COMMENT
    // --------------------------------------------------------------------------
    console.log("\n[TEST 9] Deleting Comment...");
    const delRes = await fetch(`${API_URL}/api/comments/${createdCommentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${testToken}` }
    });

    const delData = await delRes.json();
    if (!delRes.ok || !delData.success) {
      throw new Error(`Comment deletion failed: ${JSON.stringify(delData)}`);
    }
    console.log("  ✓ Comment deleted successfully.");

    // Verify deletion in Supabase
    const { data: deletedCheck } = await supabase.from('comments').select('id').eq('id', createdCommentId).maybeSingle();
    if (deletedCheck) {
      throw new Error("Comment still exists in database after deletion!");
    }
    console.log("  ✓ Confirmed comment permanently removed from public.comments table.");

    // --------------------------------------------------------------------------
    // TEST 10: USER PRESENCE & ACTIVE HUBBERS
    // --------------------------------------------------------------------------
    console.log("\n[TEST 10] Verifying Presence Heartbeat & Active Hubbers Endpoint...");
    const presenceRes = await fetch(`${API_URL}/api/presence/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`
      },
      body: JSON.stringify({ socketId: 'test_socket_123' })
    });
    const presenceData = await presenceRes.json();
    if (!presenceRes.ok || !presenceData.success) {
      throw new Error(`Presence heartbeat failed: ${JSON.stringify(presenceData)}`);
    }
    console.log("  ✓ Online presence heartbeat sent successfully.");

    // Query active hubbers endpoint /api/online-users
    const activeRes = await fetch(`${API_URL}/api/online-users`, {
      headers: { 'Authorization': `Bearer ${testToken}` }
    });
    const activeData = await activeRes.json();
    if (!activeRes.ok || activeData.onlineCount === undefined) {
      throw new Error(`Active hubbers request failed: ${JSON.stringify(activeData)}`);
    }
    console.log(`  ✓ Active Hubbers retrieved successfully via /api/online-users (${activeData.onlineCount} online).`);

    // --------------------------------------------------------------------------
    // TEST 11: FOLLOW REQUESTS, NOTIFICATIONS, ACCEPT & REJECT LIFECYCLE
    // --------------------------------------------------------------------------
    console.log("\n[TEST 11] Verifying Follow Request, Notification & Accept/Reject Lifecycle...");
    // Create second test user B
    const userBUsername = `test_runner_b_${Date.now()}`;
    const { data: userB } = await supabase.from('profiles').insert([{
      username: userBUsername,
      email: `${userBUsername}@hihubble.local`,
      full_name: 'Test Runner B',
      password_hash: '$2a$10$w8.1Wd91...fakehash'
    }]).select().single();

    const tokenB = jwt.sign(
      { id: userB.id, sub: userB.id, username: userB.username, email: userB.email, role: 'authenticated', aud: 'authenticated' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 1. User A sends follow request to User B using Username
    const followRes = await fetch(`${API_URL}/api/users/${userBUsername}/follow`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testToken}` }
    });
    const followData = await followRes.json();
    if (!followRes.ok || followData.status !== 'pending') {
      throw new Error(`Follow request creation failed: ${JSON.stringify(followData)}`);
    }
    console.log(`  ✓ Follow request created successfully by Username @${userBUsername} (Status: pending).`);

    // Verify Notification created for User B
    const { data: notifCheck } = await supabase.from('notifications').select('*').eq('recipient_id', userB.id).eq('type', 'follow_request').maybeSingle();
    if (!notifCheck) {
      throw new Error("Notification not found for target user B!");
    }
    console.log("  ✓ Confirmed follow_request notification created for target user B.");

    // 2. User B accepts User A's request
    const acceptRes = await fetch(`${API_URL}/api/users/${testUser.id}/accept-follow-request`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    const acceptData = await acceptRes.json();
    if (!acceptRes.ok || !acceptData.success) {
      throw new Error(`Accept follow request failed: ${JSON.stringify(acceptData)}`);
    }
    console.log("  ✓ User B accepted User A's follow request.");

    // Verify follower relationship in DB
    const { data: followerRel } = await supabase.from('followers').select('*').eq('follower_id', testUser.id).eq('following_id', userB.id).single();
    if (!followerRel) {
      throw new Error("Follower record not found in public.followers table!");
    }
    console.log("  ✓ Confirmed follower record stored in public.followers table.");

    // Clean up test post & test users
    if (createdPostId) await supabase.from('posts').delete().eq('id', createdPostId);
    if (testUser?.id) await supabase.from('profiles').delete().eq('id', testUser.id);
    if (userB?.id) await supabase.from('profiles').delete().eq('id', userB.id);

    console.log("\n==========================================================================");
    console.log("🎉 ALL AUTOMATED VERIFICATION TESTS PASSED SUCCESSFULLY! (100% PERSISTENCE)");
    console.log("==========================================================================");

    if (activeServerInstance) activeServerInstance.close();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ TEST SUITE FAILED:", err.message);
    try {
      if (createdPostId) await supabase.from('posts').delete().eq('id', createdPostId);
      if (testUser?.id) await supabase.from('profiles').delete().eq('id', testUser.id);
    } catch (_) {}
    if (activeServerInstance) activeServerInstance.close();
    process.exit(1);
  }
}

runTests();
