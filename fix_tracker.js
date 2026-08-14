const fs = require('fs');
const file = 'src/main.js';
let content = fs.readFileSync(file, 'utf8');

const oldTrackerStr = `// Screen Time Tracker
let screenTimeSeconds = 0;
setInterval(() => {
  screenTimeSeconds++;
  const box = document.getElementById('screen-time-box');
  if (box) {
    const hours = Math.floor(screenTimeSeconds / 3600);
    const minutes = Math.floor((screenTimeSeconds % 3600) / 60);
    const hStr = hours.toString().padStart(2, '0');
    const mStr = minutes.toString().padStart(2, '0');
    box.textContent = \`Screen Time: \${hStr}h \${mStr}m\`;
  }
}, 1000);`;

const newTrackerStr = `// Screen Time Tracker
(function initScreenTimeTracker() {
  if (window._screenTimeInterval) clearInterval(window._screenTimeInterval);

  function getUid() {
    try {
      const userStr = localStorage.getItem('invibe_user') || localStorage.getItem('invibeUser');
      if (userStr) {
        const u = JSON.parse(userStr);
        return u.id || u._id || 'guest';
      }
    } catch(e) {}
    return 'guest';
  }

  const storageKey = \`hihubble_screen_time_\${getUid()}\`;
  let screenTimeSeconds = parseInt(localStorage.getItem(storageKey) || '0', 10);

  function updateScreenTimeUI() {
    const box = document.getElementById('screen-time-box');
    if (box) {
      const hours = Math.floor(screenTimeSeconds / 3600);
      const minutes = Math.floor((screenTimeSeconds % 3600) / 60);
      const hStr = hours.toString().padStart(2, '0');
      const mStr = minutes.toString().padStart(2, '0');
      box.textContent = \`Screen Time: \${hStr}h \${mStr}m\`;
    }
  }

  // Update immediately on load
  updateScreenTimeUI();

  window._screenTimeInterval = setInterval(() => {
    // Only count active application time
    if (document.visibilityState === 'visible') {
      screenTimeSeconds++;
      
      // Persist occasionally so we don't spam localStorage, but keep it accurate
      if (screenTimeSeconds % 5 === 0) {
        localStorage.setItem(storageKey, screenTimeSeconds.toString());
      }
      
      updateScreenTimeUI();
    }
  }, 1000);
  
  // Save precisely when leaving the tab
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      localStorage.setItem(storageKey, screenTimeSeconds.toString());
    }
  });
})();`;

// Use regex to catch line ending differences
const regex = /\/\/ Screen Time Tracker[\s\S]*?\}, 1000\);/g;
if (content.match(regex)) {
  content = content.replace(regex, newTrackerStr);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Success!");
} else {
  console.log("Could not match the regex.");
}
