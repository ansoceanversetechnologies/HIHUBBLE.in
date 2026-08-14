import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { supabase } from './supabase.js';
dotenv.config();

const JWT_SECRET = 'hihubble-secure-jwt-secret';

async function testReelLikeFlow() {
  console.log("=== DIAGNOSING REEL LIKE BACKEND & DATABASE FLOW ===");

  // 1. Fetch user
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, username').limit(1);
  if (profErr || !profiles || profiles.length === 0) {
    console.error("❌ Profile lookup failed:", profErr);
    return;
  }
  const user = profiles[0];
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
  console.log(`User: @${user.username} (${user.id})`);

  // 2. Create a test reel
  const { data: reel, error: reelErr } = await supabase.from('reels').insert([{
    author_id: user.id,
    video_url: 'https://fefrlcxctuhdbztyoncs.supabase.co/storage/v1/object/public/post-videos/test_like_reel.mp4',
    caption: 'Like test reel',
    duration_seconds: 10
  }]).select('*').single();

  if (reelErr || !reel) {
    console.error("❌ Test reel creation failed:", reelErr);
    return;
  }
  console.log("Created Test Reel ID:", reel.id);

  try {
    // 3. TEST A: First Click (Like)
    console.log("\n--- TEST A: First Click (LIKE) ---");
    const resA = await fetch(`http://localhost:3000/api/reels/${reel.id}/like`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log("TEST A Status:", resA.status);
    const dataA = await resA.json();
    console.log("TEST A Response:", dataA);

    // Verify DB row
    const { data: likeRowA } = await supabase.from('reel_likes').select('*').eq('reel_id', reel.id).eq('user_id', user.id).maybeSingle();
    console.log("DB Like Row after click 1:", likeRowA);

    // 4. TEST B: Second Click (Unlike)
    console.log("\n--- TEST B: Second Click (UNLIKE) ---");
    const resB = await fetch(`http://localhost:3000/api/reels/${reel.id}/like`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log("TEST B Status:", resB.status);
    const dataB = await resB.json();
    console.log("TEST B Response:", dataB);

    // Verify DB row
    const { data: likeRowB } = await supabase.from('reel_likes').select('*').eq('reel_id', reel.id).eq('user_id', user.id).maybeSingle();
    console.log("DB Like Row after click 2:", likeRowB);

  } finally {
    // Clean up test reel
    await supabase.from('reels').delete().eq('id', reel.id);
    console.log("\nCleaned up test reel.");
  }
}

testReelLikeFlow();
