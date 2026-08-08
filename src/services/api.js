const API_URL = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname === '::1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.startsWith('172.') ||
  window.location.hostname.endsWith('.local')
) ? `${window.location.protocol}//${window.location.hostname}:3000`
  : window.location.origin;

export const createPost = async (postData) => {
  const token = localStorage.getItem('invibe_jwt_token');
  const res = await fetch(`${API_URL}/api/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      caption: postData.content,
      mediaUrl: postData.media[0] || '',
      mediaType: postData.media[0]?.includes('video') ? 'video' : 'image'
    })
  });
  if (!res.ok) throw new Error('Failed to create post');
  return res.json();
};

export const uploadMedia = async (file) => {
  // Simple base64 fallback or custom backend uploader mock
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve({ url: e.target.result });
    };
    reader.readAsDataURL(file);
  });
};

export const saveDraft = async (draftData) => {
  const drafts = JSON.parse(localStorage.getItem('invibe_drafts') || '[]');
  drafts.unshift({
    id: Date.now(),
    updatedAt: new Date().toISOString(),
    ...draftData
  });
  localStorage.setItem('invibe_drafts', JSON.stringify(drafts));
  return { success: true };
};

export const schedulePost = async (postData) => {
  const schedules = JSON.parse(localStorage.getItem('invibe_schedules') || '[]');
  schedules.unshift({
    id: Date.now(),
    scheduledAt: postData.scheduleTime,
    ...postData
  });
  localStorage.setItem('invibe_schedules', JSON.stringify(schedules));
  return { success: true };
};
