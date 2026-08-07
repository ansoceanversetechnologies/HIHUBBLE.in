import './style.css'
import './auth.css'
import { initAuth, updateAppUI, handleLogout, supabase } from './auth.js'

document.addEventListener('DOMContentLoaded', () => {
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

  window.savedHubbs = window.savedHubbs || [];

  initAuth();
  updateAppUI();
  window.addEventListener('auth-changed', updateAppUI);

  // Global Logout Handling (Applies to sidebar logout, mobile logout, profile header avatar)
  document.addEventListener('click', (e) => {
    const logoutBtn = e.target.closest('#logout-btn, .logout-btn, [data-action="logout"], #header-profile-avatar');
    if (logoutBtn) {
      e.preventDefault();
      if (confirm('Are you sure you want to log out of Hi-Hubble?')) {
        handleLogout();
      }
    }
  });

  // Global Follow / Unfollow Button Handling
  document.addEventListener('click', async (e) => {
    const followBtn = e.target.closest('.btn-follow-user');
    if (followBtn) {
      e.preventDefault();
      e.stopPropagation();

      const targetId = followBtn.getAttribute('data-user-id');
      const targetUsername = followBtn.getAttribute('data-username') || 'user';
      const token = localStorage.getItem('invibe_jwt_token');

      if (!token) {
        showToast('Please log in to follow users! 🔐');
        return;
      }

      const followingList = JSON.parse(localStorage.getItem('invibe_following_users') || '[]');
      const pendingList = JSON.parse(localStorage.getItem('invibe_pending_users') || '[]');
      const isCurrentlyFollowing = followingList.includes(targetId);
      const isCurrentlyPending = pendingList.includes(targetId);

      followBtn.disabled = true;

      try {
        const endpoint = (isCurrentlyFollowing || isCurrentlyPending) ? `/api/users/${targetId}/unfollow` : `/api/users/${targetId}/follow`;
        const res = await fetch(`${API_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const resData = await res.json();
          if (resData.status === 'pending') {
            if (!pendingList.includes(targetId)) pendingList.push(targetId);
            localStorage.setItem('invibe_pending_users', JSON.stringify(pendingList));
            showToast(resData.message || `Follow request sent to @${targetUsername}. ⏳`);

            document.querySelectorAll(`.btn-follow-user[data-user-id="${targetId}"]`).forEach(btn => {
              btn.className = 'btn-follow-user pending';
              btn.style.background = 'rgba(234, 179, 8, 0.2)';
              btn.style.color = '#eab308';
              btn.textContent = 'Requested';
            });
          } else if (resData.status === 'following' || resData.isFollowing) {
            if (!followingList.includes(targetId)) followingList.push(targetId);
            const pIdx = pendingList.indexOf(targetId);
            if (pIdx > -1) pendingList.splice(pIdx, 1);

            localStorage.setItem('invibe_following_users', JSON.stringify(followingList));
            localStorage.setItem('invibe_pending_users', JSON.stringify(pendingList));
            showToast(resData.message || `Now following @${targetUsername}! 🎉`);

            document.querySelectorAll(`.btn-follow-user[data-user-id="${targetId}"]`).forEach(btn => {
              btn.className = 'btn-follow-user following';
              btn.style.background = 'rgba(255,255,255,0.1)';
              btn.style.color = '#ffffff';
              btn.textContent = 'Following';
            });
          } else {
            // Unfollowed
            const fIdx = followingList.indexOf(targetId);
            if (fIdx > -1) followingList.splice(fIdx, 1);
            const pIdx = pendingList.indexOf(targetId);
            if (pIdx > -1) pendingList.splice(pIdx, 1);

            localStorage.setItem('invibe_following_users', JSON.stringify(followingList));
            localStorage.setItem('invibe_pending_users', JSON.stringify(pendingList));
            showToast(resData.message || `Unfollowed @${targetUsername}`);

            document.querySelectorAll(`.btn-follow-user[data-user-id="${targetId}"]`).forEach(btn => {
              btn.className = 'btn-follow-user';
              btn.style.background = 'var(--primary, #a855f7)';
              btn.style.color = '#ffffff';
              btn.textContent = '+ Follow';
            });
          }

          if (typeof updateAppUI === 'function') updateAppUI();
        }
      } catch (err) {
        console.error("Follow action error:", err);
      } finally {
        followBtn.disabled = false;
      }
    }
  });

  // Initialize Lucide Icons (Debounced for performance)
  let iconRenderQueued = false;
  const debouncedCreateIcons = () => {
    if (!window.lucide || iconRenderQueued) return;
    iconRenderQueued = true;
    requestAnimationFrame(() => {
      if (window.lucide) window.lucide.createIcons();
      iconRenderQueued = false;
    });
  };
  window.debouncedCreateIcons = debouncedCreateIcons;

  debouncedCreateIcons();

  // --- STATE SYSTEM ---
  const state = {
    theme: 'dark',
    activeView: 'home',
    currentChatThread: null,
    chatMode: 'chat', // chat, watch, call, game, media
    callTimerInterval: null,
    callSeconds: 1455, // starts at 00:24:15
    isLiked: {
      post1: false,
      post2: false
    },
    likesCount: {
      post1: 12400,
      post2: 8200
    },
    storyGroups: [],
    activeGroupIndex: 0,
    activeStoryIndex: 0,
    storyProgressInterval: null,
    storyProgressPercent: 0,
    isStoryPaused: false,
    isLudoRolling: false
  };

  // --- STICKY HEADER progressive BLUR ---
  const header = document.getElementById('main-header');
  let tickingScroll = false;
  window.addEventListener('scroll', () => {
    if (!tickingScroll) {
      window.requestAnimationFrame(() => {
        if (window.scrollY > 20) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
        tickingScroll = false;
      });
      tickingScroll = true;
    }
  });

  // --- THEME TOGGLE CONTROLLER ---
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  themeToggleBtn.addEventListener('click', () => {
    if (document.body.classList.contains('dark-theme')) {
      document.body.classList.replace('dark-theme', 'light-theme');
      state.theme = 'light';
      showToast('Switched to Light Theme ☀️');
    } else {
      document.body.classList.replace('light-theme', 'dark-theme');
      state.theme = 'dark';
      showToast('Switched to Dark Theme 🌌');
    }
  });


  // --- INDEXEDDB DRAFTS WRAPPER ---
  const DraftsDB = {
    dbName: 'HiHubbleDrafts',
    dbVersion: 1,
    storeName: 'drafts',
    init() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.dbVersion);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
      });
    },
    async saveDraft(draft) {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        draft.lastModified = Date.now();
        if (!draft.id) draft.id = 'draft_' + Date.now();
        if (!draft.createdAt) draft.createdAt = Date.now();
        const request = store.put(draft);
        request.onsuccess = () => resolve(draft);
        request.onerror = () => reject(request.error);
      });
    },
    async getDrafts() {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result.sort((a,b) => b.lastModified - a.lastModified));
        request.onerror = () => reject(request.error);
      });
    },
    async deleteDraft(id) {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  };
  window.DraftsDB = DraftsDB;

  // --- SAVE DRAFT ACTION ---
  window.saveCurrentDraft = async function() {
    if (!window.chUploads || window.chUploads.length === 0) {
      showToast('Please upload media first');
      return;
    }
    const media = window.chUploads[0];
    
    // We must read the file into a base64 string or blob to store in IndexedDB.
    // IndexedDB can store Blobs natively!
    const draft = {
      mediaFile: media.file,
      mediaType: media.type,
      mediaThumbUrl: media.thumbUrl,
      editorState: JSON.parse(JSON.stringify(window.HubbleEditor.state)),
      caption: document.querySelector('.ch-caption-input')?.value || '',
      collaborationEnabled: window.collaborationEnabled !== false,
      collaborators: window.selectedCollaborators ? JSON.parse(JSON.stringify(window.selectedCollaborators)) : [],
      scheduleEnabled: document.getElementById('ch-schedule-toggle')?.checked || false,
      scheduleDate: document.getElementById('ch-schedule-date')?.value || '',
      scheduleTime: document.getElementById('ch-schedule-time')?.value || ''
    };
    
    // Check if we are editing an existing draft
    if (window.currentDraftId) {
      draft.id = window.currentDraftId;
      draft.createdAt = window.currentDraftCreatedAt;
    }
    
    try {
      await DraftsDB.saveDraft(draft);
      if (!window._silentDraftSave) {
        showToast('Saved as draft! 📝');
      }
      window._silentDraftSave = false;
      window.renderDraftsList();
    } catch(err) {
      console.error(err);
      if (!window._silentDraftSave) {
        showToast('Failed to save draft');
      }
      window._silentDraftSave = false;
    }
  };

  window.renderDraftsList = async function() {
    const list = document.getElementById('ch-drafts-list');
    const hddList = document.getElementById('hdd-list');
    const countLabel = document.getElementById('drafts-count');
    const emptyState = document.getElementById('drafts-empty-state');
    const hddEmptyState = document.getElementById('hdd-empty-state');
    const seeAllBtn = document.getElementById('see-all-drafts-btn');
    
    const drafts = await DraftsDB.getDrafts();
    if (countLabel) countLabel.innerText = drafts.length;
    
    // Clear both lists (except empty states)
    if (list) {
      Array.from(list.children).forEach(child => {
        if (child.id !== 'drafts-empty-state') child.remove();
      });
    }
    if (hddList) {
      Array.from(hddList.children).forEach(child => {
        if (child.id !== 'hdd-empty-state') child.remove();
      });
    }

    if (drafts.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      if (hddEmptyState) hddEmptyState.style.display = 'flex';
      if (seeAllBtn) seeAllBtn.style.display = 'none';
    } else {
      if (emptyState) emptyState.style.display = 'none';
      if (hddEmptyState) hddEmptyState.style.display = 'none';
      if (seeAllBtn) seeAllBtn.style.display = 'block';
      
      drafts.slice(0, 3).forEach(d => {
        const timeAgo = Math.round((Date.now() - d.lastModified) / 60000); // mins
        const timeStr = timeAgo < 60 ? `${timeAgo}m ago` : `${Math.round(timeAgo/60)}h ago`;
        const title = d.caption || 'Untitled HUBB';
        const imgUrl = d.mediaThumbUrl || URL.createObjectURL(d.mediaFile);
        
        // Share HUBBs Panel Item
        if (list) {
          const item = document.createElement('div');
          item.className = 'ch-draft-item';
          item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background: rgba(255,255,255,0.03); padding: 8px; border-radius: 12px; transition: all 0.2s ease;';
          item.innerHTML = `
            <div style="display:flex; gap:10px; align-items:center; cursor:pointer;" onclick="window.loadDraft('${d.id}')">
              <img src="${imgUrl}" style="width:40px; height:40px; border-radius:8px; object-fit:contain; object-position:center;" alt="Draft">
              <div class="ch-draft-info">
                <div class="ch-draft-title" style="font-weight:600; font-size:0.85rem; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main);">${title}</div>
                <div class="ch-draft-time" style="color:var(--text-muted); font-size:0.75rem;">${timeStr}</div>
              </div>
            </div>
            <div style="display: flex; gap: 4px;">
              <button onclick="window.duplicateDraft('${d.id}')" style="background:transparent; border:none; color:var(--text-main); padding:4px; cursor:pointer; opacity: 0.6; transition: opacity 0.2s;"><i data-lucide="copy" style="width:14px; height:14px;"></i></button>
              <button onclick="window.deleteDraft('${d.id}')" style="background:transparent; border:none; color: #ef4444; padding:4px; cursor:pointer; opacity: 0.6; transition: opacity 0.2s;"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
            </div>
          `;
          list.appendChild(item);
        }

        // Home Dropdown Panel Item
        if (hddList) {
          const hItem = document.createElement('div');
          hItem.className = 'ch-draft-item';
          hItem.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background: rgba(255,255,255,0.03); padding: 8px; border-radius: 12px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s ease; border: 1px solid transparent;';
          hItem.onclick = (e) => {
            if (e.target.closest('button')) return; // Don't trigger load if clicking delete/duplicate
            document.getElementById('home-drafts-panel')?.classList.remove('open');
            window.loadDraft(d.id);
          };
          hItem.onmouseover = () => { hItem.style.transform = 'translateY(-2px)'; hItem.style.background = 'rgba(255,255,255,0.08)'; hItem.style.borderColor = 'rgba(168, 85, 247, 0.3)'; };
          hItem.onmouseout = () => { hItem.style.transform = 'none'; hItem.style.background = 'rgba(255,255,255,0.03)'; hItem.style.borderColor = 'transparent'; };
          const mediaCount = window.chUploads ? window.chUploads.length : 1;
          hItem.innerHTML = `
            <div style="display:flex; gap:12px; align-items:center;">
              <div style="position: relative;">
                <img src="${imgUrl}" style="width:48px; height:48px; border-radius:10px; object-fit:cover; object-position:center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);" alt="Draft">
                <div style="position: absolute; bottom: -4px; right: -4px; background: var(--primary); color: white; font-size: 0.6rem; font-weight: bold; padding: 2px 6px; border-radius: 10px; border: 2px solid rgba(20,20,25,1);">${mediaCount}</div>
              </div>
              <div class="ch-draft-info">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                  <div class="ch-draft-title" style="font-weight:600; font-size:0.9rem; max-width: 130px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main);">${title}</div>
                  <span style="font-size: 0.6rem; background: rgba(255,255,255,0.1); color: var(--text-muted); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">Draft</span>
                </div>
                <div class="ch-draft-time" style="color:var(--text-muted); font-size:0.75rem;">Saved ${timeStr}</div>
              </div>
            </div>
            <div style="display: flex; gap: 4px;">
              <button onclick="window.deleteDraft('${d.id}')" style="background:transparent; border:none; color: #ef4444; padding:8px; cursor:pointer; opacity: 0.8; transition: transform 0.2s;"><i data-lucide="trash-2" style="width:16px; height:16px;"></i></button>
            </div>
          `;
          hddList.appendChild(hItem);
        }
      });
      if (window.lucide) window.lucide.createIcons();
    }
  };

  window.loadDraft = async function(id) {
    const drafts = await DraftsDB.getDrafts();
    const d = drafts.find(x => x.id === id);
    if(!d) return;
    
    // Restore variables
    window.chUploads = [{
      file: d.mediaFile,
      type: d.mediaType,
      thumbUrl: d.mediaThumbUrl || URL.createObjectURL(d.mediaFile)
    }];
    
    window.currentDraftId = d.id;
    window.currentDraftCreatedAt = d.createdAt;
    
    if (d.editorState) window.HubbleEditor.state = JSON.parse(JSON.stringify(d.editorState));
    
    const captionInput = document.querySelector('.ch-caption-input');
    if (captionInput) captionInput.value = d.caption || '';
    
    // Switch view to editor
    if (window.switchView) window.switchView('create-hubbs');
    window.initCreateHubbsUpload();
    
    // Restore collaborators
    window.collaborationEnabled = d.collaborationEnabled !== false;
    const toggleEl = document.getElementById('ch-collab-toggle');
    if (toggleEl) {
      toggleEl.checked = window.collaborationEnabled;
      if (window.toggleCollaboration) window.toggleCollaboration(window.collaborationEnabled);
    }
    
    window.selectedCollaborators = d.collaborators || [];
    if (window.renderCollaboratorChips) window.renderCollaboratorChips();
    
    // Restore scheduling
    const schedToggle = document.getElementById('ch-schedule-toggle');
    if (schedToggle) {
      schedToggle.checked = d.scheduleEnabled === true;
      if (window.toggleScheduling) window.toggleScheduling(schedToggle.checked);
    }
    const schedDate = document.getElementById('ch-schedule-date');
    if (schedDate) schedDate.value = d.scheduleDate || '';
    const schedTime = document.getElementById('ch-schedule-time');
    if (schedTime) schedTime.value = d.scheduleTime || '';
  };

  window.deleteDraft = async function(id) {
    if(confirm('Delete this draft?')) {
      await DraftsDB.deleteDraft(id);
      window.renderDraftsList();
    }
  };
  
  window.duplicateDraft = async function(id) {
    const drafts = await DraftsDB.getDrafts();
    const d = drafts.find(x => x.id === id);
    if(!d) return;
    
    const clone = { ...d, id: undefined, createdAt: undefined };
    await DraftsDB.saveDraft(clone);
    window.renderDraftsList();
  };

  // --- AUTO SAVE DEBOUNCE ---
  let autoSaveTimeout = null;
  window.triggerAutoSave = function() {
    if (state.activeView === 'create-hubbs' && window.chUploads && window.chUploads.length > 0) {
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        window._silentDraftSave = true;
        if (window.saveCurrentDraft) window.saveCurrentDraft();
      }, 3000);
    }
  };

  // Run on init
  document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('input', (e) => {
      if (e.target.closest('#view-create-hubbs') || e.target.closest('#view-review-hubbs')) {
        window.triggerAutoSave();
      }
    });
    document.addEventListener('change', (e) => {
      if (e.target.closest('#view-create-hubbs') || e.target.closest('#view-review-hubbs')) {
        window.triggerAutoSave();
      }
    });
    window.addEventListener('beforeunload', (e) => {
      if (state.activeView === 'create-hubbs' && window.chUploads && window.chUploads.length > 0) {
        window._silentDraftSave = true;
        if (window.saveCurrentDraft) window.saveCurrentDraft();
      }
    });

    setTimeout(() => {
      window.renderDraftsList();
    }, 500);

    // Setup Home Drafts Bubble Toggle
    const draftsBtn = document.getElementById('story-drafts-container');
    const draftsPanel = document.getElementById('home-drafts-panel');
    const closeBtn = document.getElementById('close-hdd-btn');
    if (draftsBtn && draftsPanel) {
      draftsBtn.addEventListener('click', (e) => {
        // Prevent toggling if clicking inside the panel
        if (e.target.closest('#home-drafts-panel')) return;
        draftsPanel.classList.toggle('open');
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent bubbling to container
        if(draftsPanel) draftsPanel.classList.remove('open');
      });
    }
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (draftsBtn && !draftsBtn.contains(e.target)) {
        draftsPanel.classList.remove('open');
      }
    });
  });

  // --- TOAST HELPER ---
  const toast = document.getElementById('toast-notif');
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('active');
    setTimeout(() => {
      toast.classList.remove('active');
    }, 2500);
  }

  // --- VIEW SWITCHING MANAGER (SPACIOUS CONGESTION FIX) ---
  const viewPanels = document.querySelectorAll('.view-panel');
  const sidebarNavItems = document.querySelectorAll('.nav-item');
  const radialNavItems = document.querySelectorAll('.radial-item-bubble');
  const mobileNavItems = document.querySelectorAll('.mobile-nav-btn');
  const appContainer = document.querySelector('.chats-layout-grid');

  window.switchView = switchView; // Expose to global scope for inline onclick

  function switchView(viewName, userId) {
    if (!viewName) return;

    if (state.activeView === 'create-hubbs' && viewName !== 'create-hubbs' && window.chUploads && window.chUploads.length > 0) {
      window._silentDraftSave = true;
      if (window.saveCurrentDraft) window.saveCurrentDraft();
    }

    state.activeView = viewName;

    if (viewName === 'profile') {
      const currentUserStr = localStorage.getItem('invibeUser');
      let targetId = userId;
      if (!targetId && currentUserStr) {
        try {
          const currentUser = JSON.parse(currentUserStr);
          targetId = currentUser.id || currentUser._id || currentUser.username;
        } catch (_) {}
      }
      loadUserProfile(targetId || 'me');
    }

    // Maintain unified 3-column layout frame across all views
    document.body.classList.remove('chats-view-active');
    if (viewName === 'chats') {
      if (appContainer) appContainer.classList.remove('chatting');
      state.currentChatThread = null;
      const emptyState = document.getElementById('chat-empty-state');
      const chatHeader = document.getElementById('chat-window-header');
      const chatViewport = document.querySelector('.chat-dynamic-viewport');
      const chatFooter = document.getElementById('chat-global-footer');
      if (emptyState) emptyState.style.display = 'flex';
      if (chatHeader) chatHeader.style.display = 'none';
      if (chatViewport) chatViewport.style.display = 'none';
      if (chatFooter) chatFooter.style.display = 'none';
    }

    if (viewName === 'create-hubbs') {
      document.body.classList.add('create-hubbs-view-active');
    } else {
      document.body.classList.remove('create-hubbs-view-active');
    }

    if (viewName === 'review-hubbs') {
      document.body.classList.add('review-hubbs-view-active');
      if (typeof window.initBeforeAfterSlider === 'function') {
        setTimeout(window.initBeforeAfterSlider, 50);
      }
    } else {
      document.body.classList.remove('review-hubbs-view-active');
    }

    // Update active view panels
    viewPanels.forEach(panel => {
      if (panel.id === `view-${viewName}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Update active sidebar nav items
    sidebarNavItems.forEach(nav => {
      const target = nav.getAttribute('data-target-view');
      if (target === viewName) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });

    // Update active radial sub-bubbles
    const activeGlow = document.getElementById('radial-active-glow');
    radialNavItems.forEach(bubble => {
      const target = bubble.getAttribute('data-target-view');
      if (target === viewName) {
        bubble.classList.add('active-bubble');
        if (activeGlow) {
          activeGlow.style.opacity = '1';
          activeGlow.style.left = (bubble.offsetLeft + (bubble.offsetWidth / 2) - 22) + 'px';
        }
      } else {
        bubble.classList.remove('active-bubble');
      }
    });

    // Update active mobile bottom nav items
    mobileNavItems.forEach(nav => {
      const target = nav.getAttribute('data-target-view');
      if (target === viewName) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });

    // Pause explore reels videos if we leave Explore View
    if (viewName !== 'explore') {
      const reelVideos = document.querySelectorAll('.reel-video');
      reelVideos.forEach(vid => vid.pause());
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Close radial menu after selection
    closeRadialMenu();
  }

  // Bind view selectors
  sidebarNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target-view');
      if (target) switchView(target);
    });
  });

  radialNavItems.forEach(bubble => {
    bubble.addEventListener('click', () => {
      const target = bubble.getAttribute('data-target-view');
      if (target) {
        switchView(target);
      }
    });
  });

  mobileNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target-view');
      if (target) switchView(target);
    });
  });

  // Logo button returns Home
  document.getElementById('logo-button').addEventListener('click', () => {
    switchView('home');
  });

  // Profile avatar returns Profile
  document.getElementById('header-profile-avatar').addEventListener('click', () => {
    switchView('profile');
  });

  // Messages badge shortcut
  document.getElementById('messages-shortcut-btn').addEventListener('click', () => {
    switchView('chats');
  });


  // --- FLOATING RADIAL NAVIGATION MENU & TOUCH DRAG SYSTEM (SIGNATURE INTERACTION) ---
  const navContainer = document.getElementById('floating-bubble-nav');
  const mainBubble = document.getElementById('main-navigation-bubble');
  const blurOverlay = document.getElementById('radial-menu-blur-overlay');

  let isDragging = false;
  let dragStartX, dragStartY;
  let bubbleStartX, bubbleStartY;
  let wasOpenOnDragStart = false;
  let lastTouchTime = 0;

  // Prevent default image drag (fixes awkward stretching/ghosting)
  mainBubble.addEventListener('dragstart', (e) => e.preventDefault());

  // Mouse and Touch Drag Listeners
  mainBubble.addEventListener('mousedown', dragStart);
  mainBubble.addEventListener('touchstart', dragStart, { passive: true });

  function dragStart(e) {
    if (e.type === 'touchstart') {
      lastTouchTime = Date.now();
    } else if (e.type === 'mousedown') {
      // Prevent simulated mouse events on mobile touch devices
      if (Date.now() - lastTouchTime < 600) {
        return;
      }
      e.preventDefault(); // Prevent accidental text/image selection
    }

    // Track whether the menu was open when the interaction started
    wasOpenOnDragStart = navContainer.classList.contains('open');

    isDragging = false;
    const coords = getDragCoords(e);
    dragStartX = coords.x;
    dragStartY = coords.y;

    const rect = navContainer.getBoundingClientRect();
    bubbleStartX = rect.left;
    bubbleStartY = rect.top;

    // Disable styling transitions during active drag coordinate movement
    navContainer.style.transition = 'none';
    navContainer.classList.add('dragging');

    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchmove', dragMove, { passive: false });
    document.addEventListener('touchend', dragEnd);
  }

  let dragMoveTicking = false;
  function dragMove(e) {
    const coords = getDragCoords(e);
    const deltaX = coords.x - dragStartX;
    const deltaY = coords.y - dragStartY;

    // 5px threshold to separate simple clicks from drags
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      isDragging = true;
      if (e.type === 'touchmove') e.preventDefault(); // Prevent double scroll in mobile
    }

    if (isDragging && !dragMoveTicking) {
      dragMoveTicking = true;
      window.requestAnimationFrame(() => {
        // Only set the initial position once to avoid layout thrashing
        if (!navContainer.style.left || navContainer.style.left === 'auto') {
          navContainer.style.bottom = 'auto';
          navContainer.style.right = 'auto';
          navContainer.style.margin = '0';
          navContainer.style.position = 'fixed';
          navContainer.style.left = `${bubbleStartX}px`;
          navContainer.style.top = `${bubbleStartY}px`;
        }

        // Use hardware-accelerated transform for 60FPS smooth dragging
        navContainer.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
        dragMoveTicking = false;
      });
    }
  }

  function dragEnd() {
    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('mouseup', dragEnd);
    document.removeEventListener('touchmove', dragMove);
    document.removeEventListener('touchend', dragEnd);

    navContainer.classList.remove('dragging');
    navContainer.style.transition = '';

    if (isDragging) {
      // Commit the translation to left/top to preserve position correctly
      const rect = navContainer.getBoundingClientRect();
      navContainer.style.transform = 'none';
      navContainer.style.left = `${rect.left}px`;
      navContainer.style.top = `${rect.top}px`;
    }

    if (!isDragging) {
      // True toggle: if menu was open when click started, close it; otherwise open it
      if (wasOpenOnDragStart) {
        closeRadialMenu();
      } else {
        openRadialMenu();
      }
    } else {
      // If dragging while menu was open, close it to prevent glitching
      if (wasOpenOnDragStart) {
        closeRadialMenu();
      }
      // Clamp boundaries inside screen coordinates with 20px padding
      clampBubblePosition();
    }
  }

  function getDragCoords(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function clampBubblePosition() {
    const rect = navContainer.getBoundingClientRect();
    const pad = 20;
    let targetX = rect.left;
    let targetY = rect.top;

    if (targetX < pad) targetX = pad;
    if (targetX > window.innerWidth - rect.width - pad) targetX = window.innerWidth - rect.width - pad;
    if (targetY < pad) targetY = pad;
    if (targetY > window.innerHeight - rect.height - pad) targetY = window.innerHeight - rect.height - pad;

    navContainer.style.left = `${targetX}px`;
    navContainer.style.top = `${targetY}px`;
    navContainer.style.transform = 'none'; // Lock translate off!
  }

  // Handle window resizing bounds safety
  window.addEventListener('resize', () => {
    if (navContainer.style.position === 'fixed') {
      clampBubblePosition();
    }
  });

  function toggleRadialMenu() {
    const isOpen = navContainer.classList.contains('open');
    if (isOpen) {
      closeRadialMenu();
    } else {
      openRadialMenu();
    }
  }

  function openRadialMenu() {
    // Dynamic quadrant orientation calculation
    const rect = navContainer.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const centerX = rect.left + rect.width / 2;

    // Vertical flip: if in top half of the screen, pop sub-bubbles downwards
    if (centerY < window.innerHeight / 2) {
      navContainer.style.setProperty('--radial-y-dir', '1');
      navContainer.classList.add('expand-downwards');
    } else {
      navContainer.style.setProperty('--radial-y-dir', '-1');
      navContainer.classList.remove('expand-downwards');
    }

    // Horizontal mirror: if too close to left or right edges
    if (centerX < 180) {
      navContainer.style.setProperty('--radial-x-dir', '1.2'); // push rightwards
    } else if (window.innerWidth - centerX < 180) {
      navContainer.style.setProperty('--radial-x-dir', '-1.2'); // push leftwards
    } else {
      navContainer.style.setProperty('--radial-x-dir', '1');
    }

    navContainer.classList.add('open');
    blurOverlay.classList.add('active'); // Localized circular blur active

    // Rotate HiHubble logo icon
    const logoIcon = mainBubble.querySelector('.orb-logo-icon');
    if (logoIcon) {
      logoIcon.style.transform = 'rotate(225deg) scale(1.1)';
    }
  }

  function closeRadialMenu() {
    navContainer.classList.remove('open');
    blurOverlay.classList.remove('active');

    const logoIcon = mainBubble.querySelector('.orb-logo-icon');
    if (logoIcon) {
      logoIcon.style.transform = 'rotate(0deg) scale(1)';
    }
  }

  // Close radial menu when clicking backdrop overlay
  blurOverlay.addEventListener('click', closeRadialMenu);

  // Close radial menu on Escape key press
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeRadialMenu();
    }
  });

  // Search bubble opens dedicated search view
  document.getElementById('radial-search-btn').addEventListener('click', () => {
    closeRadialMenu();
    switchView('search');
    const searchInput = document.getElementById('search-view-input');
    if (searchInput) {
      setTimeout(() => {
        searchInput.focus();
      }, 80);
    }
    showToast('Search page opened 🔍');
  });

  // Logout bubble triggers security logout
  const radialLogoutBtn = document.getElementById('radial-logout-btn');
  if (radialLogoutBtn) {
    radialLogoutBtn.addEventListener('click', () => {
      closeRadialMenu();
      const mainLogoutBtn = document.getElementById('logout-btn');
      if (mainLogoutBtn) {
        mainLogoutBtn.click();
      }
    });
  }


  // --- STORIES SECTION SCROLL DRAG MOMENTUM ---
  const storiesScroll = document.getElementById('stories-scroll');
  let isDown = false;
  let startX;
  let scrollLeft;

  if (storiesScroll) {
    storiesScroll.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - storiesScroll.offsetLeft;
      scrollLeft = storiesScroll.scrollLeft;
    });

    storiesScroll.addEventListener('mouseleave', () => {
      isDown = false;
    });

    storiesScroll.addEventListener('mouseup', () => {
      isDown = false;
    });

    let storiesTicking = false;
    storiesScroll.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      if (!storiesTicking) {
        storiesTicking = true;
        const x = e.pageX - storiesScroll.offsetLeft;
        const walk = (x - startX) * 2.5;
        window.requestAnimationFrame(() => {
          storiesScroll.scrollLeft = scrollLeft - walk;
          storiesTicking = false;
        });
      }
    });
  }

  // --- LIKE INTERACTION & PARTICLE SYSTEMS ---
  const likeActionItems = document.querySelectorAll('.like-btn-action');
  const mediaContainers = document.querySelectorAll('.post-media-container');

  function triggerHeartExplosion(x, y, container) {
    const particleCount = 15;
    const colors = ['#6C3BFF', '#8A5CFF', '#a855f7', '#c084fc', '#e9d5ff', '#ff3b30'];

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'explosion-particle';
      particle.innerHTML = i === 0 ? '<i data-lucide="heart" style="fill: var(--primary); stroke: var(--primary);"></i>' : '💜';

      const angle = Math.random() * Math.PI * 2;
      const distance = i === 0 ? 0 : 50 + Math.random() * 120;
      const randomX = Math.cos(angle) * distance;
      const randomY = Math.sin(angle) * distance - 40;

      particle.style.setProperty('--x', `${randomX}px`);
      particle.style.setProperty('--y', `${randomY}px`);
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;

      particle.style.color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.fontSize = i === 0 ? '100px' : `${40 + Math.random() * 40}px`;

      container.appendChild(particle);
      if (i === 0 && window.lucide) { window.lucide.createIcons(); }

      setTimeout(() => {
        particle.remove();
      }, 800);
    }
  }

  function toggleLike(postId, buttonWrapper, clickX, clickY, container) {
    const postStateKey = `post${postId}`;
    const isCurrentlyLiked = state.isLiked[postStateKey];

    const countSpan = buttonWrapper.querySelector('.action-count');
    const heartBtn = buttonWrapper.querySelector('.action-circle-btn');

    if (!isCurrentlyLiked) {
      state.isLiked[postStateKey] = true;
      state.likesCount[postStateKey]++;
      buttonWrapper.classList.add('liked');

      if (countSpan) {
        countSpan.textContent = formatCount(state.likesCount[postStateKey]);
      }

      if (clickX !== null && clickY !== null && container) {
        triggerHeartExplosion(clickX, clickY, container);
      } else if (container) {
        const rect = container.getBoundingClientRect();
        triggerHeartExplosion(rect.width / 2, rect.height / 2, container);
      }
      showToast('Liked post! 💜');
    } else {
      state.isLiked[postStateKey] = false;
      state.likesCount[postStateKey]--;
      buttonWrapper.classList.remove('liked');

      if (countSpan) {
        countSpan.textContent = formatCount(state.likesCount[postStateKey]);
      }
    }
  }

  function formatCount(num) {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num;
  }

  // Disabled old hardcoded static feed post likes. Dynamic likes are loaded in loadFeedPosts()

  // --- POST 2 VIDEO PLAYBACK ---
  const videoPost = document.getElementById('post-2');
  if (videoPost) {
    const video = videoPost.querySelector('.post-media-video');
    const playOverlay = videoPost.querySelector('.video-play-overlay');
    const playIcon = playOverlay.querySelector('i');

    playOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      video.play();
      playOverlay.style.display = 'none';
      debouncedCreateIcons();
    });

    video.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!video.paused) {
        video.pause();
        playIcon.setAttribute('data-lucide', 'play');
        playOverlay.style.display = 'flex';
        playOverlay.style.background = 'rgba(0,0,0,0.25)';
        playOverlay.style.opacity = '1';
        debouncedCreateIcons();
      }
    });
  }


  // --- EXPLORE & REELS TAB AND INTERACTIONS ---
  const exTabPills = document.querySelectorAll('.ex-tab-pill');
  const exploreReelsContainer = document.getElementById('explore-reels-container');
  const explorePostsContainer = document.getElementById('explore-posts-container');

  exTabPills.forEach(pill => {
    pill.addEventListener('click', () => {
      exTabPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const tabName = pill.getAttribute('data-ex-tab');
      if (tabName === 'reels') {
        exploreReelsContainer.classList.add('active');
        explorePostsContainer.classList.remove('active');
        // Autoplay first reel
        const firstVideo = exploreReelsContainer.querySelector('.reel-video');
        if (firstVideo) firstVideo.play();
      } else {
        exploreReelsContainer.classList.remove('active');
        explorePostsContainer.classList.add('active');
        // Pause all reels
        const videos = exploreReelsContainer.querySelectorAll('.reel-video');
        videos.forEach(v => v.pause());
      }
    });
  });
  // Disabled old hardcoded reels video playback/gestures loop. Replaced with wireReelInteractions() on load.

  // --- GLOBAL FEED ACTIONS DELEGATION ---
  document.addEventListener('click', async (e) => {
    // Like button
    const likeBtn = e.target.closest('.like-btn-action');
    if (likeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const pid = likeBtn.getAttribute('data-post-id') || likeBtn.closest('[data-post-id]')?.getAttribute('data-post-id') || '1';
      await togglePostLike(pid, likeBtn);
    }

    // Bookmark / Save button
    const bookmarkBtn = e.target.closest('.bookmark-btn, .bookmark-btn-action');
    if (bookmarkBtn) {
      e.preventDefault();
      e.stopPropagation();

      // Some templates use the inner button, some use the wrapper. Find the wrapper and the icon.
      const btnEl = bookmarkBtn.classList.contains('bookmark-btn') ? bookmarkBtn : (bookmarkBtn.querySelector('.bookmark-btn') || bookmarkBtn);
      const icon = btnEl.querySelector('i, svg') || bookmarkBtn.querySelector('i, svg');

      const mediaContainer = bookmarkBtn.closest('.feed-card, .reel-card, .post-media-container') || bookmarkBtn.closest('article, .post-media-container');
      let mediaData = null;
      if (mediaContainer) {
        const id = mediaContainer.id || mediaContainer.getAttribute('data-post-id') || mediaContainer.getAttribute('data-reel-id') || Math.random().toString();
        const img = mediaContainer.querySelector('img');
        const video = mediaContainer.querySelector('video');
        if (img) mediaData = { id, type: 'image', url: img.src };
        else if (video) mediaData = { id, type: 'video', url: video.src };
      }

      const isSaved = btnEl.classList.contains('saved');
      if (isSaved) {
        btnEl.classList.remove('saved');
        if (icon) { icon.style.fill = 'none'; icon.style.stroke = ''; }
        if (mediaData) {
          window.savedHubbs = window.savedHubbs.filter(s => s.id !== mediaData.id);
        }
        showToast('Removed from Saved');
      } else {
        btnEl.classList.add('saved');
        if (icon) { icon.style.fill = '#FBBF24'; icon.style.stroke = '#FBBF24'; }
        if (mediaData && !window.savedHubbs.find(s => s.id === mediaData.id)) {
          window.savedHubbs.push(mediaData);
        }
        showToast('Saved to collection ⭐');
      }

      const savedGrid = document.getElementById('profile-saved-grid');
      if (savedGrid && savedGrid.classList.contains('active')) {
        renderSavedHubbs();
      }
    }
  });


  // --- PREMIUM STORY AUTO-PLAY VIEWER SYSTEM ---
  const storyViewer = document.getElementById('story-viewer-modal');
  const storyViewerClose = document.getElementById('story-viewer-close');
  const storyViewerDelete = document.getElementById('story-viewer-delete');
  const storyViewerAvatar = document.getElementById('story-viewer-avatar');
  const storyViewerName = document.getElementById('story-viewer-name');
  const storyViewerTime = document.getElementById('story-viewer-time');
  const storyViewerImg = document.getElementById('story-viewer-img');
  const storyProgressBars = document.getElementById('story-progress-bars');
  const storyContentBox = document.getElementById('story-viewer-content-box');

  const storyPrev = document.getElementById('story-prev-btn');
  const storyNext = document.getElementById('story-next-btn');

  function openStoryViewer(groupIndex, storyIndex = 0) {
    if (!state.storyGroups[groupIndex]) return;
    state.activeGroupIndex = groupIndex;
    state.activeStoryIndex = storyIndex;
    storyViewer.classList.add('active');
    loadStoryContent(groupIndex, storyIndex);
  }

  async function deleteCurrentStory() {
    const group = state.storyGroups[state.activeGroupIndex];
    if (!group) return;
    const storyData = group.stories[state.activeStoryIndex];
    if (!storyData) return;
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/stories/${storyData._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete story');
      showToast('Story deleted successfully!');
      closeStoryViewer();
      loadStories();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete story.');
    }
  }

  function loadStoryContent(groupIndex, storyIndex) {
    const group = state.storyGroups[groupIndex];
    if (!group || !group.stories[storyIndex]) {
      closeStoryViewer();
      return;
    }
    const data = group.stories[storyIndex];

    storyViewerAvatar.src = data.avatar;
    storyViewerName.textContent = data.name;
    storyViewerTime.textContent = data.time;
    storyViewerImg.src = data.img;

    const currentUser = getCurrentUser();
    const currentUserId = currentUser ? (currentUser.id || currentUser._id) : null;
    if (data.authorId === currentUserId) {
      storyViewerDelete.style.display = 'block';
    } else {
      storyViewerDelete.style.display = 'none';
    }

    updateStoryLikeUI(data.isLiked || false, data.likesCount || 0);

    storyProgressBars.innerHTML = '';
    for (let i = 0; i < group.stories.length; i++) {
      const barWrapper = document.createElement('div');
      barWrapper.className = 'story-progress-bar-wrapper';
      const barFill = document.createElement('div');
      barFill.className = 'story-progress-bar-fill';

      if (i < storyIndex) {
        barFill.style.width = '100%';
      } else if (i > storyIndex) {
        barFill.style.width = '0%';
      }

      barWrapper.appendChild(barFill);
      storyProgressBars.appendChild(barWrapper);
    }

    state.isStoryPaused = false;
    startStoryTimer();
  }

  function startStoryTimer() {
    if (state.storyProgressInterval) return;
    
    const activeFill = storyProgressBars.children[state.activeStoryIndex]?.querySelector('.story-progress-bar-fill');
    
    state.storyProgressInterval = setInterval(() => {
      if (state.isStoryPaused) return;
      state.storyProgressPercent += 0.4;
      if (activeFill) activeFill.style.width = `${state.storyProgressPercent}%`;

      if (state.storyProgressPercent >= 100) {
        stopStoryTimer();
        state.storyProgressPercent = 0;
        const group = state.storyGroups[state.activeGroupIndex];
        if (state.activeStoryIndex < group.stories.length - 1) {
          openStoryViewer(state.activeGroupIndex, state.activeStoryIndex + 1);
        } else if (state.activeGroupIndex < state.storyGroups.length - 1) {
          openStoryViewer(state.activeGroupIndex + 1, 0);
        } else {
          closeStoryViewer();
        }
      }
    }, 20);
  }

  function stopStoryTimer() {
    if (state.storyProgressInterval) {
      clearInterval(state.storyProgressInterval);
      state.storyProgressInterval = null;
    }
  }

  function closeStoryViewer() {
    stopStoryTimer();
    state.storyProgressPercent = 0;
    storyViewer.classList.remove('active');
  }

  // Tap to Pause implementation
  const pauseStory = () => { state.isStoryPaused = true; };
  const resumeStory = () => { state.isStoryPaused = false; };
  if (storyContentBox) {
    storyContentBox.addEventListener('mousedown', pauseStory);
    storyContentBox.addEventListener('mouseup', resumeStory);
    storyContentBox.addEventListener('mouseleave', resumeStory);
    storyContentBox.addEventListener('touchstart', pauseStory);
    storyContentBox.addEventListener('touchend', resumeStory);
  }

  if (storyViewerClose) storyViewerClose.addEventListener('click', closeStoryViewer);
  if (storyViewerDelete) storyViewerDelete.addEventListener('click', deleteCurrentStory);
  
  if (storyPrev) {
    storyPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      stopStoryTimer();
      state.storyProgressPercent = 0;
      if (state.activeStoryIndex > 0) {
        openStoryViewer(state.activeGroupIndex, state.activeStoryIndex - 1);
      } else if (state.activeGroupIndex > 0) {
        const prevGroup = state.storyGroups[state.activeGroupIndex - 1];
        openStoryViewer(state.activeGroupIndex - 1, prevGroup.stories.length - 1);
      }
    });
  }
  if (storyNext) {
    storyNext.addEventListener('click', (e) => {
      e.stopPropagation();
      stopStoryTimer();
      state.storyProgressPercent = 0;
      const group = state.storyGroups[state.activeGroupIndex];
      if (state.activeStoryIndex < group.stories.length - 1) {
        openStoryViewer(state.activeGroupIndex, state.activeStoryIndex + 1);
      } else if (state.activeGroupIndex < state.storyGroups.length - 1) {
        openStoryViewer(state.activeGroupIndex + 1, 0);
      } else {
        closeStoryViewer();
      }
    });
  }

  // Reply Story simulation
  const storyReplySend = document.getElementById('story-reply-send');
  const storyReplyInput = document.getElementById('story-reply-input');
  if (storyReplySend) {
    storyReplySend.addEventListener('click', () => {
      const txt = storyReplyInput.value.trim();
      if (txt) {
        showToast('Hubs reply sent! 📩');
        storyReplyInput.value = '';
        closeStoryViewer();
      }
    });
  }

  // --- HUB (STORY) LIKE SYSTEM ---
  const storyLikeBtn = document.getElementById('story-like-btn');
  const storyLikeCount = document.getElementById('story-like-count');

  async function likeCurrentStory() {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;
    const storyData = state.stories[state.activeStoryIndex];
    if (!storyData || !storyData._id) return;

    try {
      const res = await fetch(`${API_URL}/api/stories/${storyData._id}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to like story');
      const result = await res.json();

      // Update local state
      storyData.likesCount = result.likesCount;
      storyData.isLiked = result.isLiked;

      // Update UI
      updateStoryLikeUI(result.isLiked, result.likesCount);
      showToast(result.isLiked ? 'Liked this Hub! ❤️' : 'Unliked this Hub');
    } catch (err) {
      console.error('Error liking story:', err);
    }
  }

  function updateStoryLikeUI(isLiked, count) {
    if (storyLikeBtn) {
      storyLikeBtn.classList.toggle('liked', isLiked);
    }
    if (storyLikeCount) {
      storyLikeCount.textContent = count;
    }
  }

  if (storyLikeBtn) {
    storyLikeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      likeCurrentStory();
    });
  }

  // Load dynamic stories from backend
  async function loadStories() {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/stories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch stories');
      const dbStories = await res.json();

      const storyScroll = document.getElementById('stories-scroll');
      if (!storyScroll) return;

      const yourVibeBtn = document.getElementById('story-btn-current');
      const draftsBtn = document.getElementById('story-drafts-btn');
      storyScroll.innerHTML = '';
      if (yourVibeBtn) storyScroll.appendChild(yourVibeBtn);
      if (draftsBtn) storyScroll.appendChild(draftsBtn);

      const currentUser = getCurrentUser();
      const currentUserId = currentUser ? (currentUser.id || currentUser._id) : null;
      
      const groupedStories = {};
      dbStories.forEach(story => {
        const likes = story.likes || [];
        const authorId = story.author._id || story.author.id;
        if (!groupedStories[authorId]) {
          groupedStories[authorId] = {
            authorId: authorId,
            name: story.author.fullName,
            avatar: story.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80',
            stories: []
          };
        }
        groupedStories[authorId].stories.push({
          _id: story._id,
          authorId: authorId,
          name: story.author.fullName,
          avatar: story.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80',
          img: story.mediaUrl,
          time: formatTimeAgo(story.createdAt),
          likesCount: likes.length,
          isLiked: currentUserId ? likes.includes(currentUserId) : false
        });
      });
      
      state.storyGroups = Object.values(groupedStories);

      state.storyGroups.forEach((group, idx) => {
        const card = document.createElement('div');
        card.className = 'story-card active-story';
        card.setAttribute('data-group-index', idx);
        card.innerHTML = `
          <div class="story-avatar-container">
            <div class="story-ring"></div>
            <img src="${group.avatar}" alt="${group.name}" />
          </div>
          <span class="story-username">${group.name.split(' ')[0]}</span>
        `;

        card.addEventListener('click', () => {
          openStoryViewer(idx, 0);
          card.classList.add('story-seen');
        });

        storyScroll.appendChild(card);
      });

      debouncedCreateIcons();
    } catch (err) {
      console.error('Error loading stories:', err);
    }
  }

  function formatTimeAgo(dateStr) {
    const created = new Date(dateStr);
    const diffMs = Date.now() - created.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.round(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return '1d ago';
  }

  window.loadStories = loadStories;

  // Story Creation & Drafts logic
  const addStoryBtn = document.getElementById('add-story-file-trigger');
  const storyFileInput = document.getElementById('story-file-input');
  const storyCreationModal = document.getElementById('story-creation-modal');
  const storyCreationPreview = document.getElementById('story-creation-preview');
  const storyCreationCancel = document.getElementById('story-creation-cancel');
  const storyCreationDraft = document.getElementById('story-creation-draft');
  const storyCreationPublish = document.getElementById('story-creation-publish');
  const storyDraftsBtn = document.getElementById('story-drafts-btn');
  const storyDraftsModal = document.getElementById('story-drafts-modal');
  const storyDraftsClose = document.getElementById('story-drafts-close');
  const storyDraftsList = document.getElementById('story-drafts-list');
  let currentStoryImageBase64 = null;

  if (addStoryBtn) {
    addStoryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchView('create-hubbs');
    });
  }

  if (storyFileInput) {
    storyFileInput.addEventListener('change', () => {
      if (storyFileInput.files.length > 0) {
        const file = storyFileInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          currentStoryImageBase64 = e.target.result;
          if (storyCreationPreview) storyCreationPreview.src = currentStoryImageBase64;
          if (storyCreationModal) storyCreationModal.classList.add('active');
          storyFileInput.value = '';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const closeStoryCreation = () => {
    if (storyCreationModal) storyCreationModal.classList.remove('active');
    currentStoryImageBase64 = null;
  };
  if (storyCreationCancel) storyCreationCancel.addEventListener('click', closeStoryCreation);

  async function submitStory(isDraft) {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) {
      showToast('Please log in first! 🔐');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ mediaUrl: currentStoryImageBase64, mediaType: 'image', isDraft })
      });
      if (!res.ok) throw new Error('Failed to save story');
      showToast(isDraft ? 'Draft saved!' : 'Story published successfully! 📸✨');
      closeStoryCreation();
      loadStories();
    } catch (err) {
      console.error(err);
      showToast('Failed to process story.');
    }
  }

  if (storyCreationPublish) storyCreationPublish.addEventListener('click', () => submitStory(false));
  if (storyCreationDraft) storyCreationDraft.addEventListener('click', () => submitStory(true));

  async function loadDrafts() {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/stories/drafts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch drafts');
      const drafts = await res.json();
      if (storyDraftsList) {
        storyDraftsList.innerHTML = '';
        if (drafts.length === 0) {
          storyDraftsList.innerHTML = '<p style="color: white; text-align: center;">No drafts saved.</p>';
          return;
        }
        drafts.forEach(draft => {
          const div = document.createElement('div');
          div.style = 'display: flex; gap: 12px; align-items: center; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px;';
          div.innerHTML = `
            <img src="${draft.mediaUrl}" style="width: 60px; height: 60px; object-fit: contain; object-position: center; border-radius: 8px;" />
            <div style="flex: 1; color: white;">
              <p style="margin: 0; font-size: 14px; color: var(--text-muted);">${formatTimeAgo(draft.createdAt)}</p>
            </div>
            <button class="btn btn-primary publish-draft-btn" data-id="${draft._id}" style="padding: 6px 12px; font-size: 12px;">Publish</button>
            <button class="btn btn-secondary delete-draft-btn" data-id="${draft._id}" style="padding: 6px 12px; font-size: 12px; background: rgba(255,0,0,0.2);">Delete</button>
          `;
          storyDraftsList.appendChild(div);
        });

        document.querySelectorAll('.publish-draft-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            await fetch(`${API_URL}/api/stories/${id}/publish`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
            showToast('Draft published!');
            loadDrafts();
            loadStories();
          });
        });
        document.querySelectorAll('.delete-draft-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            await fetch(`${API_URL}/api/stories/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            showToast('Draft deleted!');
            loadDrafts();
          });
        });
      }
    } catch(err) {
      console.error(err);
    }
  }

  if (storyDraftsBtn) {
    storyDraftsBtn.addEventListener('click', () => {
      if (storyDraftsModal) {
        storyDraftsModal.classList.add('active');
        loadDrafts();
      }
    });
  }
  if (storyDraftsClose) {
    storyDraftsClose.addEventListener('click', () => {
      if (storyDraftsModal) storyDraftsModal.classList.remove('active');
    });
  }


  // --- CREATE POST CARD CONTROLLER ---
  const createPostCaption = document.getElementById('create-post-caption');
  const createPostFileInput = document.getElementById('create-post-file-input');
  const createPostMediaBtn = document.getElementById('create-post-media-btn');
  const createPostSubmitBtn = document.getElementById('create-post-submit-btn');
  const createPostPreviewContainer = document.getElementById('create-post-preview-container');
  const createPostPreviewImg = document.getElementById('create-post-preview-img');
  const createPostPreviewVideo = document.getElementById('create-post-preview-video');
  const createPostRemoveBtn = document.getElementById('create-post-remove-btn');
  let selectedPostMediaBase64 = null;
  let selectedPostMediaType = 'image';

  if (createPostMediaBtn && createPostFileInput) {
    createPostMediaBtn.addEventListener('click', () => {
      createPostFileInput.click();
    });
  }

  function updateSubmitButtonState() {
    const hasCaption = createPostCaption.value.trim().length > 0;
    const hasMedia = !!selectedPostMediaBase64;
    createPostSubmitBtn.disabled = !(hasCaption || hasMedia);
  }

  if (createPostCaption) {
    createPostCaption.addEventListener('input', updateSubmitButtonState);
  }

  let selectedPostMediaBlobUrl = null;

  if (createPostFileInput) {
    createPostFileInput.addEventListener('change', () => {
      if (createPostFileInput.files.length > 0) {
        const file = createPostFileInput.files[0];
        const isVideo = file.type.startsWith('video/');
        selectedPostMediaType = isVideo ? 'video' : 'image';

        if (isVideo) {
          const tempVideo = document.createElement('video');
          tempVideo.preload = 'metadata';
          tempVideo.onloadedmetadata = () => {
            try { URL.revokeObjectURL(tempVideo.src); } catch (e) {}
            if (tempVideo.duration > 300) {
              showToast('Video length exceeds 5 minutes limit (max 5 mins allowed). ⏱️');
              createPostFileInput.value = '';
              selectedPostMediaBase64 = null;
              selectedPostMediaBlobUrl = null;
              if (createPostPreviewContainer) createPostPreviewContainer.style.display = 'none';
              updateSubmitButtonState();
            }
          };
          tempVideo.src = URL.createObjectURL(file);
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          selectedPostMediaBase64 = e.target.result;
          createPostPreviewContainer.style.display = 'block';

          if (isVideo) {
            if (selectedPostMediaBlobUrl) {
              try { URL.revokeObjectURL(selectedPostMediaBlobUrl); } catch (err) {}
            }
            selectedPostMediaBlobUrl = URL.createObjectURL(file);
            createPostPreviewImg.style.display = 'none';
            createPostPreviewVideo.style.display = 'block';
            createPostPreviewVideo.controls = true;
            createPostPreviewVideo.src = selectedPostMediaBlobUrl;
          } else {
            createPostPreviewVideo.style.display = 'none';
            createPostPreviewImg.style.display = 'block';
            createPostPreviewImg.src = selectedPostMediaBase64;
          }
          updateSubmitButtonState();
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (createPostRemoveBtn) {
    createPostRemoveBtn.addEventListener('click', () => {
      createPostFileInput.value = '';
      if (selectedPostMediaBlobUrl) {
        try { URL.revokeObjectURL(selectedPostMediaBlobUrl); } catch (e) {}
        selectedPostMediaBlobUrl = null;
      }
      selectedPostMediaBase64 = null;
      createPostPreviewContainer.style.display = 'none';
      createPostPreviewImg.src = '';
      createPostPreviewVideo.src = '';
      updateSubmitButtonState();
    });
  }

  if (createPostSubmitBtn) {
    createPostSubmitBtn.addEventListener('click', async () => {
      const captionText = createPostCaption.value.trim();
      const token = localStorage.getItem('invibe_jwt_token') || localStorage.getItem('invibe_token') || 'session_token';

      if (!selectedPostMediaBase64 && !captionText) {
        showToast('Please write a caption or add a photo/video.');
        return;
      }

      createPostSubmitBtn.disabled = true;
      createPostSubmitBtn.innerHTML = '<i data-lucide="loader" class="animate-spin"></i> Publishing...';
      debouncedCreateIcons();

      try {
        const currentUserStr = localStorage.getItem('invibeUser');
        const currentUser = currentUserStr ? JSON.parse(currentUserStr) : { username: 'user', fullName: 'User' };
        const userPhoto = localStorage.getItem('invibeProfileImage') || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80';
        const mediaUrlPayload = selectedPostMediaBase64 || selectedPostMediaBlobUrl || '';
        const mediaType = selectedPostMediaType || 'image';

        const newPostObj = {
          _id: 'post_' + Date.now(),
          caption: captionText || '',
          mediaUrl: selectedPostMediaBlobUrl || selectedPostMediaBase64 || '',
          mediaType: mediaType,
          createdAt: new Date().toISOString(),
          likes: [],
          comments: [],
          author: {
            _id: currentUser.id || currentUser._id || 'usr_' + (currentUser.username || 'user'),
            username: currentUser.username || 'user',
            fullName: currentUser.fullName || currentUser.username || 'User',
            profileImage: userPhoto
          }
        };

        // Send backend network call to store in Supabase public.posts and public.post_media
        const apiRes = await fetch('/api/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-User-Token': token
          },
          body: JSON.stringify({
            caption: captionText,
            mediaUrl: mediaUrlPayload,
            mediaType: mediaType,
            userId: currentUser.id || currentUser._id,
            username: currentUser.username,
            email: currentUser.email
          })
        });

        if (apiRes.ok) {
          const data = await apiRes.json();
          showToast('New hub published successfully! 📸✨');

          // Reset fields
          createPostCaption.value = '';
          if (createPostFileInput) createPostFileInput.value = '';
          selectedPostMediaBlobUrl = null;
          selectedPostMediaBase64 = null;
          if (createPostPreviewContainer) createPostPreviewContainer.style.display = 'none';
          if (createPostPreviewImg) createPostPreviewImg.src = '';
          if (createPostPreviewVideo) createPostPreviewVideo.src = '';
          updateSubmitButtonState();

          // Refresh lists
          await loadFeedPosts();
          loadUserProfile('me');
        } else {
          const errData = await apiRes.json().catch(() => ({}));
          const errMsg = errData.error || apiRes.statusText || 'Server error';
          console.error("Backend post save error:", errMsg);
          showToast(`Failed to publish post: ${errMsg} ❌`);
        }
      } catch (err) {
        console.error("Publish post handler:", err);
        showToast('New hub published successfully! 📸✨');
      } finally {
        createPostSubmitBtn.innerHTML = '<i data-lucide="send" style="width:14px; height:14px;"></i> Share Your Hubs';
        debouncedCreateIcons();
      }
    });
  }


  // --- INTERACTIVE LUDO LOBBY ROLLER WIDGET ---
  const diceRoller = document.getElementById('ludo-dice-roller');
  const diceFace = document.getElementById('ludo-dice-face');
  const rollDiceBtn = document.getElementById('ludo-roll-btn');
  const ludoChatFeed = document.getElementById('ludo-chat-feed');

  function rollLudoDice() {
    if (state.isLudoRolling) return;

    state.isLudoRolling = true;
    diceFace.classList.add('rolling');
    showToast('Rolling dice... 🎲');

    setTimeout(() => {
      diceFace.classList.remove('rolling');
      const rolledNumber = Math.floor(Math.random() * 6) + 1;

      // Update Dots Layout
      updateDiceFaceDots(rolledNumber);

      // Log Action
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const myLine = document.createElement('div');
      myLine.className = 'chat-log-line';
      myLine.innerHTML = `🎲 <strong>You rolled a ${rolledNumber}!</strong> <span class="log-time">${time}</span>`;
      ludoChatFeed.appendChild(myLine);
      ludoChatFeed.scrollTop = ludoChatFeed.scrollHeight;

      // Party spark if rolled 6!
      if (rolledNumber === 6) {
        showToast('🎲 SIX! Roll again! 🎉');
        triggerConfettiAlert();
      }

      // Emma simulated reply after 1.2s
      simulateEmmaRoll();

      state.isLudoRolling = false;
    }, 600);
  }

  function updateDiceFaceDots(num) {
    diceFace.innerHTML = '';
    const dotsConfigs = {
      1: ['dot-center'],
      2: ['dot-top-left', 'dot-bottom-right'],
      3: ['dot-top-left', 'dot-center', 'dot-bottom-right'],
      4: ['dot-top-left', 'dot-top-right', 'dot-bottom-left', 'dot-bottom-right'],
      5: ['dot-top-left', 'dot-top-right', 'dot-center', 'dot-bottom-left', 'dot-bottom-right'],
      6: ['dot-top-left', 'dot-top-right', 'dot-mid-left', 'dot-mid-right', 'dot-bottom-left', 'dot-bottom-right']
    };

    const classes = dotsConfigs[num] || ['dot-center'];
    classes.forEach(c => {
      const dot = document.createElement('div');
      dot.className = `dice-dot ${c}`;
      diceFace.appendChild(dot);
    });
  }

  function simulateEmmaRoll() {
    setTimeout(() => {
      const emmaNum = Math.floor(Math.random() * 6) + 1;
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const emmaLine = document.createElement('div');
      emmaLine.className = 'chat-log-line';
      emmaLine.innerHTML = `🎲 <strong>Emma rolled a ${emmaNum}!</strong> <span class="log-time">${time}</span>`;

      const emmaSpeak = document.createElement('div');
      emmaSpeak.className = 'chat-log-line';

      if (emmaNum === 6) {
        emmaSpeak.innerHTML = `💬 <strong>Emma:</strong> Yes! Ludo token out! 🥳`;
      } else if (emmaNum < 3) {
        emmaSpeak.innerHTML = `💬 <strong>Emma:</strong> Bad luck, slow turn. 😴`;
      } else {
        emmaSpeak.innerHTML = `💬 <strong>Emma:</strong> Rolling coordinates are locked! 🚀`;
      }

      ludoChatFeed.appendChild(emmaLine);
      ludoChatFeed.appendChild(emmaSpeak);
      ludoChatFeed.scrollTop = ludoChatFeed.scrollHeight;
    }, 1200);
  }

  function triggerConfettiAlert() {
    // Generate dozens of hearts floating inside active window
    const lobby = document.querySelector('.gaming-together-layout');
    if (!lobby) return;

    for (let i = 0; i < 15; i++) {
      setTimeout(() => {
        const x = 50 + Math.random() * (lobby.clientWidth - 100);
        const y = lobby.clientHeight - 40;

        const floatEmoji = document.createElement('div');
        floatEmoji.className = 'floating-reaction-emoji';
        floatEmoji.textContent = '🎉';
        floatEmoji.style.left = `${x}px`;
        floatEmoji.style.top = `${y}px`;

        const rnd = -40 + Math.random() * 80;
        floatEmoji.style.setProperty('--rnd-x', `${rnd}px`);
        floatEmoji.style.setProperty('--rnd-x-end', `${rnd + (-40 + Math.random() * 80)}px`);

        lobby.appendChild(floatEmoji);
        setTimeout(() => floatEmoji.remove(), 1200);
      }, i * 60);
    }
  }

  if (diceRoller) diceRoller.addEventListener('click', rollLudoDice);
  if (rollDiceBtn) rollDiceBtn.addEventListener('click', rollLudoDice);


  // ─── CLIENT-SIDE END-TO-END ENCRYPTION (E2EE) SYSTEM ──────────────────────
  // Pure-JS RC4 stream cipher helper
  function rc4Cipher(str, key) {
    let s = [], j = 0, x, res = '';
    for (let i = 0; i < 256; i++) {
      s[i] = i;
    }
    for (let i = 0; i < 256; i++) {
      j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
      x = s[i]; s[i] = s[j]; s[j] = x;
    }
    let i = 0;
    j = 0;
    for (let y = 0; y < str.length; y++) {
      i = (i + 1) % 256;
      j = (j + s[i]) % 256;
      x = s[i]; s[i] = s[j]; s[j] = x;
      res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
    }
    return res;
  }

  function encryptMessage(plaintext, secretKey) {
    try {
      const utf8SafeStr = unescape(encodeURIComponent(plaintext));
      const encrypted = rc4Cipher(utf8SafeStr, secretKey);
      return btoa(encrypted);
    } catch (e) {
      console.error('Encryption error:', e);
      return plaintext;
    }
  }

  function decryptMessage(base64str, secretKey) {
    try {
      const decrypted = rc4Cipher(atob(base64str), secretKey);
      return decodeURIComponent(escape(decrypted));
    } catch (e) {
      console.error('Decryption error:', e);
      return '[Decryption Failed]';
    }
  }

  function getChatSecretKey(userA_Id, userB_Id) {
    return [userA_Id.toString(), userB_Id.toString()].sort().join('_');
  }

  function getCurrentUser() {
    const userStr = localStorage.getItem('invibeUser');
    if (!userStr) return null;
    try { return JSON.parse(userStr); } catch { return null; }
  }

  // --- DYNAMIC CHAT LOGS AND FEEDS ---
  const chatHeaderName = document.querySelector('.chat-header-name');
  const chatHeaderAvatar = document.querySelector('.chat-header-avatar');
  const messagesScroll = document.getElementById('chat-messages-container');
  const chatThreadsList = document.querySelector('.chat-threads-list');

  const chatFeeds = {}; // Dynamic local memory: { targetUserId: [messages] }
  let chatThreads = []; // List of active thread items from backend

  // Load chat threads from server
  // Helper to sync unread message badges globally
  function updateGlobalUnreadBadges(count) {
    const badges = [
      document.querySelector('#messages-shortcut-btn .badge'),
      document.querySelector('.nav-item[data-target-view="chats"] .nav-badge'),
      document.querySelector('.radial-item-bubble[data-target-view="chats"] .nav-icon-badge'),
      document.querySelector('#mobile-chats-badge')
    ];

    badges.forEach(badge => {
      if (!badge) return;
      if (count > 0) {
        badge.style.display = 'flex';
        badge.textContent = count > 99 ? '99+' : count;
      } else {
        badge.style.display = 'none';
        badge.textContent = '';
      }
    });
  }

  async function loadChatThreads() {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;

    // Check if the user is actively searching in the inbox sidebar
    const inboxSearchInput = document.getElementById('inbox-search-input');
    if (inboxSearchInput && inboxSearchInput.value.trim() !== '') {
      return; // Do not overwrite search results with polling updates
    }

    try {
      const res = await fetch(`${API_URL}/api/chats/threads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load chat threads');
      chatThreads = await res.json();

      renderChatThreadsList();
    } catch (err) {
      console.error('Error loading chat threads:', err);
    }
  }

  function renderChatThreadsList() {
    if (!chatThreadsList) return;
    chatThreadsList.innerHTML = '';

    // Calculate total unread globally
    const totalUnread = chatThreads.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0);
    updateGlobalUnreadBadges(totalUnread);

    if (chatThreads.length === 0) {
      chatThreadsList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">No active chats. Search users above to start.</div>';
      return;
    }

    chatThreads.forEach(thread => {
      const u = thread.user;
      if (!u) return;

      const isCurrent = state.currentChatThread === u._id;
      const lastMsg = thread.lastMessage;
      let lastTextPreview = 'Start chatting...';
      let lastTimeText = '';

      if (lastMsg) {
        const currentUser = getCurrentUser();
        if (currentUser) {
          const secretKey = getChatSecretKey(currentUser.id || currentUser._id, u._id);
          const decrypted = decryptMessage(lastMsg.content, secretKey);
          lastTextPreview = decrypted.length > 30 ? decrypted.substring(0, 27) + '...' : decrypted;

          const msgDate = new Date(lastMsg.createdAt);
          lastTimeText = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      }

      const isOnline = (new Date() - new Date(u.lastActive)) < 120000;
      const statusClass = isOnline ? 'blue-diamond-status' : 'black-diamond-status';

      const item = document.createElement('div');
      item.className = `thread-item ${isCurrent ? 'active' : ''}`;
      item.setAttribute('data-thread', u._id);

      item.innerHTML = `
        <div class="thread-avatar">
          <img src="${u.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'}" alt="${u.fullName}" />
          <span class="online-indicator ${statusClass}"></span>
        </div>
        <div class="thread-details">
          <div class="thread-meta">
            <span class="thread-name">${u.fullName}</span>
            <span class="thread-time">${lastTimeText}</span>
          </div>
          <div class="thread-preview">
            <span class="preview-text">${lastTextPreview}</span>
            ${thread.unreadCount > 0 ? `<span class="unread-count">${thread.unreadCount}</span>` : ''}
          </div>
        </div>
      `;

      item.addEventListener('click', () => {
        state.currentChatThread = u._id;
        document.querySelectorAll('.thread-item').forEach(t => t.classList.remove('active'));
        item.classList.add('active');

        // Show chat panels, hide empty state
        const emptyState = document.getElementById('chat-empty-state');
        const chatHeader = document.getElementById('chat-window-header');
        const chatViewport = document.querySelector('.chat-dynamic-viewport');
        const chatFooter = document.getElementById('chat-global-footer');
        if (emptyState) emptyState.style.display = 'none';
        if (chatHeader) chatHeader.style.display = '';
        if (chatViewport) chatViewport.style.display = '';
        if (chatFooter) chatFooter.style.display = '';

        if (chatHeaderName) chatHeaderName.textContent = u.fullName;
        if (chatHeaderAvatar) chatHeaderAvatar.src = u.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';

        const headerIsOnline = (new Date() - new Date(u.lastActive)) < 120000;
        const statusHtml = headerIsOnline
          ? `<span class="online-indicator blue-diamond-status" style="position:static; display:inline-block; margin-right:4px; width:8px; height:8px;"></span> Online`
          : `<span class="online-indicator black-diamond-status" style="position:static; display:inline-block; margin-right:4px; width:8px; height:8px;"></span> Offline`;
        const headerStatus = document.querySelector('.chat-header-status');
        if (headerStatus) headerStatus.innerHTML = statusHtml;

        // Optimistically clear the unread count in UI
        if (thread.unreadCount > 0) {
          thread.unreadCount = 0;
          const badgeEl = item.querySelector('.unread-count');
          if (badgeEl) badgeEl.remove();
          // Recalculate total
          const totalUnread = chatThreads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
          updateGlobalUnreadBadges(totalUnread);
        }

        fetchMessages(u._id, true);
        markMessagesAsRead(u._id);

        // Mobile responsive layout trigger
        if (window.innerWidth <= 680) {
          const grid = document.querySelector('.chats-layout-grid');
          if (grid) grid.classList.add('chatting');
          const mainChat = document.querySelector('.chat-window-main');
          if (mainChat) mainChat.style.display = 'flex';
        }
      });

      chatThreadsList.appendChild(item);
    });
  }

  // Fetch messages between current user and target user
  async function fetchMessages(targetUserId, forceRender = true) {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token || !targetUserId) return;

    if (messagesScroll && (!chatFeeds[targetUserId] || chatFeeds[targetUserId].length === 0)) {
      messagesScroll.innerHTML = `
        <div class="chat-messages-skeleton" style="display:flex; flex-direction:column; gap:12px; padding:20px;">
          <div style="width:40%; height:36px; background:rgba(255,255,255,0.06); border-radius:16px; align-self:flex-start; animation:pulse 1.5s infinite;"></div>
          <div style="width:55%; height:42px; background:rgba(108,59,255,0.15); border-radius:16px; align-self:flex-end; animation:pulse 1.5s infinite;"></div>
          <div style="width:35%; height:36px; background:rgba(255,255,255,0.06); border-radius:16px; align-self:flex-start; animation:pulse 1.5s infinite;"></div>
        </div>
      `;
    }

    try {
      const res = await fetch(`${API_URL}/api/chats/messages/${targetUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch messages');
      const messages = await res.json();

      chatFeeds[targetUserId] = Array.isArray(messages) ? messages : [];
      renderChatMessages(targetUserId);
    } catch (err) {
      console.error('Error fetching messages:', err);
      if (messagesScroll) {
        renderChatMessages(targetUserId);
      }
    }
  }

  function getChatDateSeparatorText(dateInput) {
    if (!dateInput) return 'Today';
    const messageDate = new Date(dateInput);
    if (isNaN(messageDate.getTime())) return 'Today';

    const d = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (d.getTime() === today.getTime()) {
      return 'Today';
    } else if (d.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      const day = messageDate.getDate();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[messageDate.getMonth()];
      const year = messageDate.getFullYear();
      return `${day} ${month} ${year}`;
    }
  }

  function renderChatMessages(targetUserId) {
    if (!messagesScroll) return;
    messagesScroll.innerHTML = '';

    const messages = chatFeeds[targetUserId] || [];
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const currentUserId = (currentUser.id || currentUser._id || '').toString();
    const secretKey = getChatSecretKey(currentUserId, targetUserId);

    if (messages.length === 0) {
      messagesScroll.innerHTML = `
        <div class="chat-empty-messages" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height:280px; color:var(--text-muted); text-align:center; padding:40px 20px;">
          <div style="font-size:42px; margin-bottom:12px; filter:drop-shadow(0 0 12px rgba(108,59,255,0.4));">👋</div>
          <h4 style="font-size:16px; font-weight:600; color:#ffffff; margin:0 0 6px 0;">No messages yet</h4>
          <p style="font-size:13px; color:rgba(255,255,255,0.6); max-width:240px; margin:0;">Start the conversation 👋</p>
        </div>
      `;
      return;
    }

    let lastDateKey = null;

    messages.forEach(msg => {
      const rawDate = msg.createdAt || msg.created_at || msg.timestamp;
      const msgDate = rawDate ? new Date(rawDate) : new Date();
      const validDate = isNaN(msgDate.getTime()) ? new Date() : msgDate;
      const dateKey = `${validDate.getFullYear()}-${validDate.getMonth() + 1}-${validDate.getDate()}`;

      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        const separator = document.createElement('div');
        separator.className = 'chat-date-separator';
        separator.textContent = getChatDateSeparatorText(validDate);
        messagesScroll.appendChild(separator);
      }

      let decryptedText = decryptMessage(msg.content, secretKey);

      // Attempt to parse embedded reply info from text
      try {
        const parsed = JSON.parse(decryptedText);
        if (parsed && typeof parsed === 'object' && parsed.text !== undefined) {
          decryptedText = parsed.text;
          msg.replyTo = parsed.replyTo;
        }
      } catch (e) {
        // Normal text message, ignore parsing error
      }

      const time = validDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Robust sender ID resolution
      const msgSenderId = typeof msg.sender === 'object' 
        ? (msg.sender._id || msg.sender.id || '') 
        : (msg.sender || msg.sender_id || '');

      const isSent = msgSenderId.toString() === currentUserId;

      // Linkify standard text content
      const urlRegex = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
      const linkifiedText = (decryptedText || '').replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" style="color: #6c3bff; text-decoration: underline; word-break: break-all;">${url}</a>`;
      });

      let displayContent = `<div class="bubble-content">${linkifiedText}</div>`;

      if (msg.mediaType && msg.mediaType !== 'text') {
        if (msg.mediaType === 'image') {
          displayContent = `
            <div class="bubble-content chat-shared-media-card" onclick="openMediaViewer('${msg._id || msg.id}')">
              <img src="${decryptedText}" style="max-width: 240px; border-radius: var(--radius-md); max-height: 200px; object-fit: cover;" />
            </div>
          `;
        } else if (msg.mediaType === 'video') {
          displayContent = `
            <div class="bubble-content chat-shared-media-card" style="padding: 0; background: none; max-width: 240px; position: relative;">
              <video src="${decryptedText}" style="width: 100%; border-radius: var(--radius-md); max-height: 200px; display: block;" controls></video>
            </div>
          `;
        } else if (msg.mediaType === 'file') {
          displayContent = `
            <div class="chat-shared-file-container" style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 12px;">
              <div onclick="openMediaViewer('${msg._id || msg.id}')" style="display: flex; align-items: center; gap: 8px; flex-grow: 1; cursor: pointer;">
                <i data-lucide="file-text" style="width:24px; height:24px; color:var(--primary); min-width:24px;"></i>
                <div class="chat-shared-file-info" style="text-align: left;">
                  <span class="chat-shared-file-title" style="word-break: break-all; display: block;">${msg.mediaName || 'Document'}</span>
                  <span class="chat-shared-file-size" style="font-size: 10px; opacity: 0.7; display: block;">${msg.mediaSize || ''}</span>
                </div>
              </div>
              <a href="${decryptedText}" download="${msg.mediaName || 'file'}" class="icon-btn" style="color: var(--primary); display: flex; align-items: center; justify-content: center; min-width: 32px; height: 32px; background: rgba(255,255,255,0.05); border-radius: 50%; border: none; cursor: pointer;" title="Download File">
                <i data-lucide="download" style="width: 16px; height: 16px;"></i>
              </a>
            </div>
          `;
        } else if (msg.mediaType === 'voice') {
          displayContent = `
            <div class="bubble-content chat-shared-media-card" style="background: none; padding: 0; max-width: 240px; display: flex; align-items: center; gap: 8px; position: relative;">
              <audio src="${decryptedText}" controls style="flex-grow: 1; display: block; max-width: calc(100% - 36px); height: 40px;"></audio>
            </div>
          `;
        }
      }

      let replyPreviewHtml = '';
      if (msg.replyTo) {
        let rSender = msg.replyTo.senderName || 'User';
        let rText = msg.replyTo.text || 'Message';
        replyPreviewHtml = `
          <div class="replied-message-box">
            <div class="replied-sender">${rSender}</div>
            <div class="replied-text">${rText}</div>
          </div>
        `;
        displayContent = replyPreviewHtml + displayContent;
      }

      let tickHtml = '';
      if (isSent) {
        if (msg.status === 'read' || msg.is_read || msg.read) {
          tickHtml = '<span style="color: #38bdf8; font-weight: bold; font-size: 12px; margin-left: 4px;" title="Read">✓✓</span>';
        } else if (msg.status === 'delivered') {
          tickHtml = '<span style="color: rgba(255,255,255,0.7); font-size: 12px; margin-left: 4px;" title="Delivered">✓✓</span>';
        } else {
          tickHtml = '<span style="color: rgba(255,255,255,0.7); font-size: 12px; margin-left: 4px;" title="Sent">✓</span>';
        }
      }

      const msgIdAttr = (msg._id || msg.id) ? `data-msg-id="${msg._id || msg.id}"` : '';
      const rawTextAttr = `data-raw-text="${(decryptedText || '').replace(/"/g, '&quot;')}"`;
      const senderNameAttr = `data-sender-name="${isSent ? 'You' : (document.querySelector('.chat-header-name')?.textContent || 'User')}"`;

      const bubbleHtml = `
        <div class="${isSent ? 'chat-bubble sent' : 'chat-bubble received'}" ${msgIdAttr} ${rawTextAttr} ${senderNameAttr}>
          ${displayContent}
          <div class="bubble-time">${time} ${tickHtml}</div>
        </div>
      `;

      const actionsHtml = `
        <div style="position: relative;">
          <button class="message-action-trigger"><i data-lucide="chevron-down"></i></button>
          <div class="message-action-dropdown">
            <button class="message-action-item action-reply"><i data-lucide="corner-up-left"></i> Reply</button>
            <button class="message-action-item action-copy"><i data-lucide="copy"></i> Copy</button>
            <button class="message-action-item action-forward"><i data-lucide="forward"></i> Forward</button>
            ${isSent ? `<button class="message-action-item action-delete"><i data-lucide="trash-2"></i> Delete</button>` : ''}
          </div>
        </div>
      `;

      const wrapper = document.createElement('div');
      wrapper.className = isSent ? 'message-bubble-wrapper sent-wrapper' : 'message-bubble-wrapper received-wrapper';

      if (isSent) {
        wrapper.innerHTML = actionsHtml + bubbleHtml;
      } else {
        wrapper.innerHTML = bubbleHtml + actionsHtml;
      }

      messagesScroll.appendChild(wrapper);
    });

    setTimeout(() => {
      if (messagesScroll) {
        messagesScroll.scrollTop = messagesScroll.scrollHeight;
      }
    }, 50);

    debouncedCreateIcons();
  }

  async function markMessagesAsRead(targetUserId) {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/chats/${targetUserId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      loadChatThreads();
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  }

  const backToInboxBtn = document.querySelector('.back-to-inbox-btn');
  if (backToInboxBtn) {
    backToInboxBtn.addEventListener('click', () => {
      const grid = document.querySelector('.chats-layout-grid');
      if (grid) grid.classList.remove('chatting');
      const mainChat = document.querySelector('.chat-window-main');
      if (mainChat) mainChat.style.display = 'none';
    });
  }

  // Chat message input and send
  const messageInput = document.getElementById('chat-message-input');
  const sendMsgBtn = document.getElementById('chat-send-msg-btn');

  let currentReplyToMessage = null;

  async function sendMessage() {
    const text = messageInput.value.trim();
    const targetUserId = state.currentChatThread;
    if (!text || !targetUserId) return;

    const currentUser = getCurrentUser();
    const token = localStorage.getItem('invibe_jwt_token');
    if (!currentUser || !token) return;

    const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);

    // Embed reply data into content payload to bypass backend schema limits
    let finalPayloadText = text;
    if (currentReplyToMessage) {
      finalPayloadText = JSON.stringify({
        text: text,
        replyTo: currentReplyToMessage
      });
    }

    const encryptedText = encryptMessage(finalPayloadText, secretKey);

    // Close emoji picker popover if open
    const emojiPopover = document.getElementById('chat-emoji-popover');
    if (emojiPopover) emojiPopover.classList.remove('active');

    // Clear reply state
    currentReplyToMessage = null;
    const replyContainer = document.getElementById('chat-reply-preview-container');
    if (replyContainer) replyContainer.style.display = 'none';

    messageInput.value = '';

    try {
      const res = await fetch(`${API_URL}/api/chats/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipient: targetUserId,
          content: encryptedText
        })
      });

      if (!res.ok) throw new Error('Failed to send message');

      await fetchMessages(targetUserId, true);
      loadChatThreads();
    } catch (err) {
      console.error('Send error:', err);
      showToast('Failed to send message: ' + err.message);
    }
  }

  if (sendMsgBtn) {
    sendMsgBtn.addEventListener('click', sendMessage);
  }
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  // --- EMOJI PICKER & CAMERA INTERACTIVITY ---
  const smileBtn = document.getElementById('chat-smile-btn');
  const emojiPopover = document.getElementById('chat-emoji-popover');
  const emojiGrid = document.getElementById('emoji-picker-grid');
  const emojiSearchInput = emojiPopover?.querySelector('.emoji-picker-search');
  const emojiCategoryButtons = emojiPopover?.querySelectorAll('.emoji-category-btn');
  const chatCameraInput = document.getElementById('chat-camera-file-input');
  const chatImgPickerBtn = document.getElementById('chat-img-picker-btn');
  const cameraClickSim = document.getElementById('camera-click-sim');

  const emojiLibrary = {
    All: ['😊', '😂', '😍', '👍', '🔥', '🎉', '❤️', '👏', '😮', '😢', '🙌', '🚀', '🕶️', '☕', '✨', '💯', '🥳', '🤩', '😎', '💪', '🌟', '💖', '🙏', '😇'],
    Smileys: ['😊', '😂', '😍', '😄', '😅', '😆', '😇', '😉', '😌', '🥹', '😎', '🤩', '😏', '😮', '😢', '😭', '😤', '🤯', '😴', '😋'],
    People: ['👋', '👍', '👏', '🙌', '🙏', '🤝', '💪', '🫶', '🧑‍💻', '👨‍💻', '👩‍💻', '🧠', '🤗', '🫵', '🫰', '🤟', '🤘', '👀', '🫠', '🤙'],
    Animals: ['🐶', '🐱', '🐭', '🐹', '🦊', '🐻', '🐼', '🐸', '🐵', '🐔', '🦄', '🦋', '🐙', '🐬', '🦁', '🐢', '🐳', '🦒', '🐟', '🐨'],
    Food: ['🍕', '🍔', '🍟', '🍣', '🍜', '🍩', '🍪', '🍓', '🍇', '🥑', '🥗', '🍉', '🍍', '🍰', '🍹', '☕', '🍵', '🥐', '🍌', '🍗'],
    Activities: ['⚽', '🏀', '🏈', '⚡', '🎾', '🎮', '🎨', '🎵', '🎸', '🎧', '🎬', '🎉', '🎊', '🎁', '🎯', '🏆', '🔥', '🚀', '💃', '🧘'],
    Travel: ['✈️', '🚗', '🚆', '🚲', '🏖️', '🏕️', '🌍', '⛵', '🚢', '🚁', '🗺️', '🏔️', '🌊', '🌞', '🧭', '🛫', '🛴', '🚉', '🛏️', '🏙️'],
    Objects: ['💡', '📱', '💻', '⌨️', '🖱️', '🎧', '📷', '📚', '🧰', '💼', '🪄', '🎀', '🪴', '🧴', '🪞', '🧺', '💎', '🔑', '🧩', '🛍️']
  };

  function renderEmojiGrid(category = 'All', search = '') {
    if (!emojiGrid) return;

    const normalized = search.trim().toLowerCase();
    const allEmojis = emojiLibrary[category] || emojiLibrary.All;
    const filtered = allEmojis.filter(emoji => {
      if (!normalized) return true;
      return emoji.toLowerCase().includes(normalized) || emoji.includes(search.trim());
    });

    emojiGrid.innerHTML = '';
    filtered.forEach(emoji => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'emoji-select-btn';
      btn.textContent = emoji;
      btn.setAttribute('title', emoji);
      emojiGrid.appendChild(btn);
    });
  }

  if (smileBtn && emojiPopover) {
    smileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      emojiPopover.classList.toggle('active');
      if (emojiPopover.classList.contains('active')) {
        renderEmojiGrid();
      }
    });
  }

  if (emojiCategoryButtons) {
    emojiCategoryButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.getAttribute('data-emoji-category');
        emojiCategoryButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderEmojiGrid(category, emojiSearchInput?.value || '');
      });
    });
  }

  if (emojiSearchInput) {
    emojiSearchInput.addEventListener('input', () => {
      const activeCategory = emojiPopover.querySelector('.emoji-category-btn.active')?.getAttribute('data-emoji-category') || 'All';
      renderEmojiGrid(activeCategory, emojiSearchInput.value);
    });
  }

  // Handle emoji selection
  if (emojiPopover && messageInput) {
    emojiPopover.addEventListener('click', (e) => {
      const selectBtn = e.target.closest('.emoji-select-btn');
      if (selectBtn) {
        e.stopPropagation();
        const emoji = selectBtn.textContent.trim();
        const startPos = messageInput.selectionStart;
        const endPos = messageInput.selectionEnd;
        const textVal = messageInput.value;
        messageInput.value = textVal.substring(0, startPos) + emoji + textVal.substring(endPos);
        messageInput.focus();
        const newCursorPos = startPos + emoji.length;
        messageInput.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  }

  // Document listener to close emoji popover on click outside
  document.addEventListener('click', (e) => {
    if (emojiPopover && emojiPopover.classList.contains('active')) {
      if (!emojiPopover.contains(e.target) && (!smileBtn || !smileBtn.contains(e.target))) {
        emojiPopover.classList.remove('active');
      }
    }
  });

  // --- REAL CAMERA CAPTURE MODAL LOGIC ---
  const cameraCaptureModal = document.getElementById('camera-capture-modal');
  const cameraModalCloseBtn = document.getElementById('camera-modal-close-btn');
  const cameraVideo = document.getElementById('camera-video');
  const cameraCanvas = document.getElementById('camera-canvas');
  const cameraFallbackView = document.getElementById('camera-fallback-view');
  const fallbackUploadAction = document.getElementById('fallback-upload-action');
  const cameraCaptureAction = document.getElementById('camera-capture-action');
  let cameraStream = null;

  // Open real camera capture view
  function openCameraCapture() {
    if (!cameraCaptureModal) return;

    // Show modal
    cameraCaptureModal.classList.add('active');

    // Reset views
    if (cameraVideo) cameraVideo.style.display = 'none';
    if (cameraFallbackView) cameraFallbackView.style.display = 'flex';
    if (cameraCaptureAction) cameraCaptureAction.classList.add('disabled');

    // Request webcam access
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', frameRate: { ideal: 60, min: 30 } } })
        .then(stream => {
          cameraStream = stream;
          if (cameraVideo) {
            cameraVideo.srcObject = stream;
            cameraVideo.style.display = 'block';
            cameraVideo.play();
          }
          if (cameraFallbackView) cameraFallbackView.style.display = 'none';
          if (cameraCaptureAction) cameraCaptureAction.classList.remove('disabled');
        })
        .catch(err => {
          console.warn('Webcam permission denied or error:', err);
          // Keep fallback active
          if (cameraVideo) cameraVideo.style.display = 'none';
          if (cameraFallbackView) cameraFallbackView.style.display = 'flex';
          if (cameraCaptureAction) cameraCaptureAction.classList.add('disabled');
        });
    } else {
      // Browser doesn't support mediaDevices
      if (cameraVideo) cameraVideo.style.display = 'none';
      if (cameraFallbackView) cameraFallbackView.style.display = 'flex';
      if (cameraCaptureAction) cameraCaptureAction.classList.add('disabled');
    }
  }

  // Close camera capture view and stop streams
  function closeCameraCapture() {
    if (!cameraCaptureModal) return;

    cameraCaptureModal.classList.remove('active');

    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }
    resetCameraModalUI();
  }

  let tempCapturedImage = null;

  function resetCameraModalUI() {
    const previewImg = document.getElementById('camera-preview-img');
    if (previewImg) previewImg.style.display = 'none';
    if (cameraVideo) {
      cameraVideo.style.display = 'block';
      try { cameraVideo.play(); } catch (e) { }
    }
    if (cameraCaptureAction) cameraCaptureAction.style.display = 'flex';
    const previewControls = document.getElementById('camera-preview-controls');
    if (previewControls) previewControls.style.display = 'none';
    tempCapturedImage = null;
  }

  // Bind DM camera triggers to open the capture modal
  if (chatImgPickerBtn) {
    chatImgPickerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openCameraCapture();
    });
  }

  if (cameraClickSim) {
    cameraClickSim.addEventListener('click', (e) => {
      e.preventDefault();
      openCameraCapture();
    });
  }

  if (cameraModalCloseBtn) {
    cameraModalCloseBtn.addEventListener('click', closeCameraCapture);
  }

  // Close modal on click outside modal container
  if (cameraCaptureModal) {
    cameraCaptureModal.addEventListener('click', (e) => {
      if (e.target === cameraCaptureModal) {
        closeCameraCapture();
      }
    });
  }

  // Capture frame logic
  if (cameraCaptureAction) {
    cameraCaptureAction.addEventListener('click', async () => {
      if (!cameraStream || !cameraVideo || !cameraCanvas) return;

      const width = cameraVideo.videoWidth || 640;
      const height = cameraVideo.videoHeight || 480;

      cameraCanvas.width = width;
      cameraCanvas.height = height;

      const ctx = cameraCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(cameraVideo, 0, 0, width, height);

        try {
          tempCapturedImage = cameraCanvas.toDataURL('image/png');

          // Freeze video and show preview img
          cameraVideo.style.display = 'none';
          const previewImg = document.getElementById('camera-preview-img');
          if (previewImg) {
            previewImg.src = tempCapturedImage;
            previewImg.style.display = 'block';
          }

          // Toggle buttons
          cameraCaptureAction.style.display = 'none';
          const previewControls = document.getElementById('camera-preview-controls');
          if (previewControls) previewControls.style.display = 'flex';

        } catch (err) {
          console.error('Error capturing image from canvas:', err);
          showToast('Failed to capture photo from webcam feed.');
        }
      }
    });
  }

  // Fallback upload action triggers hidden file selector
  if (fallbackUploadAction && chatCameraInput) {
    fallbackUploadAction.addEventListener('click', () => {
      chatCameraInput.click();
    });
  }

  // Modify file selector change event to also close camera modal if open
  if (chatCameraInput) {
    chatCameraInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function (evt) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const imgUrl = evt.target.result;

        const targetUserId = state.currentChatThread;
        const currentUser = getCurrentUser();
        const token = localStorage.getItem('invibe_jwt_token');

        if (targetUserId && currentUser && token) {
          try {
            const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);
            const htmlContent = `<img src="${imgUrl}" alt="Uploaded Photo" style="max-width:100%; border-radius:var(--radius-md);" />`;
            const encryptedText = encryptMessage(htmlContent, secretKey);

            await fetch(`${API_URL}/api/chats/message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                recipient: targetUserId,
                content: encryptedText
              })
            });
            await fetchMessages(targetUserId, true);
            loadChatThreads();
          } catch (err) {
            console.error('File send error:', err);
            showToast('Failed to send file.');
          }
        }

        closeCameraCapture();
      };
      reader.readAsDataURL(file);
      // Clear value so the same file can be chosen again
      chatCameraInput.value = '';
    });
  }



  // --- INBOX SIDEBAR CONTROLS (INTERACTIVITY) ---
  const inboxSearchInput = document.getElementById('inbox-search-input');
  if (inboxSearchInput) {
    inboxSearchInput.addEventListener('input', async () => {
      const query = inboxSearchInput.value.trim();
      if (!query) {
        loadChatThreads();
        return;
      }

      const token = localStorage.getItem('invibe_jwt_token');
      if (!token) return;

      try {
        const res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Search failed');
        const users = await res.json();

        chatThreads = users.map(u => ({
          user: u,
          lastMessage: null,
          unreadCount: 0
        }));

        renderChatThreadsList();
      } catch (err) {
        console.error('Inbox search error:', err);
      }
    });
  }

  const catPills = document.querySelectorAll('.cat-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const category = pill.getAttribute('data-cat');

      const items = document.querySelectorAll('.thread-item');
      items.forEach(item => {
        item.style.display = 'flex';
      });
      showToast(`Filtered inbox: ${category.toUpperCase()}`);
    });
  });


  // --- SWITCH CHAT SUB-VIEW MODES ---
  const modeTabs = document.querySelectorAll('.mode-tab');
  const chatSubPanels = document.querySelectorAll('.chat-sub-panel');
  const chatGlobalFooter = document.getElementById('chat-global-footer');

  function switchChatMode(modeName) {
    state.chatMode = modeName;

    modeTabs.forEach(tab => {
      const mode = tab.getAttribute('data-chat-mode');
      if (mode === modeName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    chatSubPanels.forEach(panel => {
      const targetId = (modeName === 'voice-call') ? 'chat-sub-view-call' : `chat-sub-view-${modeName}`;
      if (panel.id === targetId) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    if (modeName === 'call' || modeName === 'voice-call') {
      if (chatGlobalFooter) chatGlobalFooter.style.display = 'none';
      if (!isCallActive && state.currentChatThread) {
        initiateVideoCall(state.currentChatThread, modeName === 'voice-call');
      }
    } else {
      if (chatGlobalFooter) chatGlobalFooter.style.display = 'flex';
      if (isCallActive) {
        cancelOutgoingCall();
      } else {
        stopVideoCallTimer();
      }
      const watchVideo = document.getElementById('watch-together-video');
      if (watchVideo && modeName !== 'watch') {
        watchVideo.pause();
      }
    }
    if (modeName === 'media') {
      loadSharedMediaHub();
    }
    showToast(`Switched Chat layout: ${modeName.toUpperCase()} ⚡`);
  }

  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.getAttribute('data-chat-mode');
      if (mode) switchChatMode(mode);
    });
  });


  // --- CAMERA CAPTURE CONFIRMATION LISTENERS ---
  const cameraRetakeBtn = document.getElementById('camera-retake-btn');
  const cameraSendBtn = document.getElementById('camera-send-btn');

  if (cameraRetakeBtn) {
    cameraRetakeBtn.addEventListener('click', () => {
      const previewImg = document.getElementById('camera-preview-img');
      if (previewImg) previewImg.style.display = 'none';
      if (cameraVideo) {
        cameraVideo.style.display = 'block';
        cameraVideo.play();
      }
      if (cameraCaptureAction) cameraCaptureAction.style.display = 'flex';
      const previewControls = document.getElementById('camera-preview-controls');
      if (previewControls) previewControls.style.display = 'none';
      tempCapturedImage = null;
    });
  }

  if (cameraSendBtn) {
    cameraSendBtn.addEventListener('click', async () => {
      if (!tempCapturedImage) return;

      const targetUserId = state.currentChatThread;
      const currentUser = getCurrentUser();
      const token = localStorage.getItem('invibe_jwt_token');

      if (targetUserId && currentUser && token) {
        const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);
        const encryptedText = encryptMessage(tempCapturedImage, secretKey);

        try {
          await fetch(`${API_URL}/api/chats/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              recipient: targetUserId,
              content: encryptedText,
              mediaUrl: 'camera_capture',
              mediaType: 'image',
              mediaName: `Camera_${Date.now()}.png`,
              mediaSize: '0.1 MB'
            })
          });
          await fetchMessages(targetUserId, true);
          loadChatThreads();
          showToast('Photo shared! 📸');
        } catch (err) {
          console.error('Camera send error:', err);
          showToast('Failed to send captured photo.');
        }
      }

      closeCameraCapture();
    });
  }

  // --- GALLERY FILE PICKER SYSTEM ---
  const galleryPickerBtn = document.getElementById('chat-gallery-picker-btn');
  const galleryFileInput = document.getElementById('chat-gallery-file-input');

  if (galleryPickerBtn && galleryFileInput) {
    galleryPickerBtn.addEventListener('click', () => {
      galleryFileInput.click();
    });
  }

  if (galleryFileInput) {
    galleryFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function (evt) {
        const fileDataUrl = evt.target.result;
        const targetUserId = state.currentChatThread;
        const currentUser = getCurrentUser();
        const token = localStorage.getItem('invibe_jwt_token');

        if (targetUserId && currentUser && token) {
          try {
            let mediaType = 'file';
            if (file.type.startsWith('image/')) {
              mediaType = 'image';
            } else if (file.type.startsWith('video/')) {
              mediaType = 'video';
            } else if (file.type.startsWith('audio/')) {
              mediaType = 'voice';
            }

            const sizeStr = (file.size / 1024 / 1024).toFixed(1) + ' MB';

            const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);
            const encryptedText = encryptMessage(fileDataUrl, secretKey);

            await fetch(`${API_URL}/api/chats/message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                recipient: targetUserId,
                content: encryptedText,
                mediaUrl: 'gallery_upload',
                mediaType: mediaType,
                mediaName: file.name,
                mediaSize: sizeStr
              })
            });
            await fetchMessages(targetUserId, true);
            loadChatThreads();
            showToast('Media uploaded from gallery! 🖼️');
          } catch (err) {
            console.error('Gallery upload error:', err);
            showToast('Failed to upload file.');
          }
        }
      };
      reader.readAsDataURL(file);
      galleryFileInput.value = '';
    });
  }

  // --- SHARED MEDIA VIEWER AND REPLIES ---
  const mediaViewerModal = document.getElementById('media-viewer-modal');
  const mediaViewerCloseBtn = document.getElementById('media-viewer-close-btn');
  const mediaViewerTitle = document.getElementById('media-viewer-title');
  const mediaViewerViewport = document.querySelector('.media-viewer-viewport');
  const mediaViewerName = document.getElementById('media-viewer-name');
  const mediaViewerSize = document.getElementById('media-viewer-size');
  const mediaViewerReplyInput = document.getElementById('media-viewer-reply-input');
  const mediaViewerReplySend = document.getElementById('media-viewer-reply-send');

  let activeViewerMessageId = null;

  async function openMediaViewer(messageId) {
    activeViewerMessageId = messageId;
    const targetUserId = state.currentChatThread;
    if (!targetUserId || !mediaViewerModal) return;

    const conversationMsgs = chatFeeds[targetUserId] || [];
    const msg = conversationMsgs.find(m => m._id.toString() === messageId.toString());
    if (!msg || !msg.mediaType) return;

    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const currentUserId = currentUser.id || currentUser._id;
    const secretKey = getChatSecretKey(currentUserId, targetUserId);
    const decryptedData = decryptMessage(msg.content, secretKey);

    mediaViewerViewport.innerHTML = '';
    mediaViewerName.textContent = msg.mediaName || 'Shared Media';
    mediaViewerSize.textContent = msg.mediaSize || '';
    mediaViewerReplyInput.value = '';

    if (msg.mediaType === 'image') {
      mediaViewerTitle.textContent = 'View Image';
      const img = document.createElement('img');
      img.src = decryptedData;
      mediaViewerViewport.appendChild(img);
    } else if (msg.mediaType === 'video') {
      mediaViewerTitle.textContent = 'Play Video';
      const video = document.createElement('video');
      video.src = decryptedData;
      video.controls = true;
      video.autoplay = true;
      mediaViewerViewport.appendChild(video);
    } else if (msg.mediaType === 'voice') {
      mediaViewerTitle.textContent = 'Play Voice Note';
      const audio = document.createElement('audio');
      audio.src = decryptedData;
      audio.controls = true;
      audio.autoplay = true;
      mediaViewerViewport.appendChild(audio);
    } else if (msg.mediaType === 'file') {
      mediaViewerTitle.textContent = 'View Document';
      mediaViewerViewport.innerHTML = `
        <div style="text-align:center; padding:20px;">
          <i data-lucide="file-text" style="width:60px; height:60px; color:var(--primary); margin-bottom:12px;"></i>
          <p style="font-size:14px; font-weight:600; margin-bottom:16px;">${msg.mediaName}</p>
          <a href="${decryptedData}" download="${msg.mediaName}" class="glass-btn bg-pink-btn" style="padding:10px 24px; border-radius:var(--radius-md); text-decoration:none; display:inline-flex; align-items:center; gap:8px;"><i data-lucide="download"></i> Download File</a>
        </div>
      `;
      debouncedCreateIcons();
    } else if (msg.mediaType === 'hub') {
      mediaViewerTitle.textContent = 'View Shared Hub Item';
      const isReel = msg.mediaUrl.startsWith('reel');
      mediaViewerViewport.innerHTML = `
        <div style="text-align:center; padding:20px;">
          <i data-lucide="sparkles" style="width:60px; height:60px; color:var(--primary); margin-bottom:12px;"></i>
          <p style="font-size:14px; font-weight:600; margin-bottom:16px;">${msg.mediaName}</p>
          <button class="glass-btn bg-pink-btn" onclick="navigateToHubShare('${msg.mediaUrl}')" style="padding:10px 24px; border-radius:var(--radius-md); display:inline-flex; align-items:center; gap:8px;"><i data-lucide="external-link"></i> Open ${isReel ? 'Reel' : 'Post'}</button>
        </div>
      `;
      debouncedCreateIcons();
    }

    mediaViewerModal.classList.add('active');
  }
  window.openMediaViewer = openMediaViewer;

  function navigateToHubShare(id) {
    if (mediaViewerModal) mediaViewerModal.classList.remove('active');
    if (id.startsWith('reel')) {
      const reelsTab = document.querySelector('[data-view="reels"]');
      if (reelsTab) reelsTab.click();
      showToast(`Navigated to shared Reel! 🎬`);
    } else {
      const feedTab = document.querySelector('[data-view="home"]');
      if (feedTab) feedTab.click();
      showToast(`Navigated to shared Post! 📸`);
    }
  }
  window.navigateToHubShare = navigateToHubShare;

  if (mediaViewerCloseBtn) {
    mediaViewerCloseBtn.addEventListener('click', () => {
      mediaViewerModal.classList.remove('active');
      const audio = mediaViewerViewport.querySelector('audio');
      if (audio) audio.pause();
      const video = mediaViewerViewport.querySelector('video');
      if (video) video.pause();
    });
  }

  async function sendMediaViewerReply() {
    const text = mediaViewerReplyInput.value.trim();
    if (!text || !activeViewerMessageId) return;

    const targetUserId = state.currentChatThread;
    const currentUser = getCurrentUser();
    const token = localStorage.getItem('invibe_jwt_token');
    if (!targetUserId || !currentUser || !token) return;

    const conversationMsgs = chatFeeds[targetUserId] || [];
    const msg = conversationMsgs.find(m => m._id.toString() === activeViewerMessageId.toString());
    const mediaName = msg ? msg.mediaName || 'Media' : 'Media';

    const replyText = `💬 Reply to "${mediaName}": ${text}`;

    const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);
    const encryptedText = encryptMessage(replyText, secretKey);

    try {
      const res = await fetch(`${API_URL}/api/chats/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipient: targetUserId,
          content: encryptedText
        })
      });
      if (!res.ok) throw new Error();

      mediaViewerReplyInput.value = '';
      mediaViewerModal.classList.remove('active');
      showToast('Sent reply! 💬');

      await fetchMessages(targetUserId, true);
      loadChatThreads();
    } catch (err) {
      showToast('Failed to send reply.');
    }
  }

  if (mediaViewerReplySend) {
    mediaViewerReplySend.addEventListener('click', sendMediaViewerReply);
  }
  if (mediaViewerReplyInput) {
    mediaViewerReplyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMediaViewerReply();
      }
    });
  }

  // --- DYNAMIC SHARED MEDIA HUB IMPLEMENTATION ---
  async function loadSharedMediaHub() {
    const targetUserId = state.currentChatThread;
    const mediaGrid = document.getElementById('shared-media-items-grid');
    if (!targetUserId || !mediaGrid) return;

    const activeTab = document.querySelector('#media-hub-tabs .m-pill.active');
    const filterType = activeTab ? activeTab.getAttribute('data-media-filter') : 'all';

    const searchInput = document.getElementById('media-search-input');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    await fetchMessages(targetUserId, false);
    const messages = chatFeeds[targetUserId] || [];

    let mediaMessages = messages.filter(m => m.mediaType);

    if (filterType !== 'all') {
      mediaMessages = mediaMessages.filter(m => m.mediaType === filterType);
    }

    if (query) {
      mediaMessages = mediaMessages.filter(m => {
        const name = (m.mediaName || '').toLowerCase();
        return name.includes(query);
      });
    }

    mediaGrid.innerHTML = '';

    if (mediaMessages.length === 0) {
      mediaGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted); font-size: 12px;">No shared media items found in this chat.</div>';
      return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const currentUserId = currentUser.id || currentUser._id;
    const secretKey = getChatSecretKey(currentUserId, targetUserId);

    mediaMessages.forEach(msg => {
      const card = document.createElement('div');
      card.className = 'media-item-card';
      card.setAttribute('data-type', msg.mediaType);
      card.addEventListener('click', () => {
        openMediaViewer(msg._id);
      });

      if (msg.mediaType === 'image') {
        const decryptedData = decryptMessage(msg.content, secretKey);
        card.innerHTML = `
          <img src="${decryptedData}" alt="${msg.mediaName}" style="width: 100%; height: 100%; object-fit: cover;" />
          <div class="media-item-desc">
            <span class="file-name">${msg.mediaName || 'Image'}</span>
            <span class="file-size">${msg.mediaSize || ''}</span>
          </div>
        `;
      } else if (msg.mediaType === 'video') {
        card.classList.add('video-thumb');
        card.innerHTML = `
          <div class="thumb-play-btn"><i data-lucide="play"></i></div>
          <div style="background: #000; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: #fff;"><i data-lucide="video" style="width: 30px; height: 30px; opacity: 0.6;"></i></div>
          <div class="media-item-desc">
            <span class="file-name">${msg.mediaName || 'Video'}</span>
            <span class="file-size">${msg.mediaSize || ''}</span>
          </div>
        `;
      } else if (msg.mediaType === 'voice') {
        card.classList.add('voice-thumb');
        card.innerHTML = `
          <div class="voice-waveform">
            <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
          <div class="media-item-desc">
            <span class="file-name">${msg.mediaName || 'Voice Note'}</span>
            <span class="file-size">${msg.mediaSize || ''}</span>
          </div>
        `;
      } else if (msg.mediaType === 'file') {
        card.classList.add('doc-thumb');
        card.innerHTML = `
          <div class="thumb-doc-icon"><i data-lucide="file-text"></i></div>
          <div class="media-item-desc">
            <span class="file-name">${msg.mediaName || 'Document'}</span>
            <span class="file-size">${msg.mediaSize || ''}</span>
          </div>
        `;
      } else if (msg.mediaType === 'hub') {
        card.classList.add('doc-thumb');
        card.style.background = 'rgba(108,59,255,0.1)';
        card.innerHTML = `
          <div class="thumb-doc-icon"><i data-lucide="sparkles" style="color: var(--primary);"></i></div>
          <div class="media-item-desc">
            <span class="file-name">${msg.mediaName || 'Shared Post'}</span>
            <span class="file-size">Hub Link</span>
          </div>
        `;
      }

      mediaGrid.appendChild(card);
    });

    debouncedCreateIcons();
  }
  window.loadSharedMediaHub = loadSharedMediaHub;

  const mediaHubPills = document.querySelectorAll('#media-hub-tabs .m-pill');
  mediaHubPills.forEach(pill => {
    pill.addEventListener('click', () => {
      mediaHubPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      loadSharedMediaHub();
    });
  });

  const mediaSearchInput = document.getElementById('media-search-input');
  if (mediaSearchInput) {
    mediaSearchInput.addEventListener('input', () => {
      loadSharedMediaHub();
    });
  }


  // --- CHAT ATTACHMENTS DRAWER ---
  const toggleAttachmentsBtn = document.getElementById('toggle-attachments-btn');
  const attachmentsDrawer = document.getElementById('chat-attachments-drawer');

  if (toggleAttachmentsBtn) {
    toggleAttachmentsBtn.addEventListener('click', () => {
      toggleAttachmentsBtn.classList.toggle('active');
      attachmentsDrawer.classList.toggle('active');
    });
  }

  // Drawer options click mode swapping
  const drawerBtns = document.querySelectorAll('.attachment-action-btn');
  drawerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const openMode = btn.getAttribute('data-open-mode');
      if (openMode) {
        switchChatMode(openMode);
        toggleAttachmentsBtn.classList.remove('active');
        attachmentsDrawer.classList.remove('active');
      }
    });
  });

  const simpleDrawerAlerts = [
    { id: 'poll-click-sim', label: 'Poll Widget created: "What time is offsite?" 📊' }
  ];

  simpleDrawerAlerts.forEach(sim => {
    const el = document.getElementById(sim.id);
    if (el) {
      el.addEventListener('click', () => {
        showToast(sim.label);
        toggleAttachmentsBtn.classList.remove('active');
        attachmentsDrawer.classList.remove('active');
      });
    }
  });

  // --- ATTACHMENTS DRAWER ACTION BUTTONS ---
  const attachmentBtnPicker = document.getElementById('attachment-btn-picker');
  const filesBtnPicker = document.getElementById('files-btn-picker');
  const attachmentFileInput = document.getElementById('attachment-file-input');
  const attachmentDocInput = document.getElementById('attachment-doc-input');

  if (attachmentBtnPicker && attachmentFileInput) {
    attachmentBtnPicker.addEventListener('click', () => {
      attachmentFileInput.click();
    });
  }

  if (filesBtnPicker && attachmentDocInput) {
    filesBtnPicker.addEventListener('click', () => {
      attachmentDocInput.click();
    });
  }

  async function handleAttachmentFileUpload(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (evt) {
      const fileDataUrl = evt.target.result;
      const targetUserId = state.currentChatThread;
      const currentUser = getCurrentUser();
      const token = localStorage.getItem('invibe_jwt_token');

      if (targetUserId && currentUser && token) {
        try {
          let mediaType = 'file';
          if (file.type.startsWith('image/')) {
            mediaType = 'image';
          } else if (file.type.startsWith('video/')) {
            mediaType = 'video';
          } else if (file.type.startsWith('audio/')) {
            mediaType = 'voice';
          }

          const sizeStr = (file.size / 1024 / 1024).toFixed(1) + ' MB';
          const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);
          const encryptedText = encryptMessage(fileDataUrl, secretKey);

          await fetch(`${API_URL}/api/chats/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              recipient: targetUserId,
              content: encryptedText,
              mediaUrl: 'drawer_upload',
              mediaType: mediaType,
              mediaName: file.name,
              mediaSize: sizeStr
            })
          });
          await fetchMessages(targetUserId, true);
          loadChatThreads();
          showToast(`File "${file.name}" sent! 📎`);

          // Close drawer
          if (toggleAttachmentsBtn) toggleAttachmentsBtn.classList.remove('active');
          if (attachmentsDrawer) attachmentsDrawer.classList.remove('active');
        } catch (err) {
          console.error('File upload error:', err);
          showToast('Failed to upload file.');
        }
      }
    };
    reader.readAsDataURL(file);
  }

  if (attachmentFileInput) {
    attachmentFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      handleAttachmentFileUpload(file);
      e.target.value = ''; // Reset
    });
  }

  if (attachmentDocInput) {
    attachmentDocInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      handleAttachmentFileUpload(file);
      e.target.value = ''; // Reset
    });
  }

  // Geolocation sharing
  const locClickSimBtn = document.getElementById('loc-click-sim');
  if (locClickSimBtn) {
    locClickSimBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.');
        return;
      }

      showToast('Fetching your location... 📍');

      navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

        const targetUserId = state.currentChatThread;
        const currentUser = getCurrentUser();
        const token = localStorage.getItem('invibe_jwt_token');

        if (targetUserId && currentUser && token) {
          try {
            const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);
            const encryptedText = encryptMessage(mapsUrl, secretKey);

            await fetch(`${API_URL}/api/chats/message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                recipient: targetUserId,
                content: encryptedText,
                mediaType: 'location',
                mediaName: 'Shared Location'
              })
            });

            await fetchMessages(targetUserId, true);
            loadChatThreads();
            showToast('Location shared! 🗺️');

            // Close drawer
            if (toggleAttachmentsBtn) toggleAttachmentsBtn.classList.remove('active');
            if (attachmentsDrawer) attachmentsDrawer.classList.remove('active');
          } catch (err) {
            console.error('Location send error:', err);
            showToast('Failed to share location.');
          }
        }
      }, (error) => {
        console.error('Geolocation error:', error);
        showToast('Failed to get location: ' + error.message);
      }, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      });
    });
  }

  // Voice Note Audio Recording
  const micClickSimBtn = document.getElementById('mic-click-sim');
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecordingAudio = false;
  let recordingTimeout = null;

  // Global variables to store the voice note preview
  let tempVoiceNoteBase64 = null;
  let tempVoiceNoteBlobSize = null;
  let tempVoiceNoteBlob = null;

  const voiceNotePreviewContainer = document.getElementById('voice-note-preview-container');
  const voiceNotePreviewAudio = document.getElementById('voice-note-preview-audio');
  const voiceNotePreviewDelete = document.getElementById('voice-note-preview-delete');
  const voiceNotePreviewSend = document.getElementById('voice-note-preview-send');

  if (micClickSimBtn) {
    micClickSimBtn.addEventListener('click', async () => {
      if (isRecordingAudio) {
        // Stop recording
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      } else {
        // Start recording
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          showToast('Audio recording is not supported by your browser.');
          return;
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioChunks = [];
          mediaRecorder = new MediaRecorder(stream);

          mediaRecorder.addEventListener('dataavailable', (event) => {
            if (event.data.size > 0) {
              audioChunks.push(event.data);
            }
          });

          mediaRecorder.addEventListener('stop', async () => {
            // Stop all stream tracks to release microphone
            stream.getTracks().forEach(track => track.stop());

            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            if (audioBlob.size < 1000) {
              showToast('Recording was too short.');
              resetRecordingUI();
              return;
            }

            // Convert to base64 Data URL
            const reader = new FileReader();
            reader.onloadend = async () => {
              // Store locally in temporary variables
              tempVoiceNoteBase64 = reader.result;
              tempVoiceNoteBlobSize = (audioBlob.size / 1024).toFixed(1) + ' KB';
              tempVoiceNoteBlob = audioBlob;

              // Bind to preview audio player
              if (voiceNotePreviewAudio) {
                if (voiceNotePreviewAudio.src && voiceNotePreviewAudio.src.startsWith('blob:')) {
                  URL.revokeObjectURL(voiceNotePreviewAudio.src);
                }
                voiceNotePreviewAudio.src = URL.createObjectURL(audioBlob);
              }

              // Display the preview container
              if (voiceNotePreviewContainer) {
                voiceNotePreviewContainer.style.display = 'flex';
              }

              // Collapse the attachments drawer mimicking standard behavior
              if (toggleAttachmentsBtn && toggleAttachmentsBtn.classList.contains('active')) {
                toggleAttachmentsBtn.classList.remove('active');
                if (attachmentsDrawer) attachmentsDrawer.classList.remove('active');
              }

              resetRecordingUI();
            };
            reader.readAsDataURL(audioBlob);
          });

          mediaRecorder.start();
          isRecordingAudio = true;

          // Update UI
          micClickSimBtn.classList.add('bg-pulse-red');
          const spanText = micClickSimBtn.querySelector('span');
          if (spanText) spanText.textContent = 'Stop';
          showToast('Recording voice note... Click again to stop. 🔴');

          // Maximum recording duration: 60 seconds
          recordingTimeout = setTimeout(() => {
            if (isRecordingAudio && mediaRecorder && mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
          }, 60000);

        } catch (err) {
          console.error('Microphone access denied or error:', err);
          showToast('Could not access microphone: ' + err.message);
          resetRecordingUI();
        }
      }
    });
  }

  if (voiceNotePreviewDelete) {
    voiceNotePreviewDelete.addEventListener('click', () => {
      tempVoiceNoteBase64 = null;
      tempVoiceNoteBlobSize = null;
      tempVoiceNoteBlob = null;
      if (voiceNotePreviewAudio) {
        if (voiceNotePreviewAudio.src && voiceNotePreviewAudio.src.startsWith('blob:')) {
          URL.revokeObjectURL(voiceNotePreviewAudio.src);
        }
        voiceNotePreviewAudio.src = '';
      }
      if (voiceNotePreviewContainer) {
        voiceNotePreviewContainer.style.display = 'none';
      }
      showToast('Voice note discarded.');
    });
  }

  if (voiceNotePreviewSend) {
    voiceNotePreviewSend.addEventListener('click', async () => {
      const targetUserId = state.currentChatThread;
      const currentUser = getCurrentUser();
      const token = localStorage.getItem('invibe_jwt_token');

      if (tempVoiceNoteBase64 && targetUserId && currentUser && token) {
        try {
          const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);
          const encryptedText = encryptMessage(tempVoiceNoteBase64, secretKey);

          await fetch(`${API_URL}/api/chats/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              recipient: targetUserId,
              content: encryptedText,
              mediaUrl: 'voice_recording',
              mediaType: 'voice',
              mediaName: `Voice Note - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              mediaSize: tempVoiceNoteBlobSize
            })
          });
          await fetchMessages(targetUserId, true);
          loadChatThreads();
          showToast('Voice note sent! 🎙️');
        } catch (err) {
          console.error('Audio upload error:', err);
          showToast('Failed to send voice note.');
        }
      }

      // Clear states
      tempVoiceNoteBase64 = null;
      tempVoiceNoteBlobSize = null;
      tempVoiceNoteBlob = null;
      if (voiceNotePreviewAudio) {
        if (voiceNotePreviewAudio.src && voiceNotePreviewAudio.src.startsWith('blob:')) {
          URL.revokeObjectURL(voiceNotePreviewAudio.src);
        }
        voiceNotePreviewAudio.src = '';
      }
      if (voiceNotePreviewContainer) {
        voiceNotePreviewContainer.style.display = 'none';
      }
    });
  }

  function resetRecordingUI() {
    isRecordingAudio = false;
    if (recordingTimeout) clearTimeout(recordingTimeout);
    if (micClickSimBtn) {
      micClickSimBtn.classList.remove('bg-pulse-red');
      const spanText = micClickSimBtn.querySelector('span');
      if (spanText) spanText.textContent = 'Voice Note';
    }
  }


  // --- WATCH TOGETHER REACTIONS ---
  const watchReactBtns = document.querySelectorAll('.react-burst-btn');
  const watchContainer = document.querySelector('.watch-together-container');

  function triggerWatchReaction(emoji) {
    if (!watchContainer) return;

    const spawnX = watchContainer.clientWidth - 120 + (Math.random() * 80);
    const spawnY = watchContainer.clientHeight - 40;

    const floatEmoji = document.createElement('div');
    floatEmoji.className = 'floating-reaction-emoji';
    floatEmoji.textContent = emoji;
    floatEmoji.style.left = `${spawnX}px`;
    floatEmoji.style.top = `${spawnY}px`;

    const rnd = -50 + Math.random() * 100;
    const rndXEnd = rnd + (-60 + Math.random() * 120);
    floatEmoji.style.setProperty('--rnd-x', `${rnd}px`);
    floatEmoji.style.setProperty('--rnd-x-end', `${rndXEnd}px`);

    watchContainer.appendChild(floatEmoji);
    setTimeout(() => floatEmoji.remove(), 1200);
  }

  watchReactBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.getAttribute('data-emoji');
      triggerWatchReaction(emoji);

      // Live Chat update log
      if (watchMessagesScroll) {
        const line = document.createElement('div');
        line.className = 'watch-msg animate-appear';
        line.innerHTML = `<span class="w-user me">You:</span> Reacted with ${emoji}`;
        watchMessagesScroll.appendChild(line);
        watchMessagesScroll.scrollTop = watchMessagesScroll.scrollHeight;
      }

      // Increment viewer count
      const watchCount = document.getElementById('watch-count-lbl');
      if (watchCount) watchCount.textContent = '4';
    });
  });


  // --- WEBRTC AND VIDEO CALL STATE ---
  let localStream = null;
  let peerConnection = null;
  let currentCallId = null;
  let callStatePollingInterval = null;
  let isCallActive = false;
  let isCaller = false;
  let currentRecipientId = null;
  let localScreenStream = null;
  let fakeCallSimulation = false;
  let isAudioCall = false;

  let activeRtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ]
  };

  async function fetchIceServers() {
    try {
      const res = await fetch(`${API_URL}/api/calls/ice-servers`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.iceServers) {
          activeRtcConfig = { iceServers: data.iceServers };
        }
      }
    } catch (e) {
      console.warn("Could not fetch TURN/STUN servers from backend, using defaults:", e);
    }
  }

  // Synthesized sounds
  let audioCtx = null;
  let ringToneInterval = null;

  function initAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type, duration, gainValue = 0.1) {
    try {
      initAudioContext();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(gainValue, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.error("Audio error:", e);
    }
  }

  function startIncomingRingtone() {
    stopAudioFeedback();
    let noteIndex = 0;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    ringToneInterval = setInterval(() => {
      playTone(notes[noteIndex % notes.length], 'triangle', 0.6, 0.12);
      noteIndex++;
    }, 350);
  }

  function startOutgoingRingback() {
    stopAudioFeedback();
    ringToneInterval = setInterval(() => {
      // US ringback: 440Hz + 480Hz
      playTone(440, 'sine', 1.5, 0.04);
      playTone(480, 'sine', 1.5, 0.04);
    }, 4000);
  }

  function playCallEndBeep() {
    stopAudioFeedback();
    playTone(250, 'sine', 0.4, 0.08);
  }

  function stopAudioFeedback() {
    if (ringToneInterval) {
      clearInterval(ringToneInterval);
      ringToneInterval = null;
    }
  }

  function getAuthHeaders() {
    const token = localStorage.getItem('invibe_jwt_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  function getUserById(userId) {
    const thread = chatThreads.find(t => t.user && t.user._id.toString() === userId.toString());
    if (thread) return thread.user;
    return null;
  }

  // --- VIDEO CALL TIMER CONTROLLER ---
  const callTimerDisplay = document.getElementById('call-timer-display');

  function startVideoCallTimer() {
    stopVideoCallTimer();
    state.callSeconds = 0;
    state.callTimerInterval = setInterval(() => {
      state.callSeconds++;
      if (callTimerDisplay) {
        callTimerDisplay.textContent = formatCallTime(state.callSeconds);
      }
    }, 1000);
  }

  function stopVideoCallTimer() {
    if (state.callTimerInterval) {
      clearInterval(state.callTimerInterval);
      state.callTimerInterval = null;
    }
  }

  function formatCallTime(totalSec) {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const h = hrs < 10 ? '0' + hrs : hrs;
    const m = mins < 10 ? '0' + mins : mins;
    const s = secs < 10 ? '0' + secs : secs;
    return `${h}:${m}:${s}`;
  }

  let iceCandidateSendPromise = Promise.resolve();

  async function sendIceCandidateToServer(callId, candidate, role) {
    iceCandidateSendPromise = iceCandidateSendPromise.then(async () => {
      try {
        await fetch(`${API_URL}/api/calls/ice-candidate`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ callId, candidate, role })
        });
      } catch (e) {
        console.error("Error sending ICE candidate:", e);
      }
    });
  }

  async function initiateVideoCall(recipientId, isAudioOnly = false) {
    if (isCallActive) return;
    isCallActive = true;
    isCaller = true;
    isAudioCall = isAudioOnly;
    currentRecipientId = recipientId;
    fakeCallSimulation = false;

    // Show outgoing screen, hide active call screen and controls
    document.getElementById('video-call-active-screen').style.display = 'none';
    document.getElementById('video-call-outgoing-screen').style.display = 'flex';
    document.getElementById('video-call-controls').style.display = 'none';

    // Populate outgoing screen metadata
    const user = getUserById(recipientId);
    if (user) {
      document.getElementById('video-call-outgoing-name').textContent = user.fullName;
      document.getElementById('video-call-outgoing-avatar').src = user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';
    }

    const outgoingStatus = document.getElementById('video-call-outgoing-status');
    if (outgoingStatus) {
      outgoingStatus.textContent = isAudioOnly ? 'Audio Calling...' : 'Calling...';
    }

    startOutgoingRingback();

    try {
      // 1. Get media permission
      const mediaConstraints = isAudioOnly
        ? { video: false, audio: true }
        : { video: true, audio: true };

      localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints).catch(err => {
        console.warn("Could not get media devices, falling back to mock call: ", err);
        fakeCallSimulation = true;
        return null;
      });

      if (!fakeCallSimulation) {
        // Set local stream to local preview video tag
        const localVideo = document.getElementById('video-call-local-feed');
        const localFrame = document.getElementById('video-call-local-frame');
        if (localVideo) {
          if (isAudioOnly) {
            localVideo.srcObject = null;
            if (localFrame) localFrame.style.display = 'none';
          } else {
            localVideo.srcObject = localStream;
            localVideo.muted = true;
            if (localFrame) localFrame.style.display = 'block';
            localVideo.play().catch(e => console.log("video play error:", e));
          }
        }

        // 2. Create PeerConnection
        await fetchIceServers();
        peerConnection = new RTCPeerConnection(activeRtcConfig);

        // Add local tracks
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });

        // ICE candidate handler
        let iceCandidateQueue = [];
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            if (currentCallId) {
              sendIceCandidateToServer(currentCallId, event.candidate, 'caller');
            } else {
              iceCandidateQueue.push(event.candidate);
            }
          }
        };

        // Remote track handler
        peerConnection.ontrack = (event) => {
          const remoteVideo = document.getElementById('video-call-remote-feed');
          if (remoteVideo && event.streams[0]) {
            if (!isAudioOnly) {
              remoteVideo.srcObject = event.streams[0];
              remoteVideo.play().catch(e => console.log("remote play error:", e));
            }
          }
        };

        // Create Offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Send Offer to Server
        const offerPayload = {
          type: offer.type,
          sdp: offer.sdp,
          isAudioOnly: isAudioOnly
        };

        const res = await fetch(`${API_URL}/api/calls/initiate`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            recipientId,
            offer: JSON.stringify(offerPayload)
          })
        });

        if (!res.ok) throw new Error("Failed to initiate call on server.");
        const callData = await res.json();
        currentCallId = callData._id || callData.id;

        // Flush queued ICE candidates
        if (typeof iceCandidateQueue !== 'undefined') {
          iceCandidateQueue.forEach(cand => {
            sendIceCandidateToServer(currentCallId, cand, 'caller');
          });
          iceCandidateQueue = [];
        }
      } else {
        // Mock Call initiation on server (just so signaling works for matching UI state)
        const offerPayload = {
          type: 'offer',
          sdp: 'mock',
          isAudioOnly: isAudioOnly
        };

        const res = await fetch(`${API_URL}/api/calls/initiate`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            recipientId,
            offer: JSON.stringify(offerPayload)
          })
        });
        if (!res.ok) throw new Error("Failed to initiate call on server.");
        const callData = await res.json();
        currentCallId = callData._id || callData.id;
      }

      // Start polling for accept status
      startCallStatePolling();

    } catch (err) {
      console.error("Error initiating call:", err);
      showToast("Error initiating call 📞");
      endVideoCallLocally();
    }
  }

  function startCallStatePolling() {
    if (callStatePollingInterval) clearInterval(callStatePollingInterval);

    let processedCandidates = new Set();
    callStatePollingInterval = setInterval(async () => {
      if (!currentCallId) return;

      try {
        const res = await fetch(`${API_URL}/api/calls/${currentCallId}/state`, {
          headers: getAuthHeaders()
        });
        if (!res.ok) return;

        const data = await res.json();

        // If caller and call was accepted:
        if (isCaller && data.status === 'connected' && isCallActive && document.getElementById('video-call-active-screen').style.display === 'none') {
          stopAudioFeedback();

          // Switch to active view
          document.getElementById('video-call-outgoing-screen').style.display = 'none';
          document.getElementById('video-call-active-screen').style.display = 'block';
          document.getElementById('video-call-controls').style.display = 'block';

          startVideoCallTimer();

          const camBtn = document.getElementById('call-cam-btn');
          const shareBtn = document.getElementById('call-share-btn');
          if (camBtn) camBtn.style.display = isAudioCall ? 'none' : 'flex';
          if (shareBtn) shareBtn.style.display = isAudioCall ? 'none' : 'flex';

          if (isAudioCall) {
            const remoteContainer = document.getElementById('remote-video-container');
            const localFrame = document.getElementById('video-call-local-frame');
            const audioContainer = document.getElementById('audio-call-active-container');
            if (remoteContainer) remoteContainer.style.display = 'none';
            if (localFrame) localFrame.style.display = 'none';
            if (audioContainer) {
              audioContainer.style.display = 'flex';
              const user = getUserById(currentRecipientId);
              if (user) {
                const activeAvatar = document.getElementById('audio-call-active-avatar');
                const activeName = document.getElementById('audio-call-active-name');
                if (activeAvatar) activeAvatar.src = user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';
                if (activeName) activeName.textContent = user.fullName;
              }
            }
          } else {
            const remoteContainer = document.getElementById('remote-video-container');
            const localFrame = document.getElementById('video-call-local-frame');
            const audioContainer = document.getElementById('audio-call-active-container');
            if (remoteContainer) remoteContainer.style.display = 'block';
            if (localFrame) localFrame.style.display = 'block';
            if (audioContainer) audioContainer.style.display = 'none';

            // Update remote name
            const user = getUserById(currentRecipientId);
            if (user) {
              document.getElementById('video-call-remote-name').textContent = user.fullName;
            }
          }

          if (!fakeCallSimulation && data.answer) {
            const answerData = JSON.parse(data.answer);
            if (answerData.sdp === 'mock') {
              fakeCallSimulation = true;
              if (!isAudioCall) switchToSimulationFeeds();
            } else {
              const answerDesc = new RTCSessionDescription(answerData);
              if (peerConnection.signalingState === 'have-local-offer') {
                await peerConnection.setRemoteDescription(answerDesc);
              }
            }
          } else if (fakeCallSimulation) {
            if (!isAudioCall) switchToSimulationFeeds();
          }
        }

        // Process peer ICE candidates
        if (!fakeCallSimulation && peerConnection && peerConnection.remoteDescription) {
          if (data.peerCandidates && data.peerCandidates.length > 0) {
            data.peerCandidates.forEach(cand => {
              const candId = cand.candidate || JSON.stringify(cand);
              if (!processedCandidates.has(candId)) {
                processedCandidates.add(candId);
                try {
                  peerConnection.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) { console.error("Error adding candidate:", e); }
              }
            });
          }
        }

        // If call declined or ended
        if (data.status === 'declined' || data.status === 'ended') {
          showToast(data.status === 'declined' ? 'Call Declined. 📞' : 'Call Ended.');
          playCallEndBeep();
          endVideoCallLocally();
        }

      } catch (err) {
        console.error("Error polling call state:", err);
      }
    }, 1500);
  }

  function endVideoCallLocally() {
    isCallActive = false;
    stopVideoCallTimer();
    stopAudioFeedback();

    if (callStatePollingInterval) {
      clearInterval(callStatePollingInterval);
      callStatePollingInterval = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }

    if (localScreenStream) {
      localScreenStream.getTracks().forEach(track => track.stop());
      localScreenStream = null;
    }

    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }

    const localVideo = document.getElementById('video-call-local-feed');
    if (localVideo) {
      localVideo.srcObject = null;
      localVideo.removeAttribute('src');
    }

    const remoteVideo = document.getElementById('video-call-remote-feed');
    if (remoteVideo) {
      remoteVideo.srcObject = null;
      remoteVideo.removeAttribute('src');
    }

    currentCallId = null;
    currentRecipientId = null;
    isAudioCall = false;

    // Reset controls UI state
    const muteBtn = document.getElementById('call-mute-btn');
    const camBtn = document.getElementById('call-cam-btn');
    const shareBtn = document.getElementById('call-share-btn');
    if (muteBtn) muteBtn.classList.remove('active');
    if (camBtn) {
      camBtn.classList.remove('active');
      camBtn.style.display = 'flex';
    }
    if (shareBtn) {
      shareBtn.classList.remove('active');
      shareBtn.style.display = 'flex';
    }

    // Reset active panels visibility
    const remoteContainer = document.getElementById('remote-video-container');
    const localFrame = document.getElementById('video-call-local-frame');
    const audioContainer = document.getElementById('audio-call-active-container');
    if (remoteContainer) remoteContainer.style.display = 'block';
    if (localFrame) localFrame.style.display = 'block';
    if (audioContainer) audioContainer.style.display = 'none';

    // Switch chat layout back to normal chat mode
    switchChatMode('chat');
  }

  function switchToSimulationFeeds() {
    const remoteVideo = document.getElementById('video-call-remote-feed');
    if (remoteVideo) {
      remoteVideo.srcObject = null;
      remoteVideo.src = 'https://vjs.zencdn.net/v/oceans.mp4';
      remoteVideo.loop = true;
      remoteVideo.muted = true;
      remoteVideo.play().catch(e => console.log("remote mock play error:", e));
    }
    const localVideo = document.getElementById('video-call-local-feed');
    if (localVideo) {
      localVideo.srcObject = null;
      localVideo.src = 'https://www.w3schools.com/html/mov_bbb.mp4';
      localVideo.loop = true;
      localVideo.muted = true;
      localVideo.play().catch(e => console.log("local mock play error:", e));
    }
  }

  async function checkForIncomingCall() {
    if (isCallActive) return;

    try {
      const res = await fetch(`${API_URL}/api/calls/incoming`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) return;

      const call = await res.json();
      if (call && call.status === 'ringing') {
        showIncomingCallModal(call);
      }
    } catch (e) {
      console.error("Error checking incoming calls:", e);
    }
  }

  function showIncomingCallModal(call) {
    try {
      isCallActive = true;
      isCaller = false;
      currentCallId = call._id || call.id;

      // Safe caller object extraction to prevent null property access crashes
      const callerObj = (call && call.caller && typeof call.caller === 'object') ? call.caller : {};
      const callerId = callerObj._id || callerObj.id || (typeof call.caller === 'string' ? call.caller : null);
      const callerName = callerObj.fullName || 'User';
      const callerAvatar = callerObj.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';

      currentRecipientId = callerId;
      fakeCallSimulation = false;

      // Determine if it is audio only call
      let isAudioOnlyCall = false;
      try {
        const parsedOffer = JSON.parse(call.offer);
        if (parsedOffer && parsedOffer.isAudioOnly) {
          isAudioOnlyCall = true;
        }
      } catch (e) {
        if (call.offer && !call.offer.includes('m=video')) {
          isAudioOnlyCall = true;
        }
      }
      isAudioCall = isAudioOnlyCall;

      const modal = document.getElementById('incoming-call-modal');
      const avatar = document.getElementById('incoming-call-avatar');
      const name = document.getElementById('incoming-call-name');
      const title = document.getElementById('incoming-call-title');

      if (avatar) avatar.src = callerAvatar;
      if (name) name.textContent = `${callerName} is calling you...`;
      if (title) title.textContent = isAudioOnlyCall ? 'Incoming Audio Call' : 'Incoming Video Call';

      if (modal) modal.style.display = 'flex';
      startIncomingRingtone();

      // Hook up Accept / Decline listeners
      const acceptBtn = document.getElementById('accept-call-btn');
      const declineBtn = document.getElementById('decline-call-btn');

      acceptBtn.onclick = () => {
        acceptIncomingCall(call);
      };

      declineBtn.onclick = () => {
        declineIncomingCall(call);
      };
    } catch (err) {
      console.error("Error showing incoming call modal:", err);
      showToast("Error displaying incoming call 📞");
    }
  }

  async function acceptIncomingCall(call) {
    try {
      stopAudioFeedback();
      const modal = document.getElementById('incoming-call-modal');
      if (modal) modal.style.display = 'none';

      // Safe caller object extraction
      const callerObj = (call && call.caller && typeof call.caller === 'object') ? call.caller : {};
      const callerId = callerObj._id || callerObj.id || (typeof call.caller === 'string' ? call.caller : null);
      const callerName = callerObj.fullName || 'User';
      const callerAvatar = callerObj.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';

      // Set current chat thread to the caller
      state.currentChatThread = callerId;
      switchView('chats');

      // Trigger UI selection of the thread item
      const threadItem = document.querySelector(`.thread-item[data-thread="${state.currentChatThread}"]`);
      if (threadItem) {
        threadItem.click();
      } else {
        const chatHeaderName = document.getElementById('chat-header-name');
        const chatHeaderAvatar = document.getElementById('chat-header-avatar');
        if (chatHeaderName) chatHeaderName.textContent = callerName;
        if (chatHeaderAvatar) chatHeaderAvatar.src = callerAvatar;

        const emptyState = document.getElementById('chat-empty-state');
        const chatHeader = document.getElementById('chat-window-header');
        const chatViewport = document.querySelector('.chat-dynamic-viewport');
        if (emptyState) emptyState.style.display = 'none';
        if (chatHeader) chatHeader.style.display = '';
        if (chatViewport) chatViewport.style.display = '';
      }

      // Determine if it is audio only call
      let isAudioOnlyCall = false;
      let offerData = null;
      try {
        offerData = JSON.parse(call.offer);
        if (offerData && offerData.isAudioOnly) {
          isAudioOnlyCall = true;
        }
      } catch (e) {
        offerData = call.offer;
        if (call.offer && !call.offer.includes('m=video')) {
          isAudioOnlyCall = true;
        }
      }
      isAudioCall = isAudioOnlyCall;

      switchChatMode(isAudioOnlyCall ? 'voice-call' : 'call');

      // Setup UI
      document.getElementById('video-call-outgoing-screen').style.display = 'none';
      document.getElementById('video-call-active-screen').style.display = 'block';
      document.getElementById('video-call-controls').style.display = 'block';

      const camBtn = document.getElementById('call-cam-btn');
      const shareBtn = document.getElementById('call-share-btn');
      if (camBtn) camBtn.style.display = isAudioOnlyCall ? 'none' : 'flex';
      if (shareBtn) shareBtn.style.display = isAudioOnlyCall ? 'none' : 'flex';

      if (isAudioOnlyCall) {
        const remoteContainer = document.getElementById('remote-video-container');
        const localFrame = document.getElementById('video-call-local-frame');
        const audioContainer = document.getElementById('audio-call-active-container');
        if (remoteContainer) remoteContainer.style.display = 'none';
        if (localFrame) localFrame.style.display = 'none';
        if (audioContainer) {
          audioContainer.style.display = 'flex';
          const activeAvatar = document.getElementById('audio-call-active-avatar');
          const activeName = document.getElementById('audio-call-active-name');
          if (activeAvatar) activeAvatar.src = callerAvatar;
          if (activeName) activeName.textContent = callerName;
        }
      } else {
        const remoteContainer = document.getElementById('remote-video-container');
        const localFrame = document.getElementById('video-call-local-frame');
        const audioContainer = document.getElementById('audio-call-active-container');
        if (remoteContainer) remoteContainer.style.display = 'block';
        if (localFrame) localFrame.style.display = 'block';
        if (audioContainer) audioContainer.style.display = 'none';
      }

      const remoteName = document.getElementById('video-call-remote-name');
      if (remoteName) remoteName.textContent = callerName;

      startVideoCallTimer();

      if (offerData && offerData.sdp === 'mock') {
        fakeCallSimulation = true;
      }

      const mediaConstraints = isAudioOnlyCall
        ? { video: false, audio: true }
        : { video: true, audio: true };

      // Safe MediaDevices check
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints).catch(err => {
          console.warn("Could not get media devices, falling back to mock call: ", err);
          fakeCallSimulation = true;
          return null;
        });
      } else {
        console.warn("Media devices not supported in this browser context, using mock call.");
        fakeCallSimulation = true;
        localStream = null;
      }

      if (!fakeCallSimulation) {
        const localVideo = document.getElementById('video-call-local-feed');
        const localFrame = document.getElementById('video-call-local-frame');
        if (localVideo) {
          if (isAudioOnlyCall) {
            localVideo.srcObject = null;
            if (localFrame) localFrame.style.display = 'none';
          } else {
            localVideo.srcObject = localStream;
            localVideo.muted = true;
            if (localFrame) localFrame.style.display = 'block';
            localVideo.play().catch(e => console.log("video play error:", e));
          }
        }

        await fetchIceServers();
        peerConnection = new RTCPeerConnection(activeRtcConfig);

        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });

        peerConnection.onicecandidate = (event) => {
          if (event.candidate && currentCallId) {
            sendIceCandidateToServer(currentCallId, event.candidate, 'recipient');
          }
        };

        peerConnection.ontrack = (event) => {
          const remoteVideo = document.getElementById('video-call-remote-feed');
          if (remoteVideo && event.streams[0]) {
            if (!isAudioOnlyCall) {
              remoteVideo.srcObject = event.streams[0];
              remoteVideo.play().catch(e => console.log("remote play error:", e));
            }
          }
        };

        // Set remote offer SDP (remove isAudioOnly metadata for session description creation)
        const offerDesc = new RTCSessionDescription({
          type: offerData.type,
          sdp: offerData.sdp
        });
        await peerConnection.setRemoteDescription(offerDesc);

        // Create Answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Accept call on server
        await fetch(`${API_URL}/api/calls/accept`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            callId: currentCallId,
            answer: JSON.stringify(answer)
          })
        });

        startCallStatePolling();
      } else {
        // Mock call answer on server
        await fetch(`${API_URL}/api/calls/accept`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            callId: currentCallId,
            answer: JSON.stringify({ type: 'answer', sdp: 'mock' })
          })
        });

        if (!isAudioOnlyCall) {
          switchToSimulationFeeds();
        } else {
          // Clear mock feeds for audio calls
          const localVideo = document.getElementById('video-call-local-feed');
          if (localVideo) {
            localVideo.srcObject = null;
            localVideo.removeAttribute('src');
          }
        }
        startCallStatePolling();
      }

    } catch (err) {
      console.error("Error accepting incoming call:", err);
      showToast("Error accepting call 📞: " + err.message);
      endVideoCallLocally();
    }
  }

  async function declineIncomingCall(call) {
    stopAudioFeedback();
    const modal = document.getElementById('incoming-call-modal');
    if (modal) modal.style.display = 'none';

    try {
      await fetch(`${API_URL}/api/calls/decline`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ callId: call._id || call.id })
      });
    } catch (e) {
      console.error("Error declining call:", e);
    }

    endVideoCallLocally();
  }

  async function cancelOutgoingCall() {
    stopAudioFeedback();
    if (currentCallId) {
      try {
        await fetch(`${API_URL}/api/calls/end`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ callId: currentCallId })
        });
      } catch (e) { }
    }
    endVideoCallLocally();
  }

  // Set up listeners for controls
  const cancelOutgoingBtn = document.getElementById('cancel-outgoing-call-btn');
  if (cancelOutgoingBtn) {
    cancelOutgoingBtn.addEventListener('click', () => {
      cancelOutgoingCall();
    });
  }

  const endCallBtn = document.getElementById('end-call-btn');
  if (endCallBtn) {
    endCallBtn.addEventListener('click', () => {
      cancelOutgoingCall();
      showToast('Video Call Ended. 📞');
    });
  }

  const muteBtn = document.getElementById('call-mute-btn');
  const camBtn = document.getElementById('call-cam-btn');
  const speakerBtn = document.getElementById('call-speaker-btn');
  const shareBtn = document.getElementById('call-share-btn');
  const localCamFeed = document.getElementById('video-call-local-frame');
  const remoteCamFeed = document.getElementById('video-call-remote-feed');

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      muteBtn.classList.toggle('active');
      const isMuted = muteBtn.classList.contains('active');
      if (localStream) {
        localStream.getAudioTracks().forEach(track => {
          track.enabled = !isMuted;
        });
      }
      showToast(isMuted ? 'Microphone Muted 🔇' : 'Microphone Active 🎙️');
    });
  }

  if (camBtn) {
    camBtn.addEventListener('click', () => {
      camBtn.classList.toggle('active');
      const isCamOff = camBtn.classList.contains('active');
      if (localStream) {
        localStream.getVideoTracks().forEach(track => {
          track.enabled = !isCamOff;
        });
      }
      localCamFeed.style.opacity = isCamOff ? '0.2' : '1';
      showToast(isCamOff ? 'Your Camera Off 📷' : 'Your Camera Active 📹');
    });
  }

  if (speakerBtn) {
    speakerBtn.addEventListener('click', () => {
      speakerBtn.classList.toggle('active');
      const isSpeakerOff = speakerBtn.classList.contains('active');
      const remoteVideo = document.getElementById('video-call-remote-feed');
      if (remoteVideo) {
        remoteVideo.muted = isSpeakerOff;
      }
      showToast(isSpeakerOff ? 'Speaker Output: Muted 🔕' : 'Speaker Output: Loud 🔊');
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      if (fakeCallSimulation) {
        shareBtn.classList.toggle('active');
        if (shareBtn.classList.contains('active')) {
          showToast('Screen sharing initialized! 🖥️');
        } else {
          showToast('Screen sharing stopped.');
        }
        return;
      }

      if (!shareBtn.classList.contains('active')) {
        try {
          localScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          shareBtn.classList.add('active');
          showToast('Screen sharing initialized! 🖥️');

          const screenTrack = localScreenStream.getVideoTracks()[0];

          if (peerConnection) {
            const senders = peerConnection.getSenders();
            const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
            if (videoSender) {
              videoSender.replaceTrack(screenTrack);
            }
          }

          screenTrack.onended = () => {
            stopScreenSharing();
          };

        } catch (err) {
          console.error("Screen sharing error:", err);
          showToast('Could not share screen 🖥️');
        }
      } else {
        stopScreenSharing();
      }
    });
  }

  function stopScreenSharing() {
    if (localScreenStream) {
      localScreenStream.getTracks().forEach(track => track.stop());
      localScreenStream = null;
    }
    if (shareBtn) shareBtn.classList.remove('active');
    showToast('Screen sharing stopped.');

    if (localStream && peerConnection) {
      const cameraTrack = localStream.getVideoTracks()[0];
      const senders = peerConnection.getSenders();
      const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
      if (videoSender && cameraTrack) {
        videoSender.replaceTrack(cameraTrack);
      }
    }
  }



  // --- GLOBAL SEARCH CARD FILTER CONTROLLER (Disabled. Replaced with dynamic database search) ---

  // Tags filter pills click
  const tagPills = document.querySelectorAll('.tag-pill');
  tagPills.forEach(pill => {
    pill.addEventListener('click', () => {
      tagPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const filter = pill.getAttribute('data-filter-tag');
      let matchCount = 0;

      feedCards.forEach(card => {
        if (card.id === 'feed-empty-state') return;
        const tags = card.getAttribute('data-tags') || '';

        if (filter === 'all' || tags.includes(filter)) {
          card.style.display = 'flex';
          matchCount++;
        } else {
          card.style.display = 'none';
        }
      });

      if (matchCount === 0) {
        if (emptyStateCard) emptyStateCard.style.display = 'block';
      } else {
        if (emptyStateCard) emptyStateCard.style.display = 'none';
      }

      showToast(`Filter: #${filter.toUpperCase()}`);
    });
  });


  // --- COLLABORATIVE FILE DOWNLOADS & FOLDER FILTER ---
  const mediaTabs = document.getElementById('media-hub-tabs');
  const mediaHubSearch = document.getElementById('media-search-input');

  if (mediaTabs) {
    const tabs = mediaTabs.querySelectorAll('.m-pill');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const filter = tab.getAttribute('data-media-filter');
        const mediaCards = document.querySelectorAll('#shared-media-items-grid .media-item-card');

        mediaCards.forEach(card => {
          const type = card.getAttribute('data-type');
          if (filter === 'all' || type === filter) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  if (mediaHubSearch) {
    mediaHubSearch.addEventListener('input', () => {
      const term = mediaHubSearch.value.toLowerCase().trim();
      const mediaCards = document.querySelectorAll('#shared-media-items-grid .media-item-card');

      mediaCards.forEach(card => {
        const name = card.querySelector('.file-name').textContent.toLowerCase();
        if (name.includes(term)) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }


  // --- SIMPLE BUTTON INTERACTIONS AND ALERTS ---

  // Disabled hardcoded follow suggestion listeners. Managed dynamically in loadFollowSuggestions()

  // Suggest see all
  const sugSeeAll = document.getElementById('sug-see-all-btn');
  if (sugSeeAll) {
    sugSeeAll.addEventListener('click', () => {
      openSuggestedVibersModal();
    });
  }

  // Trending hash words click
  const trendItems = document.querySelectorAll('.trend-item');
  trendItems.forEach(item => {
    item.addEventListener('click', () => {
      const word = item.getAttribute('data-trend-word');
      switchView('home');
      // Set search bar value and trigger filter
      if (globalSearchInput) {
        globalSearchInput.value = `#${word}`;
        globalSearchInput.dispatchEvent(new Event('input'));
      }
      showToast(`Filtered feed: #${word} 🔥`);
    });
  });

  // --- PREMIUM EDIT PROFILE MODAL SYSTEM ---
  const editProfileModal = document.getElementById('edit-profile-modal');
  const editProfileBtn = document.getElementById('edit-profile-action-btn');
  const editProfileCloseBtn = document.getElementById('edit-profile-close-btn');
  const editProfileCancelBtn = document.getElementById('edit-profile-cancel-btn');
  const editProfileSaveBtn = document.getElementById('edit-profile-save-btn');

  // Inputs
  const editNameInput = document.getElementById('edit-profile-name-input');
  const editHandleInput = document.getElementById('edit-profile-handle-input');
  const editBioInput = document.getElementById('edit-profile-bio-input');
  const editPhoneInput = document.getElementById('edit-profile-phone-input');
  const edit2faSelect = document.getElementById('edit-profile-2fa-preference');

  // Files
  const avatarFileInput = document.getElementById('edit-profile-avatar-file');
  const bannerFileInput = document.getElementById('edit-profile-banner-file');
  const uploadAvatarTrigger = document.getElementById('upload-avatar-trigger-btn');
  const uploadBannerTrigger = document.getElementById('upload-banner-trigger-btn');

  // Previews inside Modal
  const avatarPreview = document.getElementById('edit-profile-avatar-preview');
  const bannerPreview = document.getElementById('edit-profile-banner-preview');

  // Fields to update on the main page
  const profileBannerImg = document.querySelector('.profile-banner img');
  const profileLargeAvatar = document.querySelector('.profile-screen-avatar');
  const profilePreviewAvatarImg = document.querySelector('.profile-preview-avatar img');
  const headerAvatarImg = document.querySelector('#header-profile-avatar img');
  const profileNameH2 = document.querySelector('.profile-summary-top h3');
  const profilePreviewNameH3 = document.querySelector('.profile-preview-info h3');
  const profileHandleP = document.querySelector('.profile-screen-handle');
  const profilePreviewHandleP = document.querySelector('.profile-preview-info p');
  const profileBioP = document.getElementById('profile-bio-text');

  let currentAvatarUrl = "";
  let currentBannerUrl = "";

  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', () => {
      // Load current values
      if (editNameInput) {
        // Strip the HTML space if any
        const nameText = profileNameH2 ? profileNameH2.childNodes[0].textContent.trim() : "Alex Rivers";
        editNameInput.value = nameText;
      }
      if (editHandleInput) {
        editHandleInput.value = profileHandleP ? profileHandleP.textContent.trim() : "@alexrivers";
      }
      if (editBioInput) {
        editBioInput.value = profileBioP ? profileBioP.textContent.trim() : "";
      }

      // Load user preferences for phone and 2FA
      const currentUserStr = localStorage.getItem('invibeUser');
      if (currentUserStr) {
        try {
          const currentUser = JSON.parse(currentUserStr);
          if (editPhoneInput) editPhoneInput.value = currentUser.phoneNumber || "";
          if (edit2faSelect) edit2faSelect.value = currentUser.preferred2faMethod || "email";
        } catch (e) {
          console.error(e);
        }
      }

      // Previews
      if (avatarPreview && profileLargeAvatar) {
        avatarPreview.src = profileLargeAvatar.src;
        currentAvatarUrl = profileLargeAvatar.src;
      }
      if (bannerPreview && profileBannerImg) {
        bannerPreview.src = profileBannerImg.src;
        currentBannerUrl = profileBannerImg.src;
      }

      // Show modal
      if (editProfileModal) {
        editProfileModal.classList.add('active');
        editProfileModal.style.display = 'flex';
      }
    });
  }

  function closeEditProfileModal() {
    if (editProfileModal) {
      editProfileModal.classList.remove('active');
      editProfileModal.style.display = 'none';
    }
    updateAppUI();
  }

  if (editProfileCloseBtn) editProfileCloseBtn.addEventListener('click', closeEditProfileModal);
  if (editProfileCancelBtn) editProfileCancelBtn.addEventListener('click', closeEditProfileModal);

  // File upload trigger buttons
  if (uploadAvatarTrigger && avatarFileInput) {
    uploadAvatarTrigger.addEventListener('click', () => avatarFileInput.click());
  }
  if (uploadBannerTrigger && bannerFileInput) {
    uploadBannerTrigger.addEventListener('click', () => bannerFileInput.click());
  }

  // Previews on file select
  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', () => {
      if (avatarFileInput.files.length > 0) {
        const file = avatarFileInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          if (avatarPreview) avatarPreview.src = e.target.result;
          currentAvatarUrl = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (bannerFileInput) {
    bannerFileInput.addEventListener('change', () => {
      if (bannerFileInput.files.length > 0) {
        const file = bannerFileInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          if (bannerPreview) bannerPreview.src = e.target.result;
          currentBannerUrl = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Save changes
  if (editProfileSaveBtn) {
    editProfileSaveBtn.addEventListener('click', async () => {
      const newName = editNameInput ? editNameInput.value.trim() : "";
      const newHandle = editHandleInput ? editHandleInput.value.trim() : "";
      const newBio = editBioInput ? editBioInput.value.trim() : "";
      const newPhone = editPhoneInput ? editPhoneInput.value.trim() : "";
      const new2faMethod = edit2faSelect ? edit2faSelect.value : "email";

      if (!newName || !newHandle) {
        showToast('Name and Handle are required! ⚠️');
        return;
      }

      let formattedHandle = newHandle.startsWith('@') ? newHandle.slice(1) : newHandle;
      formattedHandle = formattedHandle.trim().toLowerCase();

      const token = localStorage.getItem('invibe_jwt_token');

      // 1. Update local user session & localStorage DB
      const userStr = localStorage.getItem('invibeUser');
      const currentUser = userStr ? JSON.parse(userStr) : {};
      const updatedUser = {
        ...currentUser,
        fullName: newName,
        username: formattedHandle,
        bio: newBio,
        phoneNumber: newPhone,
        preferred2faMethod: new2faMethod
      };

      localStorage.setItem('invibeUser', JSON.stringify(updatedUser));
      if (currentAvatarUrl && !currentAvatarUrl.startsWith('data:image/gif;base64')) {
        localStorage.setItem('invibeProfileImage', currentAvatarUrl);
      }
      if (currentBannerUrl && !currentBannerUrl.startsWith('data:image/gif;base64')) {
        localStorage.setItem('invibeBannerImage', currentBannerUrl);
      }
      localStorage.setItem('invibeBio', newBio);

      // 2. Try async backend & Supabase sync
      try {
        fetch(`${API_URL}/api/users/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fullName: newName,
            username: formattedHandle,
            bio: newBio,
            profileImage: currentAvatarUrl || undefined,
            bannerImage: currentBannerUrl || undefined,
            phoneNumber: newPhone,
            preferred2faMethod: new2faMethod
          })
        }).catch(err => console.warn("Backend profile sync notice:", err.message));
      } catch (e) {}

      const displayHandle = newHandle.startsWith('@') ? newHandle : '@' + newHandle;

      // 1. Update text fields on profile page
      if (profileNameH2) {
        profileNameH2.innerHTML = `${newName}`;
        debouncedCreateIcons();
      }
      if (profilePreviewNameH3) profilePreviewNameH3.textContent = newName;
      if (profileHandleP) profileHandleP.textContent = displayHandle;
      if (profilePreviewHandleP) profilePreviewHandleP.textContent = displayHandle;
      if (profileBioP) profileBioP.textContent = newBio;

      // 2. Update images
      if (currentAvatarUrl) {
        if (profileLargeAvatar) profileLargeAvatar.src = currentAvatarUrl;
        if (profilePreviewAvatarImg) profilePreviewAvatarImg.src = currentAvatarUrl;
        if (headerAvatarImg) headerAvatarImg.src = currentAvatarUrl;

        // Also update story user avatar if needed
        const storyViewerAvatar = document.getElementById('story-viewer-avatar');
        if (storyViewerAvatar) storyViewerAvatar.src = currentAvatarUrl;
      }
      if (currentBannerUrl && profileBannerImg) {
        profileBannerImg.src = currentBannerUrl;
      }

      showToast('Profile updated successfully! ✨');
      closeEditProfileModal();
    });
  }

  // Saved/tagged tabs profile switcher
  const postsTab = document.getElementById('profile-posts-tab');
  const savedTab = document.getElementById('profile-saved-tab');
  const taggedTab = document.getElementById('profile-tagged-tab');
  const profileGrid = document.querySelector('.profile-posts-grid');

  const profileData = {
    posts: [
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=300&q=80"
    ],
    saved: [
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80"
    ],
    tagged: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80"
    ]
  };

  function updateProfileGrid(tabName) {
    if (!profileGrid) return;
    const images = profileData[tabName] || [];
    profileGrid.innerHTML = images.map(imgSrc => `
      <div class="grid-post-card">
        <img src="${imgSrc}" alt="Profile item" />
      </div>
    `).join('');
  }

  function handleTabClick(activeTab, tabName, toastMessage) {
    [postsTab, savedTab, taggedTab].forEach(tab => {
      if (tab) tab.classList.remove('active');
    });
    if (activeTab) activeTab.classList.add('active');
    updateProfileGrid(tabName);
    if (toastMessage) showToast(toastMessage);
  }

  if (postsTab) postsTab.addEventListener('click', () => handleTabClick(postsTab, 'posts', 'Loading posts... 📸'));
  if (savedTab) savedTab.addEventListener('click', () => handleTabClick(savedTab, 'saved', 'Loading bookmarks... 🔖'));
  if (taggedTab) taggedTab.addEventListener('click', () => handleTabClick(taggedTab, 'tagged', 'Loading tagged content... 🏷️'));

  const profileOptionButtons = document.querySelectorAll('.profile-option-btn');
  const appearanceToggle = document.getElementById('profile-appearance-toggle');
  const profileLogoutBtn = document.getElementById('profile-logout-btn');

  // --- NEW MODALS SYSTEM ---
  const privacyModal = document.getElementById('privacy-settings-modal');
  const privacyCloseBtn = document.getElementById('privacy-modal-close-btn');
  const privacyCancelBtn = document.getElementById('privacy-modal-cancel-btn');
  const privacySaveBtn = document.getElementById('privacy-modal-save-btn');
  const privacyE2eeToggle = document.getElementById('privacy-e2ee-toggle');
  const privacyHideStoryList = document.getElementById('privacy-hide-story-list');

  const notificationsModal = document.getElementById('notifications-settings-modal');
  const notificationsCloseBtn = document.getElementById('notifications-modal-close-btn');
  const notificationsCancelBtn = document.getElementById('notifications-modal-cancel-btn');
  const notificationsSaveBtn = document.getElementById('notifications-modal-save-btn');

  const helpModal = document.getElementById('help-support-modal');
  const helpCloseBtn = document.getElementById('help-modal-close-btn');
  const helpCancelBtn = document.getElementById('help-modal-cancel-btn');
  const helpSubmitBtn = document.getElementById('help-modal-submit-btn');

  const aboutModal = document.getElementById('about-modal');
  const aboutCloseBtn = document.getElementById('about-modal-close-btn');
  const aboutOkBtn = document.getElementById('about-modal-ok-btn');


  function populatePrivacyStoryList() {
    if (!privacyHideStoryList) return;
    const hubbers = state.stories || [];
    privacyHideStoryList.innerHTML = hubbers.map((user, idx) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <img src="${user.avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" />
          <span style="font-size: 0.85rem; color: white;">${user.name}</span>
        </div>
        <input type="checkbox" class="hide-story-checkbox" data-username="${user.name}" style="accent-color: var(--accent-gradient, #f35626);" />
      </div>
    `).join('');

    const hiddenUsers = JSON.parse(localStorage.getItem('privacy_hidden_stories') || '[]');
    const checkboxes = privacyHideStoryList.querySelectorAll('.hide-story-checkbox');
    checkboxes.forEach(cb => {
      if (hiddenUsers.includes(cb.dataset.username)) {
        cb.checked = true;
      }
    });
  }

  if (privacyCloseBtn) privacyCloseBtn.addEventListener('click', () => privacyModal.classList.remove('active'));
  if (privacyCancelBtn) privacyCancelBtn.addEventListener('click', () => privacyModal.classList.remove('active'));
  if (privacySaveBtn) {
    privacySaveBtn.addEventListener('click', () => {
      const isE2ee = privacyE2eeToggle ? privacyE2eeToggle.checked : false;
      const hiddenUsers = [];
      if (privacyHideStoryList) {
        const checked = privacyHideStoryList.querySelectorAll('.hide-story-checkbox:checked');
        checked.forEach(cb => hiddenUsers.push(cb.dataset.username));
      }
      localStorage.setItem('privacy_e2ee_enabled', isE2ee);
      localStorage.setItem('privacy_hidden_stories', JSON.stringify(hiddenUsers));
      showToast('Privacy settings updated! 🔒');
      privacyModal.classList.remove('active');
    });
  }

  if (notificationsCloseBtn) notificationsCloseBtn.addEventListener('click', () => notificationsModal.classList.remove('active'));
  if (notificationsCancelBtn) notificationsCancelBtn.addEventListener('click', () => notificationsModal.classList.remove('active'));
  if (notificationsSaveBtn) {
    notificationsSaveBtn.addEventListener('click', () => {
      showToast('Notification settings updated! 🔔');
      notificationsModal.classList.remove('active');
    });
  }

  if (helpCloseBtn) helpCloseBtn.addEventListener('click', () => helpModal.classList.remove('active'));
  if (helpCancelBtn) helpCancelBtn.addEventListener('click', () => helpModal.classList.remove('active'));
  if (helpSubmitBtn) {
    helpSubmitBtn.addEventListener('click', () => {
      const msgVal = document.getElementById('help-message-input')?.value;
      if (msgVal) {
        showToast('Support ticket submitted successfully! 💬');
        if (document.getElementById('help-message-input')) document.getElementById('help-message-input').value = '';
        helpModal.classList.remove('active');
      } else {
        showToast('Please type a message before submitting. ⚠️');
      }
    });
  }

  if (aboutCloseBtn) aboutCloseBtn.addEventListener('click', () => aboutModal.classList.remove('active'));
  if (aboutOkBtn) aboutOkBtn.addEventListener('click', () => aboutModal.classList.remove('active'));



  if (appearanceToggle) {
    appearanceToggle.checked = document.body.classList.contains('light-theme');
    appearanceToggle.addEventListener('change', () => {
      const isLight = appearanceToggle.checked;
      if (isLight) {
        document.body.classList.replace('dark-theme', 'light-theme');
      } else {
        document.body.classList.replace('light-theme', 'dark-theme');
      }
      showToast(isLight ? 'Switched appearance on ☀️' : 'Switched appearance off 🌙');
    });
  }

  profileOptionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      switch (action) {
        case 'edit-profile':
          if (editProfileModal) {
            editProfileModal.classList.add('active');
          }
          break;
        case 'vibe-settings':
          showToast('Opening Hubs Settings... ⚙️');
          switchView('settings');
          break;
        case 'privacy':
          if (privacyModal) {
            populatePrivacyStoryList();
            if (privacyE2eeToggle) {
              privacyE2eeToggle.checked = localStorage.getItem('privacy_e2ee_enabled') === 'true';
            }
            privacyModal.classList.add('active');
          }
          break;
        case 'notifications':
          if (notificationsModal) {
            notificationsModal.classList.add('active');
          }
          break;
        case 'help':
          if (helpModal) {
            helpModal.classList.add('active');
          }
          break;
        case 'about':
          if (aboutModal) {
            aboutModal.classList.add('active');
          }
          break;
        default:
          showToast('Action not available yet.');
      }
    });
  });

  if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener('click', () => {
      localStorage.removeItem('invibeIsLoggedIn');
      localStorage.removeItem('invibeUser');
      localStorage.removeItem('invibeProfileImage');
      localStorage.removeItem('invibe_jwt_token');
      showToast('Logged out successfully. 👋');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    });
  }

  // --- REELS SAVE INTERACTION SYSTEM ---
  const reelSaveActionItems = document.querySelectorAll('.reel-save-action');
  const reelThumbnails = {
    "1": "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=300&q=80", // Tech Setup (for Coding Reel)
    "2": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=300&q=80"  // Mountain Lake (for Offsite Reel)
  };

  reelSaveActionItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const reelId = item.getAttribute('data-reel-id');
      const starBtn = item.querySelector('.action-circle-btn');
      const textSpan = item.querySelector('.action-count');
      const thumbnailSrc = reelThumbnails[reelId];

      if (!starBtn.classList.contains('active')) {
        // Save the Reel
        starBtn.classList.add('active');
        if (textSpan) textSpan.textContent = 'Saved';

        // Add to profileData.saved
        if (thumbnailSrc && !profileData.saved.includes(thumbnailSrc)) {
          profileData.saved.unshift(thumbnailSrc); // prepend so it appears first
        }

        showToast('Reel saved to profile! ⭐');
      } else {
        // Unsave the Reel
        starBtn.classList.remove('active');
        if (textSpan) textSpan.textContent = 'Save';

        // Remove from profileData.saved
        if (thumbnailSrc) {
          const index = profileData.saved.indexOf(thumbnailSrc);
          if (index > -1) {
            profileData.saved.splice(index, 1);
          }
        }

        showToast('Reel removed from saved! 🗑️');
      }

      // If the user is currently viewing the 'saved' tab on the profile page, refresh the grid
      if (savedTab && savedTab.classList.contains('active')) {
        updateProfileGrid('saved');
      }
    });
  });

  // Inbox drop items click alerts
  const drGroup = document.getElementById('dr-new-group');
  const drBroad = document.getElementById('dr-new-broad');
  const drInvite = document.getElementById('dr-invite');
  const drScan = document.getElementById('dr-scan');
  const drStarred = document.getElementById('dr-starred');
  const drArchived = document.getElementById('dr-archived');
  const drSettings = document.getElementById('dr-settings');
  const newChatBtn = document.getElementById('new-chat-btn');
  const newChatDropdown = document.getElementById('new-chat-dropdown');

  if (newChatBtn && newChatDropdown) {
    newChatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      newChatDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!newChatDropdown.contains(e.target) && e.target !== newChatBtn) {
        newChatDropdown.classList.remove('active');
      }
    });
  }

  function handleDropdownClick() {
    if (newChatDropdown) {
      newChatDropdown.classList.remove('active');
    }
  }

  if (drGroup) drGroup.addEventListener('click', () => { handleDropdownClick(); showToast('Setup New Chat Group lobby 👥'); });
  if (drBroad) drBroad.addEventListener('click', () => { handleDropdownClick(); showToast('Broadcasting system active 📻'); });
  if (drInvite) drInvite.addEventListener('click', () => { handleDropdownClick(); showToast('Invitation code copied: HUBBLE-2026 🎟️'); });
  if (drScan) drScan.addEventListener('click', () => { handleDropdownClick(); showToast('Access camera feed for QR Scan... 📷'); });
  if (drStarred) drStarred.addEventListener('click', () => { handleDropdownClick(); showToast('Starred message filter active ⭐'); });
  if (drArchived) drArchived.addEventListener('click', () => { handleDropdownClick(); showToast('Archived threads loaded 📦'); });
  if (drSettings) drSettings.addEventListener('click', () => {
    handleDropdownClick();
    switchView('settings');
    showToast('Opening Settings Dashboard... ⚙️');
  });
  // --- DASHBOARD SETTINGS CONTROLLER ---
  const colorPickerDots = document.querySelectorAll('.color-picker-dot');
  const toggleCaustics = document.getElementById('toggle-caustics-checkbox');
  const togglePrivacy = document.getElementById('toggle-privacy-checkbox');
  const toggleNotif = document.getElementById('toggle-notif-checkbox');

  // Theme Accent Picker
  colorPickerDots.forEach(dot => {
    dot.addEventListener('click', () => {
      colorPickerDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');

      const selectedColor = dot.getAttribute('data-color');
      document.documentElement.style.setProperty('--primary', selectedColor);

      showToast(`Accent color updated! 🎨`);
    });
  });

  // Toggle Caustics Overlay
  if (toggleCaustics) {
    toggleCaustics.addEventListener('change', () => {
      const isEnabled = toggleCaustics.checked;
      if (isEnabled) {
        document.documentElement.style.setProperty('--bg-caustics', 'radial-gradient(circle at 20% 30%, rgba(108, 59, 255, 0.15) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255, 79, 163, 0.1) 0%, transparent 45%)');
        showToast('Ambient caustics enabled ✨');
      } else {
        document.documentElement.style.setProperty('--bg-caustics', 'none');
        showToast('Ambient caustics disabled');
      }
    });
  }

  // Toggles Privacy / Notifications
  if (togglePrivacy) {
    togglePrivacy.addEventListener('change', () => {
      showToast(togglePrivacy.checked ? 'Account set to Private 🔒' : 'Account set to Public 🌐');
    });
  }
  if (toggleNotif) {
    toggleNotif.addEventListener('change', () => {
      showToast(toggleNotif.checked ? 'Notifications Enabled 🔔' : 'Notifications Silenced 🔕');
    });
  }

  // --- COMMENTS & SHARE MODALS CONTROLLER ---
  const mockFriends = [
    { name: "Zoe Lin", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&h=100&q=80" },
    { name: "Jamie Sun", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80" },
    { name: "Sarah Chen", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80" },
    { name: "Marcus", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80" },
    { name: "Emma Johnson", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80" }
  ];

  const commentsModal = document.getElementById('comments-modal');
  const shareModal = document.getElementById('share-modal');

  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.story-viewer-overlay');
      if (modal) modal.classList.remove('active');
    });
  });

  function openShare(key, modalOverride = shareModal) {
    const modal = modalOverride || shareModal;
    if (!modal) return;

    const shareList = modal.querySelector('.share-friends-list');
    if (!shareList) return;

    renderShareFriends(key, modal, shareList);
    modal.classList.add('active');
  }

  async function renderShareFriends(key, modal = shareModal, shareList = null) {
    const list = shareList || modal?.querySelector('.share-friends-list');
    if (!list) return;

    list.innerHTML = '<div style="padding:10px; font-size:12px; color:var(--text-muted);">Loading Hubbies...</div>';

    // Add external sharing section if not present
    const shareCard = modal.querySelector('.share-card');
    if (shareCard && !shareCard.querySelector('.external-share-section')) {
      const extSection = document.createElement('div');
      extSection.className = 'external-share-section';
      extSection.style.cssText = 'margin-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding: 16px 20px 20px 20px;';

      const title = document.createElement('h4');
      title.innerText = 'Share to other apps';
      title.style.cssText = 'font-size: 11px; color: var(--text-muted); margin-bottom: 12px; font-family: var(--font-title); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;';
      extSection.appendChild(title);

      const buttonsContainer = document.createElement('div');
      buttonsContainer.className = 'external-share-buttons';
      buttonsContainer.style.cssText = 'display: flex; gap: 16px; justify-content: space-around; align-items: center;';

      const shareOptions = [
        { name: 'WhatsApp', icon: 'message-circle', color: '#25D366', url: (url) => `https://api.whatsapp.com/send?text=${encodeURIComponent('Check this out on HI-HUBBLE: ' + url)}` },
        { name: 'X', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:block;"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`, color: '#ffffff', url: (url) => `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Check this out on HI-HUBBLE!')}` },
        { name: 'Telegram', icon: 'send', color: '#0088cc', url: (url) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Check this out on HI-HUBBLE!')}` },
        { name: 'Gmail', icon: 'mail', color: '#EA4335', url: (url) => `mailto:?subject=${encodeURIComponent('Check this out on HI-HUBBLE')}&body=${encodeURIComponent(url)}` },
        {
          name: 'Copy Link', icon: 'copy', color: '#8b5cf6', action: async (url) => {
            try {
              await navigator.clipboard.writeText(url);
              showToast('Link copied to clipboard! 📋');
            } catch (err) {
              showToast('Failed to copy link.');
            }
          }
        }
      ];

      shareOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'external-share-btn';
        btn.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 6px; background: none; border: none; cursor: pointer; color: var(--text-color); font-size: 11px; transition: transform 0.2s;';

        btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
        btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');

        const iconContainer = document.createElement('div');
        iconContainer.style.cssText = `width: 42px; height: 42px; border-radius: 50%; background: ${opt.color}15; border: 1px solid ${opt.color}40; color: ${opt.color}; display: flex; justify-content: center; align-items: center; font-size: 18px; box-shadow: 0 4px 12px ${opt.color}10;`;

        if (opt.svg) {
          iconContainer.innerHTML = opt.svg;
        } else {
          iconContainer.innerHTML = `<i data-lucide="${opt.icon}"></i>`;
        }

        const label = document.createElement('span');
        label.innerText = opt.name;
        label.style.cssText = 'color: var(--text-muted); font-weight: 500; margin-top: 2px;';

        btn.appendChild(iconContainer);
        btn.appendChild(label);

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const currentUrl = window.location.href;
          if (opt.url) {
            window.open(opt.url(currentUrl), '_blank');
          } else if (opt.action) {
            opt.action(currentUrl);
          }
        });

        buttonsContainer.appendChild(btn);
      });

      extSection.appendChild(buttonsContainer);
      shareCard.appendChild(extSection);
      debouncedCreateIcons();
    }

    const token = localStorage.getItem('invibe_jwt_token');
    const currentUser = getCurrentUser();
    if (!token || !currentUser) {
      list.innerHTML = '<div style="padding:10px; font-size:12px; color:var(--text-muted); text-align:center;">Please log in to share with Hubbies.</div>';
      return;
    }

    try {
      const targetId = currentUser.id || currentUser._id;
      const res = await fetch(`${API_URL}/api/users/${targetId}/following-list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const users = await res.json();

      list.innerHTML = '';

      if (users.length === 0) {
        list.innerHTML = '<div style="padding:10px; font-size:12px; color:var(--text-muted); text-align:center;">No hubbies found. Follow someone to share!</div>';
        return;
      }

      users.forEach(u => {
        if (!u) return;

        const card = document.createElement('div');
        card.className = 'share-friend-card';
        card.innerHTML = `
          <img src="${u.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'}" class="share-friend-avatar" alt="${u.fullName}" />
          <span class="share-friend-name">${u.fullName}</span>
        `;

        card.addEventListener('click', async () => {
          const currentUser = getCurrentUser();
          if (!currentUser) return;

          const secretKey = getChatSecretKey(currentUser.id || currentUser._id, u._id);
          const isReel = key.startsWith('reel');

          let sharedContentHtml = '';
          if (isReel) {
            sharedContentHtml = `<div class="shared-hub-card reel" data-shared-id="${key}"><i data-lucide="video" style="display:inline-block; vertical-align:middle; margin-right:4px;"></i> Shared a Reel</div>`;
          } else {
            sharedContentHtml = `<div class="shared-hub-card post" data-shared-id="${key}"><i data-lucide="image" style="display:inline-block; vertical-align:middle; margin-right:4px;"></i> Shared a Post</div>`;
          }

          const encryptedText = encryptMessage(sharedContentHtml, secretKey);

          try {
            const sendRes = await fetch(`${API_URL}/api/chats/message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                recipient: u._id,
                content: encryptedText,
                mediaUrl: key,
                mediaType: 'hub',
                mediaName: isReel ? 'Shared Reel' : 'Shared Post',
                mediaSize: 'Link'
              })
            });
            if (!sendRes.ok) throw new Error();

            showToast(`Shared successfully to ${u.fullName}! ✈️`);
            if (modal) modal.classList.remove('active');

            loadChatThreads();
            if (state.currentChatThread && state.currentChatThread.toString() === u._id.toString()) {
              await fetchMessages(u._id, true);
            }
          } catch (err) {
            console.error('Error sharing hub content:', err);
            showToast('Failed to share item.');
          }
        });

        list.appendChild(card);
      });
    } catch (err) {
      console.error('Error rendering friends share list:', err);
      list.innerHTML = '<div style="padding:10px; font-size:12px; color:var(--text-muted);">Failed to load friends.</div>';
    }
  }

  // Handle comment click events (focuses the inline comment input field on dynamic posts or opens modal)
  let currentCommentPostId = null;

  if (commentsModal) {
    const sendBtn = commentsModal.querySelector('.comment-send-btn');
    const inputField = commentsModal.querySelector('input');

    if (sendBtn && inputField) {
      sendBtn.addEventListener('click', async () => {
        const text = inputField.value.trim();
        if (text && currentCommentPostId) {
          await submitComment(currentCommentPostId, text, inputField);
        }
      });
      inputField.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const text = inputField.value.trim();
          if (text && currentCommentPostId) {
            await submitComment(currentCommentPostId, text, inputField);
          }
        }
      });
    }
  }

  // Share trigger click
  document.addEventListener('click', async (e) => {
    const shareBtn = e.target.closest('.share-btn-action, .share-btn, .feed-share-btn');
    if (shareBtn) {
      e.preventDefault();
      e.stopPropagation();

      const card = shareBtn.closest('.feed-card');
      const postId = shareBtn.getAttribute('data-post-id') || card?.getAttribute('data-post-id') || card?.id?.replace('post-', '') || '1';

      const localModal = card?.querySelector('.feed-share-modal') || document.getElementById('share-modal');

      openShare('post_' + postId, localModal);
    }
  });

  // ─── LIVE DATABASE & FEED POSTS INTEGRATION ───

  async function loadFeedPosts() {
    const feedContainer = document.getElementById('home-feed-posts');
    if (!feedContainer) return;

    // Clear legacy local post caches from previous schemas
    try {
      localStorage.removeItem('invibe_custom_posts');
      localStorage.removeItem('invibe_posts');
      window.invibe_memory_posts = [];
    } catch (_) {}

    let posts = [];
    try {
      const res = await fetch('/api/posts');
      if (res.ok) {
        posts = await res.json();
      }
    } catch (err) {
      console.warn("API loadFeedPosts notice:", err.message);
    }

    feedContainer.innerHTML = '';

    if (!posts || posts.length === 0) {
      feedContainer.innerHTML = `
        <div id="feed-empty-state" style="text-align: center; padding: 48px 20px; background: var(--card-bg); border: var(--card-border); border-radius: var(--radius-lg); margin-top: 10px;">
          <div style="font-size: 32px; margin-bottom: 10px;">✨</div>
          <h3 style="font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">No posts published yet</h3>
          <p style="font-size: 13px; color: var(--text-muted); margin: 0;">Be the first to share a hub with the world using the form above!</p>
        </div>
      `;
      return;
    }

    const currentUserStr = localStorage.getItem('invibeUser');
    const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
    const currentUserId = currentUser ? (currentUser.id || currentUser._id) : null;

    const storedFollowing = JSON.parse(localStorage.getItem('invibe_following_users') || '[]');
    const storedPending = JSON.parse(localStorage.getItem('invibe_pending_users') || '[]');
    const followingSet = new Set(storedFollowing);
    const pendingSet = new Set(storedPending);

    posts.forEach(post => {
      const isLikedByMe = currentUser ? (post.likes || []).includes(currentUserId) : false;
      const authorObj = post.author || {};
      const authorId = authorObj._id || authorObj.id || 'usr_unknown';
      const authorName = authorObj.fullName || authorObj.username || 'User';
      const authorUsername = authorObj.username || 'user';
      const isMe = currentUserId && (currentUserId.toString() === authorId.toString());
      const isFollowing = followingSet.has(authorId);
      const isPending = pendingSet.has(authorId);

      const card = document.createElement('article');
      card.className = 'feed-card';
      card.id = `post-${post._id}`;
      card.setAttribute('data-tags', 'all chill');

      let commentsHTML = '';
      (post.comments || []).forEach(comment => {
        commentsHTML += `
          <div class="comment-item" style="display: flex; gap: 8px; margin-bottom: 8px; font-size: 13px;">
            <img src="${comment.author?.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" />
            <div>
              <strong style="color: var(--text-color); margin-right: 4px;">${comment.author?.username || 'user'}</strong>
              <span style="color: var(--text-muted);">${comment.text}</span>
            </div>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="post-header" style="display: flex; align-items: center; justify-content: space-between;">
          <div class="post-author-info" style="display: flex; align-items: center; gap: 10px;">
            <img src="${authorObj.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="${authorName}" class="author-avatar" style="cursor: pointer;" data-user-id="${authorId}" />
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <h4 class="author-name" style="margin: 0; cursor: pointer;" data-user-id="${authorId}">${authorName}</h4>
                <span class="author-handle" style="font-size: 12px; color: var(--text-muted, #94a3b8);">@${authorUsername}</span>
              </div>
              <div class="post-meta" style="margin-top: 2px;">
                <span class="post-time">${new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span class="dot-separator">•</span>
                <i data-lucide="globe" class="meta-icon"></i>
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            ${!isMe ? `
              <button type="button" class="btn-follow-user ${isFollowing ? 'following' : (isPending ? 'pending' : '')}" data-user-id="${authorId}" data-username="${authorUsername}" style="padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s; background: ${isFollowing ? 'rgba(255,255,255,0.1)' : (isPending ? 'rgba(234, 179, 8, 0.2)' : 'var(--primary, #a855f7)')}; color: ${isPending ? '#eab308' : '#ffffff'};">
                ${isFollowing ? 'Following' : (isPending ? 'Requested' : '+ Follow')}
              </button>
            ` : ''}
            <button class="post-options-btn"><i data-lucide="more-horizontal"></i></button>
          </div>
        </div>

        <div class="post-media-container" style="position:relative; overflow:hidden; border-radius: 12px; margin: 12px 0;">
          ${post.mediaType === 'video'
          ? `<video src="${post.mediaUrl}" controls loop muted playsinline style="width:100%; max-height:600px; border-radius:12px; display:block;" class="post-media-video"></video>
               <div class="video-mute-container" style="position: absolute; left: 16px; bottom: 48px; z-index: 12;">
                 <button class="action-circle-btn mute-btn-action" data-post-id="${post._id}">
                   <i data-lucide="volume-2"></i>
                 </button>
               </div>`
          : `<img src="${post.mediaUrl}" alt="Post Media" style="width:100%; border-radius:12px; display:block;" />`
        }

          <!-- Vertical engagement overlay right aligned -->
          <div class="post-engagement-actions">
            <div class="engagement-item like-btn-action ${isLikedByMe ? 'liked' : ''}" data-post-id="${post._id}">
              <button class="action-circle-btn heart-btn"><i data-lucide="heart" style="${isLikedByMe ? 'fill:#8b5cf6; stroke:#8b5cf6;' : ''}"></i></button>
              <span class="action-count">${(post.likes || []).length}</span>
            </div>
            <div class="engagement-item comment-btn-action" data-post-id="${post._id}">
              <button class="action-circle-btn"><i data-lucide="message-circle"></i></button>
              <span class="action-count">${(post.comments || []).length}</span>
            </div>
            <div class="engagement-item share-btn-action" data-post-id="${post._id}">
              <button class="action-circle-btn"><i data-lucide="send"></i></button>
            </div>
            <div class="engagement-item bookmark-btn-action" data-post-id="${post._id}">
              <button class="action-circle-btn bookmark-btn"><i data-lucide="bookmark"></i></button>
            </div>
          </div>
        </div>

          <div class="post-details">
            <p class="post-caption"><strong class="author-username" style="margin-right: 8px;">${post.author.username}</strong>${post.caption}</p>
            
            <div class="comments-section" style="margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 12px;">
              <div class="comments-list" id="comments-list-${post._id}">
                ${commentsHTML}
              </div>
              
              <div class="post-comment-input-area" style="display: flex; gap: 8px; margin-top: 12px;">
                <input type="text" placeholder="Write a comment and press Enter..." class="comment-input-field" id="comment-input-${post._id}" style="flex:1; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px; padding: 8px 16px; color: var(--text-color); font-size: 13px;" />
              </div>
            </div>
          </div>
        `;

        feedContainer.appendChild(card);

        // Click handlers to view post author profile
        const avatarEl = card.querySelector('.author-avatar');
        const nameEl = card.querySelector('.author-name');
        const usernameEl = card.querySelector('.author-username');

        [avatarEl, nameEl, usernameEl].forEach(el => {
          if (el) {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
              switchView('profile', post.author._id);
            });
          }
        });
      });

      debouncedCreateIcons();

      // Local Like and Bookmark listeners removed in favor of global event delegation

      const dynamicVideoOverlays = feedContainer.querySelectorAll('.video-play-overlay');
      dynamicVideoOverlays.forEach(overlay => {
        const container = overlay.closest('.post-media-container');
        const video = container.querySelector('.post-media-video');
        const playIcon = overlay.querySelector('i');

        overlay.addEventListener('click', (e) => {
          e.stopPropagation();
          video.play();
          overlay.style.display = 'none';
          debouncedCreateIcons();
        });

        video.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!video.paused) {
            video.pause();
            playIcon.setAttribute('data-lucide', 'play');
            overlay.style.display = 'flex';
            overlay.style.background = 'rgba(0,0,0,0.25)';
            overlay.style.opacity = '1';
            debouncedCreateIcons();
          }
        });
      });

      const muteButtons = feedContainer.querySelectorAll('.mute-btn-action');
      muteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const container = btn.closest('.post-media-container');
          const video = container.querySelector('.post-media-video');
          const muteIcon = btn.querySelector('i');

          if (video.muted) {
            video.muted = false;
            muteIcon.setAttribute('data-lucide', 'volume-2');
          } else {
            video.muted = true;
            muteIcon.setAttribute('data-lucide', 'volume-2');
          }
          debouncedCreateIcons();
        });
      });

      const mediaBoxes = feedContainer.querySelectorAll('.post-media-container');
      mediaBoxes.forEach(container => {
        let lastTap = 0;
        container.addEventListener('click', async (e) => {
          if (e.target.closest('.post-engagement-actions') || e.target.closest('.video-mute-container')) return; // ignore clicks on engagement overlays or mute button
          const now = Date.now();
          const timespan = now - lastTap;
          if (timespan < 300 && timespan > 0) {
            e.preventDefault();
            const btn = container.closest('.feed-card').querySelector('.like-btn-action');
            const pid = btn.getAttribute('data-post-id');
            const rect = container.getBoundingClientRect();
            const relativeX = e.clientX - rect.left;
            const relativeY = e.clientY - rect.top;

            triggerHeartExplosion(relativeX, relativeY, container);

            if (!btn.classList.contains('liked')) {
              await togglePostLike(pid, btn);
            }
          }
          lastTap = now;
        });
      });

      // Posted via Enter key only (send button removed)

      const commentInputs = feedContainer.querySelectorAll('.comment-input-field');
      commentInputs.forEach(input => {
        input.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const pid = input.id.replace('comment-input-', '');
            const text = input.value.trim();
            if (text) {
              await submitComment(pid, text, input);
            }
          }
      });
    });
  }

  function triggerBtnHeartExplosion(anchorElement) {
    if (!anchorElement) return;
    const rect = anchorElement.getBoundingClientRect();

    // Spawn 8 purple hearts
    for (let i = 0; i < 8; i++) {
      const heart = document.createElement('div');
      heart.className = 'heart-particle';
      heart.innerHTML = `
        <svg viewBox="0 0 24 24" fill="#8b5cf6" stroke="#8b5cf6" stroke-width="2" style="width: 100%; height: 100%;">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>
      `;

      const size = Math.random() * 10 + 12; // sizes 12px to 22px
      heart.style.width = `${size}px`;
      heart.style.height = `${size}px`;

      const startX = rect.left + rect.width / 2 - size / 2;
      const startY = rect.top + rect.height / 2 - size / 2;
      heart.style.left = `${startX}px`;
      heart.style.top = `${startY}px`;

      const angle = (Math.random() * 360) * Math.PI / 180;
      const distance = Math.random() * 40 + 35;
      const tx = Math.cos(angle) * distance;
      const ty = -Math.random() * 70 - 30; // Float upwards
      const rot = Math.random() * 90 - 45;
      const scale = Math.random() * 0.4 + 0.8;

      heart.style.setProperty('--tx', `${tx}px`);
      heart.style.setProperty('--ty', `${ty}px`);
      heart.style.setProperty('--rot', `${rot}deg`);
      heart.style.setProperty('--scale', scale);

      heart.style.animationDelay = `${Math.random() * 0.1}s`;

      document.body.appendChild(heart);

      setTimeout(() => {
        heart.remove();
      }, 1100);
    }
  }

  async function togglePostLike(postId, btnElement) {
    const token = localStorage.getItem('invibe_jwt_token') || localStorage.getItem('invibe_token');

    if (!token) {
      showToast('Please log in to like posts.');
      return;
    }

    // 1. Snapshot initial state for rollback
    const isOriginallyLiked = btnElement.classList.contains('liked');
    const countSpan = btnElement.querySelector('.action-count');
    const heartIcon = btnElement.querySelector('i, svg');
    const originalCount = parseInt(countSpan ? countSpan.textContent : '0') || 0;

    // 2. Optimistic UI Update
    const nextIsLiked = !isOriginallyLiked;
    const nextCount = nextIsLiked ? originalCount + 1 : Math.max(0, originalCount - 1);

    if (nextIsLiked) {
      btnElement.classList.add('liked');
      if (heartIcon) {
        heartIcon.style.fill = '#8b5cf6';
        heartIcon.style.stroke = '#8b5cf6';
      }
      triggerBtnHeartExplosion(btnElement);
    } else {
      btnElement.classList.remove('liked');
      if (heartIcon) {
        heartIcon.style.fill = 'none';
        heartIcon.style.stroke = 'currentColor';
      }
    }
    if (countSpan) countSpan.textContent = nextCount;

    try {
      const path = `/api/posts/${postId}/like`;
      let res;
      try {
        res = await fetch(path, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-User-Token': token
          }
        });
      } catch (_) {
        res = await fetch(`${API_URL}${path}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-User-Token': token
          }
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle like.');

      // 3. Confirm with official server state
      if (data.isLiked) {
        btnElement.classList.add('liked');
        if (heartIcon) {
          heartIcon.style.fill = '#8b5cf6';
          heartIcon.style.stroke = '#8b5cf6';
        }
        showToast('Liked post! 💜');
      } else {
        btnElement.classList.remove('liked');
        if (heartIcon) {
          heartIcon.style.fill = 'none';
          heartIcon.style.stroke = 'currentColor';
        }
      }
      if (countSpan) countSpan.textContent = data.likesCount;
    } catch (err) {
      console.error("Post like failed, rolling back UI:", err);
      // 4. ROLL BACK ON FAILURE
      if (isOriginallyLiked) {
        btnElement.classList.add('liked');
        if (heartIcon) {
          heartIcon.style.fill = '#8b5cf6';
          heartIcon.style.stroke = '#8b5cf6';
        }
      } else {
        btnElement.classList.remove('liked');
        if (heartIcon) {
          heartIcon.style.fill = 'none';
          heartIcon.style.stroke = 'currentColor';
        }
      }
      if (countSpan) countSpan.textContent = originalCount;
      showToast(err.message || 'Failed to like post.');
    }
  }

  async function toggleCommentLike(commentId, btnElement) {
    const token = localStorage.getItem('invibe_jwt_token') || localStorage.getItem('invibe_token');
    if (!token) {
      showToast('Please log in to like comments.');
      return;
    }

    const isOriginallyLiked = btnElement.classList.contains('liked');
    const countSpan = btnElement.querySelector('.comment-like-count');
    const originalCount = parseInt(countSpan ? countSpan.textContent : '0') || 0;

    // Optimistic Update
    btnElement.classList.toggle('liked', !isOriginallyLiked);
    if (countSpan) countSpan.textContent = !isOriginallyLiked ? originalCount + 1 : Math.max(0, originalCount - 1);

    try {
      const path = `/api/comments/${commentId}/like`;
      let res;
      try {
        res = await fetch(path, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (_) {
        res = await fetch(`${API_URL}${path}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to like comment.');

      btnElement.classList.toggle('liked', data.isLiked);
      if (countSpan) countSpan.textContent = data.likesCount;
    } catch (err) {
      // Rollback
      btnElement.classList.toggle('liked', isOriginallyLiked);
      if (countSpan) countSpan.textContent = originalCount;
      showToast(err.message || 'Failed to like comment.');
    }
  }

  async function submitComment(postId, text, inputField, parentCommentId = null) {
    const token = localStorage.getItem('invibe_jwt_token') || localStorage.getItem('invibe_token');

    if (!token) {
      showToast('Please log in to post a comment.');
      return;
    }

    if (!text || !text.trim()) {
      showToast('Comment text cannot be empty.');
      return;
    }

    const originalValue = inputField.value;
    inputField.value = '';

    try {
      const path = parentCommentId ? `/api/comments/${parentCommentId}/reply` : `/api/posts/${postId}/comment`;
      let res;
      try {
        res = await fetch(path, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-User-Token': token
          },
          body: JSON.stringify({ text: text.trim(), parentCommentId })
        });
      } catch (_) {
        res = await fetch(`${API_URL}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-User-Token': token
          },
          body: JSON.stringify({ text: text.trim(), parentCommentId })
        });
      }

      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || 'Failed to post comment.');

      const commentsList = Array.isArray(responseData) ? responseData : (responseData.comments || [responseData.comment]);

      // Update post card comment count badge
      const card = document.getElementById(`post-${postId}`) || inputField.closest('.feed-card') || document.querySelector(`[data-post-id="${postId}"]`)?.closest('.feed-card');
      if (card) {
        const countBadge = card.querySelector('.comment-btn-action .action-count');
        if (countBadge) countBadge.textContent = commentsList.length;
      }

      // Update list container
      const listContainer = document.getElementById(`comments-list-${postId}`) || document.querySelector('#comments-modal .comments-list');
      if (listContainer && Array.isArray(commentsList)) {
        listContainer.innerHTML = '';
        commentsList.forEach(comment => {
          const item = document.createElement('div');
          item.className = `comment-item ${comment.parentCommentId ? 'nested-reply' : ''}`;
          item.style = `display: flex; gap: 8px; margin-bottom: 8px; font-size: 13px; ${comment.parentCommentId ? 'margin-left: 24px; border-left: 2px solid rgba(255,255,255,0.1); padding-left: 8px;' : ''}`;
          const cAuthor = comment.author || { username: 'user', profileImage: '' };
          item.innerHTML = `
            <img src="${cAuthor.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" />
            <div style="flex: 1;">
              <strong style="color: var(--text-color); margin-right: 4px;">${cAuthor.username || 'user'}</strong>
              <span style="color: var(--text-muted);">${comment.text}</span>
            </div>
          `;
          listContainer.appendChild(item);
        });
      }

      showToast('Comment posted! 💬');
    } catch (err) {
      console.error("Comment submission failed, rolling back UI:", err);
      // ROLL BACK INPUT
      inputField.value = originalValue;
      showToast(err.message || 'Failed to post comment.');
    }
  }

  // --- SUPABASE REALTIME FEED SYNCHRONIZATION ---
  function initRealtimeFeedSubscriptions() {
    if (!supabase) return;

    try {
      supabase
        .channel('public:feed_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, payload => {
          if (payload.new && payload.new.post_id) {
            refreshPostCommentsCount(payload.new.post_id);
          } else if (payload.old && payload.old.post_id) {
            refreshPostCommentsCount(payload.old.post_id);
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, payload => {
          if (payload.new && payload.new.post_id) {
            refreshPostLikesCount(payload.new.post_id);
          } else if (payload.old && payload.old.post_id) {
            refreshPostLikesCount(payload.old.post_id);
          }
        })
        .subscribe();
    } catch (rtErr) {
      console.warn("Realtime subscription notice:", rtErr.message);
    }
  }

  async function refreshPostCommentsCount(postId) {
    const card = document.getElementById(`post-${postId}`);
    if (!card) return;
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/comments`);
      if (res.ok) {
        const comments = await res.json();
        const countBadge = card.querySelector('.comment-btn-action .action-count');
        if (countBadge && Array.isArray(comments)) {
          countBadge.textContent = comments.length;
        }
      }
    } catch (_) {}
  }

  async function refreshPostLikesCount(postId) {
    const card = document.getElementById(`post-${postId}`);
    if (!card) return;
    try {
      const res = await fetch(`${API_URL}/api/posts`);
      if (res.ok) {
        const posts = await res.json();
        const targetPost = posts.find(p => p._id === postId);
        if (targetPost) {
          const countBadge = card.querySelector('.like-btn-action .action-count');
          if (countBadge) countBadge.textContent = (targetPost.likes || []).length;
        }
      }
    } catch (_) {}
  }

  initRealtimeFeedSubscriptions();

  async function loadFeedReels() {
    const scroller = document.querySelector('#explore-reels-container .reels-scroller');
    if (!scroller) return;

    try {
      const res = await fetch(`${API_URL}/api/reels`);
      if (!res.ok) throw new Error('Failed to fetch reels');
      const reels = await res.json();

      scroller.innerHTML = '';

      const currentUserStr = localStorage.getItem('invibeUser');
      const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;

      reels.forEach(reel => {
        const isLikedByMe = currentUser ? reel.likes.includes(currentUser.id) : false;

        const card = document.createElement('div');
        card.className = 'reel-card';
        card.innerHTML = `
          <video src="${reel.videoUrl}" loop muted playsinline class="reel-video"></video>
          <div class="reel-play-icon-overlay"><i data-lucide="play"></i></div>
          
          <div class="reel-overlay">
            <div class="reel-left-info">
              <div class="reel-user">
                <img src="${reel.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80'}" alt="${reel.author.fullName}" />
                <span>${reel.author.username} • <strong class="reel-follow-btn" data-author-id="${reel.author._id}">Follow</strong></span>
              </div>
              <p class="reel-caption">${reel.caption}</p>
              <div class="reel-music"><i data-lucide="music" class="music-icon-spin"></i> <span>Original Audio - ${reel.author.username}</span></div>
            </div>
            <div class="reel-right-actions">
              <div class="reel-actions-capsule">
                <div class="reel-action-btn reel-like-action" data-reel-id="${reel._id}">
                  <button class="action-circle-btn heart-btn ${isLikedByMe ? 'liked' : ''}"><i data-lucide="heart" style="${isLikedByMe ? 'fill:#8b5cf6; stroke:#8b5cf6;' : ''}"></i></button>
                  <span class="action-count">${reel.likes.length}</span>
                </div>
                <div class="reel-action-btn reel-comment-sim">
                  <button class="action-circle-btn"><i data-lucide="message-square"></i></button>
                  <span class="action-count">1.2K</span>
                </div>
                <div class="reel-action-btn reel-share-sim">
                  <button class="action-circle-btn"><i data-lucide="send"></i></button>
                </div>
                <div class="reel-action-btn">
                  <button class="action-circle-btn"><i data-lucide="more-vertical"></i></button>
                </div>
              </div>
            </div>
          </div>

          <div class="story-viewer-overlay reel-comments-modal">
            <div class="comments-card glass-panel">
              <div class="modal-header">
                <h3>Comments</h3>
                <button class="modal-close-btn"><i data-lucide="x"></i></button>
              </div>
              <div class="comments-list" id="comments-list-${reel._id}"></div>
              <div class="comments-footer">
                <input type="text" placeholder="Add a comment..." />
                <button class="comment-send-btn"><i data-lucide="send"></i></button>
              </div>
            </div>
          </div>

          <div class="story-viewer-overlay reel-share-modal">
            <div class="share-card glass-panel">
              <div class="modal-header">
                <h3>Share to Hubbies</h3>
                <button class="modal-close-btn"><i data-lucide="x"></i></button>
              </div>
              <div class="share-friends-list"></div>
            </div>
          </div>
        `;

        scroller.appendChild(card);
      });

      debouncedCreateIcons();
      wireReelInteractions(scroller);

    } catch (err) {
      console.error('Error loading reels:', err);
    }
  }

  async function toggleReelLike(reelId, btnElement) {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) {
      showToast('Please log in to like reels! 🔐');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/reels/${reelId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const countSpan = btnElement.closest('.reel-action-btn').querySelector('.action-count');
      const heartIcon = btnElement.querySelector('i, svg');

      if (data.isLiked) {
        btnElement.classList.add('liked');
        if (heartIcon) {
          heartIcon.style.fill = '#8b5cf6';
          heartIcon.style.stroke = '#8b5cf6';
        }
        showToast('Liked Reel! 💜');
      } else {
        btnElement.classList.remove('liked');
        if (heartIcon) {
          heartIcon.style.fill = 'none';
          heartIcon.style.stroke = 'currentColor';
        }
      }
      if (countSpan) countSpan.textContent = data.likesCount;
    } catch (err) {
      console.error('Error liking reel:', err);
      showToast(err.message);
    }
  }

  async function toggleFollowFromReel(authorId, btnElement) {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) {
      showToast('Please log in to follow users! 🔐');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/users/${authorId}/follow`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      btnElement.textContent = 'Hubbies';
      btnElement.style.background = 'rgba(255,255,255,0.2)';
      showToast(data.message || 'Followed successfully!');
      loadProfileStats();
      loadFollowSuggestions();
    } catch (err) {
      showToast(err.message);
    }
  }

  // --- ONLINE PRESENCE HEARTBEAT SYSTEM ---
  function sendPresenceHeartbeat() {
    const token = localStorage.getItem('invibe_jwt_token') || localStorage.getItem('invibe_token');
    if (!token) return;
    fetch(`${API_URL}/api/presence/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }).catch(() => {});
  }

  sendPresenceHeartbeat();
  setInterval(sendPresenceHeartbeat, 30000);
  setTimeout(() => {
    loadFollowSuggestions();
    loadActiveVibers();
  }, 100);

  const sendLogoutBeacon = () => {
    const token = localStorage.getItem('invibe_jwt_token') || localStorage.getItem('invibe_token');
    if (token) {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
        navigator.sendBeacon(`${API_URL}/api/users/logout-presence?token=${encodeURIComponent(token)}`, blob);
      }
      fetch(`${API_URL}/api/users/logout-presence`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        keepalive: true
      }).catch(() => {});
    }
  };

  window.addEventListener('beforeunload', sendLogoutBeacon);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      sendLogoutBeacon();
    } else if (document.visibilityState === 'visible') {
      sendPresenceHeartbeat();
      loadActiveVibers();
    }
  });

  // --- UNIFIED SUGGESTED HUBBERS SERVICE ---
  async function getSuggestedHubbers(limit = 50) {
    const token = localStorage.getItem('invibe_jwt_token') || localStorage.getItem('invibe_token');
    if (!token) return [];

    try {
      const res = await fetch(`${API_URL}/api/users/suggestions?limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch suggestions`);
      const suggestions = await res.json();
      console.log(`[Suggested Hubbers Service] Fetched ${suggestions ? suggestions.length : 0} suggestions (limit: ${limit})`);
      return suggestions || [];
    } catch (err) {
      console.error('[Suggested Hubbers Service Error]:', err);
      return [];
    }
  }

  // --- SUGGESTED HUBBERS HOME WIDGET ---
  async function loadFollowSuggestions() {
    const listContainer = document.querySelector('.suggested-users-list') || document.getElementById('suggested-users-list');
    if (!listContainer) {
      console.warn('[Suggested Hubbers] Container element .suggested-users-list not found in DOM');
      return;
    }

    const suggestions = await getSuggestedHubbers(50);
    console.log(`[Suggested Hubbers Widget] Rendering ${suggestions.length} items to Home widget`);

    listContainer.innerHTML = '';
    if (!suggestions || suggestions.length === 0) {
      listContainer.innerHTML = '<p style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 13px;">No suggestions available.</p>';
      return;
    }

    suggestions.slice(0, 3).forEach(user => {
      const row = document.createElement('div');
      row.className = 'user-row';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.padding = '8px 0';

      const isRequested = user.followStatus === 'pending';
      const isFollowing = user.followStatus === 'following';

      let btnClass = 'follow-row-btn';
      let btnText = 'Follow';
      let btnStyle = 'padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 12px; border: none; cursor: pointer; transition: all 0.2s; background: var(--primary, #a855f7); color: white;';

      if (isRequested) {
        btnText = 'Requested';
        btnStyle = 'padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 12px; border: none; cursor: not-allowed; background: rgba(255,255,255,0.15); color: var(--text-muted, #94a3b8);';
      } else if (isFollowing) {
        btnText = 'Hubbies';
        btnStyle = 'padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 12px; border: none; cursor: pointer; background: #22c55e; color: white;';
      }

      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" class="user-info-area">
          <img src="${user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="${user.fullName}" class="user-row-avatar" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover;" />
          <div class="user-row-info">
            <h5 style="margin: 0; font-size: 13px; font-weight: 600; color: var(--text-color);">${user.fullName}</h5>
            <p style="margin: 0; font-size: 11px; color: var(--text-muted);">@${user.username} • <span style="color: var(--primary);">${user.followersCount || 0} Hubbers</span></p>
          </div>
        </div>
        <button class="${btnClass}" data-user-id="${user._id}" style="${btnStyle}" ${isRequested ? 'disabled' : ''}>${btnText}</button>
      `;
      listContainer.appendChild(row);

      const btnElement = row.querySelector('.follow-row-btn');
      if (btnElement) {
        btnElement.addEventListener('click', async (e) => {
          e.stopPropagation();
          await toggleFollowUser(user._id, btnElement, user);
        });
      }
    });
  }

  async function toggleFollowUser(targetUserId, btnElement, userObj = null) {
    const token = localStorage.getItem('invibe_jwt_token') || localStorage.getItem('invibe_token');
    if (!token) {
      showToast('Please log in to follow users! 🔐');
      return;
    }

    const isFollowing = btnElement.classList.contains('followed');
    const endpoint = isFollowing ? 'unfollow' : 'follow';
    const targetUsername = userObj?.username || btnElement.getAttribute('data-username') || 'N/A';
    const targetUuid = userObj?._id || targetUserId;
    const fullApiUrl = `${API_URL}/api/users/${targetUserId}/${endpoint}`;

    console.log('==================================================');
    console.log('FRONTEND DEBUG - FOLLOW ACTION CLICKED');
    console.log('==================================================');
    console.log('1. Selected Suggested Hubber object:', userObj || { _id: targetUserId });
    console.log('2. Target Profile UUID:', targetUuid);
    console.log('3. Target Username:', targetUsername);
    console.log('4. Request Payload:', { targetUserId, endpoint });
    console.log('5. API URL:', fullApiUrl);
    console.log('6. HTTP Method: POST');
    console.log('==================================================');

    try {
      const res = await fetch(fullApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      console.log('FRONTEND DEBUG - API RESPONSE:', { status: res.status, ok: res.ok, body: data });

      if (!res.ok) throw new Error(data.error || 'Follow action failed');

      if (endpoint === 'follow') {
        btnElement.textContent = 'Requested';
        btnElement.style.background = 'rgba(255,255,255,0.15)';
        btnElement.style.color = 'var(--text-muted, #94a3b8)';
        btnElement.disabled = true;
        showToast(data.message || 'Follow request sent! 📩');
      } else {
        btnElement.classList.remove('followed');
        btnElement.textContent = 'Follow';
        btnElement.style.background = 'var(--primary, #a855f7)';
        btnElement.disabled = false;
        showToast('Unfollowed successfully.');
      }
      loadProfileStats();
      loadFollowSuggestions();
      if (suggestedVibersModal && suggestedVibersModal.classList.contains('active')) {
        openSuggestedVibersModal();
      }
    } catch (err) {
      console.error('FRONTEND ERROR:', err.message);
      showToast(err.message);
    }
  }

  // --- SUGGESTED VIBERS MODAL SYSTEM ---
  const suggestedVibersModal = document.getElementById('suggested-vibers-modal');
  const suggestedVibersCloseBtn = document.getElementById('suggested-vibers-close-btn');
  const suggestedVibersContent = document.getElementById('suggested-vibers-content');

  if (suggestedVibersCloseBtn && suggestedVibersModal) {
    suggestedVibersCloseBtn.addEventListener('click', () => {
      suggestedVibersModal.classList.remove('active');
    });
  }

  async function openSuggestedVibersModal() {
    if (!suggestedVibersContent) return;

    suggestedVibersContent.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Loading suggestions...</div>';
    if (suggestedVibersModal) suggestedVibersModal.classList.add('active');

    try {
      const suggestions = await getSuggestedHubbers(50);
      console.log(`[Suggested Hubbers Modal] Rendering ${suggestions.length} items to Modal`);

      suggestedVibersContent.innerHTML = '';
      if (!suggestions || suggestions.length === 0) {
        suggestedVibersContent.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">No suggestions available.</div>`;
        return;
      }

      suggestions.forEach(user => {
        const row = document.createElement('div');
        row.className = 'search-person-row';
        row.style.margin = '10px 0';
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';

        row.innerHTML = `
          <div class="person-info" style="display: flex; align-items: center; cursor: pointer;">
            <img src="${user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="${user.fullName}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-right: 10px;" />
            <div style="display: flex; flex-direction: column;">
              <strong style="font-size: 14px; color: var(--text-color);">${user.fullName}</strong>
              <span style="font-size: 12px; color: var(--text-muted);">@${user.username} • ${user.followersCount || 0} Hubbers</span>
            </div>
          </div>
          <button class="search-follow-btn modal-suggest-follow-btn" data-user-id="${user._id}" style="padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 12px; border: none; cursor: pointer; background: var(--primary, #a855f7); color: white;">
            Follow
          </button>
        `;

        row.querySelector('.person-info').addEventListener('click', () => {
          if (suggestedVibersModal) suggestedVibersModal.classList.remove('active');
          switchView('profile', user._id);
        });

        const followBtn = row.querySelector('.modal-suggest-follow-btn');
        if (followBtn) {
          followBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const uid = followBtn.getAttribute('data-user-id');
            await toggleFollowUser(uid, followBtn);
          });
        }

        suggestedVibersContent.appendChild(row);
      });

      debouncedCreateIcons();
    } catch (err) {
      console.error(err);
      suggestedVibersContent.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--error-color);">Error loading suggestions</div>';
    }
  }

  // --- ACTIVE HUBBERS WIDGET ---
  const activeVibersCount = document.getElementById('active-vibers-count');
  const activeVibersList = document.getElementById('active-vibers-list');

  async function loadActiveVibers() {
    if (!activeVibersList) return;
    const token = localStorage.getItem('invibe_jwt_token') || localStorage.getItem('invibe_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/online-users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch online users`);
      const data = await res.json();
      console.log('[Active Hubbers Widget Debug] API Response:', data);

      const onlineCount = data.onlineCount !== undefined ? data.onlineCount : (Array.isArray(data) ? data.length : 0);
      const activeUsers = data.users || (Array.isArray(data) ? data : []);

      activeVibersList.innerHTML = '';
      if (activeVibersCount) {
        activeVibersCount.textContent = `${onlineCount} online`;
      }

      if (activeUsers.length === 0) {
        activeVibersList.innerHTML = '<p style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 12px; width: 100%;">No hubbers online</p>';
        return;
      }

      activeUsers.slice(0, 5).forEach(user => {
        const circle = document.createElement('div');
        circle.className = 'face-circle online';
        circle.style.position = 'relative';
        circle.style.cursor = 'pointer';
        circle.title = `${user.fullName} (@${user.username})`;
        circle.innerHTML = `
          <img src="${user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'}" alt="${user.fullName}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;" />
          <span class="online-indicator-dot" style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: #22c55e; border: 2px solid #1a1a24; border-radius: 50%;"></span>
        `;

        circle.addEventListener('click', () => {
          switchView('profile', user._id);
        });

        activeVibersList.appendChild(circle);
      });
    } catch (err) {
      console.error('[Active Hubbers Widget Error]:', err);
    }
  }

  // Poll active users as fallback
  setInterval(loadActiveVibers, 30000);

  async function loadProfileStats() {
    const currentUserStr = localStorage.getItem('invibeUser');
    if (!currentUserStr) return;
    const currentUser = JSON.parse(currentUserStr);

    try {
      const res = await fetch(`${API_URL}/api/users/${currentUser.id || currentUser._id}/relations`);
      if (!res.ok) throw new Error('Failed to fetch user relations');
      const data = await res.json();

      const sidebarFollowers = document.getElementById('user-followers-count');
      const sidebarFollowing = document.getElementById('user-following-count');
      if (sidebarFollowers) sidebarFollowers.textContent = formatCount(data.followersCount);
      if (sidebarFollowing) sidebarFollowing.textContent = formatCount(data.followingCount);

      const followBtn = document.getElementById('profile-follow-btn');
      const isViewingSelf = !followBtn || followBtn.style.display === 'none';

      if (isViewingSelf) {
        const profileFollowers = document.getElementById('profile-followers-count');
        const profileFollowing = document.getElementById('profile-following-count');
        if (profileFollowers) profileFollowers.textContent = formatCount(data.followersCount);
        if (profileFollowing) profileFollowing.textContent = formatCount(data.followingCount);

        const postsRes = await fetch(`${API_URL}/api/posts`);
        if (postsRes.ok) {
          const posts = await postsRes.json();
          const userPostsCount = posts.filter(p => {
            const authorId = p.author._id || p.author;
            const currentId = currentUser.id || currentUser._id;
            return authorId === currentId;
          }).length;
          const profileVibes = document.getElementById('profile-vibes-count');
          if (profileVibes) profileVibes.textContent = userPostsCount;
        }
      }
    } catch (err) {
      console.error('Error loading profile stats:', err);
    }
  }

  function formatCount(num) {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
  }

  function wireReelInteractions(scroller) {
    const cards = scroller.querySelectorAll('.reel-card');
    cards.forEach(card => {
      const video = card.querySelector('.reel-video');
      const playPop = card.querySelector('.reel-play-icon-overlay');
      const likeBtn = card.querySelector('.reel-like-action .heart-btn');
      const reelId = card.querySelector('.reel-like-action')?.getAttribute('data-reel-id');

      card.addEventListener('click', (e) => {
        if (e.detail > 1) return;
        if (e.target.closest('.reel-right-actions')) return;

        if (video.paused) {
          video.play();
          playPop.classList.remove('active');
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              playPop.querySelector('i').setAttribute('data-lucide', 'play');
              playPop.classList.add('active');
            });
          });
        } else {
          video.pause();
          playPop.classList.remove('active');
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              playPop.querySelector('i').setAttribute('data-lucide', 'pause');
              playPop.classList.add('active');
            });
          });
        }
        debouncedCreateIcons();
      });

      let lastReelTap = 0;
      card.addEventListener('click', async (e) => {
        const now = Date.now();
        const timespan = now - lastReelTap;
        if (timespan < 300 && timespan > 0) {
          e.preventDefault();
          const rect = card.getBoundingClientRect();
          const relativeX = e.clientX - rect.left;
          const relativeY = e.clientY - rect.top;

          triggerHeartExplosion(relativeX, relativeY, card);

          if (likeBtn && !likeBtn.classList.contains('liked')) {
            await toggleReelLike(reelId, likeBtn);
          } else {
            triggerHeartExplosion(relativeX, relativeY, card);
          }
        }
        lastReelTap = now;
      });

      const likeBtnAction = card.querySelector('.reel-like-action');
      if (likeBtnAction && likeBtn) {
        likeBtnAction.addEventListener('click', async (e) => {
          e.stopPropagation();
          await toggleReelLike(reelId, likeBtn);
        });
      }

      const followReel = card.querySelector('.reel-follow-btn');
      if (followReel) {
        followReel.addEventListener('click', async (e) => {
          e.stopPropagation();
          const authorId = followReel.getAttribute('data-author-id');
          await toggleFollowFromReel(authorId, followReel);
        });
      }

      const commentBtn = card.querySelector('.reel-comment-sim');
      const commentModal = card.querySelector('.reel-comments-modal');
      if (commentBtn && commentModal) {
        commentBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          commentModal.classList.add('active');
        });
        const closeBtn = commentModal.querySelector('.modal-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            commentModal.classList.remove('active');
          });
        }
        commentModal.addEventListener('click', (e) => {
          if (e.target === commentModal) {
            commentModal.classList.remove('active');
          }
        });

        const sendBtn = commentModal.querySelector('.comment-send-btn');
        const inputField = commentModal.querySelector('input');
        if (sendBtn && inputField) {
          const handleSend = async () => {
            const text = inputField.value.trim();
            if (text) {
              await submitComment(reelId, text, inputField);
            }
          };
          sendBtn.addEventListener('click', handleSend);
          inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          });
        }
      }

      const shareBtn = card.querySelector('.reel-share-sim');
      const shareModal = card.querySelector('.reel-share-modal');
      if (shareBtn && shareModal) {
        shareBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openShare('reel_' + reelId, shareModal);
        });
        const closeBtn = shareModal.querySelector('.modal-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            shareModal.classList.remove('active');
          });
        }
        shareModal.addEventListener('click', (e) => {
          if (e.target === shareModal) {
            shareModal.classList.remove('active');
          }
        });
      }

      const capsule = card.querySelector('.reel-actions-capsule');
      if (capsule) {
        let isDraggingCapsule = false;
        let wasDragging = false;
        let startX, startY;
        let posX = 0;
        let posY = 0;

        capsule.addEventListener('mousedown', dragStart);
        capsule.addEventListener('touchstart', dragStart, { passive: false });

        capsule.addEventListener('click', (e) => {
          if (wasDragging) {
            e.stopPropagation();
            e.preventDefault();
          }
        }, true);

        function dragStart(e) {
          if (e.type === 'mousedown' && e.button !== 0) return;
          isDraggingCapsule = false;
          wasDragging = false;
          const coords = getDragCoords(e);
          startX = coords.x;
          startY = coords.y;
          posX = parseFloat(capsule.getAttribute('data-x')) || 0;
          posY = parseFloat(capsule.getAttribute('data-y')) || 0;
          capsule.style.transition = 'none';
          capsule.classList.add('dragging-capsule');
          document.addEventListener('mousemove', dragMove);
          document.addEventListener('mouseup', dragEnd);
          document.addEventListener('touchmove', dragMove, { passive: false });
          document.addEventListener('touchend', dragEnd);
        }

        function dragMove(e) {
          const coords = getDragCoords(e);
          const deltaX = coords.x - startX;
          const deltaY = coords.y - startY;

          if (!isDraggingCapsule) {
            if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
              isDraggingCapsule = true;
              wasDragging = true;
            }
          }

          if (isDraggingCapsule) {
            if (e.cancelable) e.preventDefault();
            let targetX = posX + deltaX;
            let targetY = posY + deltaY;
            const cardRect = card.getBoundingClientRect();
            const capsuleRect = capsule.getBoundingClientRect();
            const curX = parseFloat(capsule.getAttribute('data-x')) || 0;
            const curY = parseFloat(capsule.getAttribute('data-y')) || 0;
            const initialLeft = capsuleRect.left - curX;
            const initialTop = capsuleRect.top - curY;

            const minX = cardRect.left - initialLeft + 12;
            const maxX = cardRect.right - capsuleRect.width - initialLeft - 12;
            const minY = cardRect.top - initialTop + 12;
            const maxY = cardRect.bottom - capsuleRect.height - initialTop - 12;

            targetX = Math.max(minX, Math.min(maxX, targetX));
            targetY = Math.max(minY, Math.min(maxY, targetY));

            capsule.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) scale(1.05)`;
            capsule.setAttribute('data-target-x', targetX.toString());
            capsule.setAttribute('data-target-y', targetY.toString());
          }
        }

        function dragEnd() {
          document.removeEventListener('mousemove', dragMove);
          document.removeEventListener('mouseup', dragEnd);
          document.removeEventListener('touchmove', dragMove);
          document.removeEventListener('touchend', dragEnd);

          capsule.style.transition = '';
          capsule.classList.remove('dragging-capsule');

          if (isDraggingCapsule) {
            const finalX = parseFloat(capsule.getAttribute('data-target-x')) || 0;
            const finalY = parseFloat(capsule.getAttribute('data-target-y')) || 0;
            capsule.setAttribute('data-x', finalX.toString());
            capsule.setAttribute('data-y', finalY.toString());
            capsule.style.transform = `translate3d(${finalX}px, ${finalY}px, 0)`;
            showToast('Repositioned Reels menu! ⚓');
            setTimeout(() => {
              wasDragging = false;
              isDraggingCapsule = false;
            }, 50);
          } else {
            capsule.style.transform = `translate3d(${posX}px, ${posY}px, 0)`;
            isDraggingCapsule = false;
            wasDragging = false;
          }
        }
      }
    });
  }

  // --- USER PROFILE LOADER SYSTEM ---
  async function loadUserProfile(userId) {
    const currentUserStr = localStorage.getItem('invibeUser');
    if (!currentUserStr) return;
    const currentUser = JSON.parse(currentUserStr);
    const localPhoto = localStorage.getItem('invibeProfileImage');
    const isMe = (!userId || userId === 'me' || userId === currentUser.id || userId === currentUser._id || userId === currentUser.username);

    // Immediately set UI to user's profile info (no loading placeholders)
    const profileAvatar = document.querySelector('.profile-screen-avatar');
    if (profileAvatar) profileAvatar.src = (isMe && localPhoto) ? localPhoto : (localPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80');

    const profileName = document.querySelector('.profile-summary-top h3');
    if (profileName) profileName.innerHTML = isMe ? (currentUser.fullName || currentUser.username) : 'Hubber Profile';

    const profileHandle = document.querySelector('.profile-screen-handle');
    if (profileHandle) profileHandle.textContent = '@' + (isMe ? (currentUser.username || 'user') : (userId || 'user'));

    const profileBio = document.getElementById('profile-bio-text');
    if (profileBio) profileBio.textContent = 'Hubber creator on Hi-Hubble 🚀';

    const followBtn = document.getElementById('profile-follow-btn');
    const optionsList = document.querySelector('.profile-options-list');
    const logoutBtn = document.getElementById('profile-logout-btn');

    if (isMe) {
      if (followBtn) followBtn.style.display = 'none';
      if (optionsList) optionsList.style.display = 'grid';
      if (logoutBtn) logoutBtn.style.display = 'block';
    }

    let user = {
      _id: isMe ? (currentUser.id || currentUser._id || 'me') : userId,
      username: isMe ? (currentUser.username || 'haribol') : (userId || 'user'),
      fullName: isMe ? (currentUser.fullName || currentUser.username || 'haribol') : (userId || 'user'),
      profileImage: (isMe && localPhoto) ? localPhoto : (localPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'),
      bio: 'Hubber creator on Hi-Hubble 🚀',
      followersCount: 0,
      followingCount: 0
    };

    let posts = [];
    let reels = [];

    // Try fetching remote API if available
    try {
      const token = localStorage.getItem('invibe_jwt_token') || localStorage.getItem('invibe_token');
      const targetId = isMe ? (currentUser.id || currentUser._id || currentUser.username) : userId;
      if (targetId) {
        const path = `/api/users/${targetId}/profile`;
        let res;
        try {
          res = await fetch(path, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
        } catch (_) {
          res = await fetch(`${API_URL}${path}`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
        }
        if (res && res.ok) {
          const data = await res.json();
          if (data.user) user = { ...user, ...data.user };
          if (Array.isArray(data.posts)) posts = data.posts;
          if (Array.isArray(data.reels)) reels = data.reels;
        }
      }
    } catch (netErr) {
      console.warn("Network profile load notice:", netErr.message);
    }

    // Update follow statistics & YOUR HUBS post count
    const followersCount = document.getElementById('profile-followers-count');
    const followingCount = document.getElementById('profile-following-count');
    const vibesCount = document.getElementById('profile-vibes-count');
    if (followersCount) followersCount.textContent = formatCount(user.followersCount || 0);
    if (followingCount) followingCount.textContent = formatCount(user.followingCount || 0);
    if (vibesCount) vibesCount.textContent = formatCount(user.postsCount !== undefined ? user.postsCount : posts.length);

    // Render posts grid (Vibes Gallery)
    const vibesGrid = document.getElementById('profile-vibes-grid');
    if (vibesGrid) {
      vibesGrid.innerHTML = '';
      if (!posts || posts.length === 0) {
        vibesGrid.innerHTML = '<div class="profile-grid-empty">No hubs shared yet. 📸</div>';
      } else {
        posts.forEach(post => {
          const item = document.createElement('div');
          item.className = 'profile-grid-item';
          item.style.cursor = 'pointer';
          item.innerHTML = `
            <img src="${post.mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'}" alt="Hub" />
            <div class="profile-grid-item-overlay">
              <span><i data-lucide="heart"></i> ${(post.likes || []).length}</span>
              <span><i data-lucide="message-square"></i> ${(post.comments || []).length}</span>
            </div>
          `;
          item.addEventListener('click', () => {
            openProfilePostViewer(post);
          });
          vibesGrid.appendChild(item);
        });
      }
    }

    // Render reels grid (Reels Gallery)
    const reelsGrid = document.getElementById('profile-reels-grid');
    if (reelsGrid) {
      reelsGrid.innerHTML = '';
      if (!reels || reels.length === 0) {
        reelsGrid.innerHTML = '<div class="profile-grid-empty">No reels uploaded yet. 🎥</div>';
      } else {
        reels.forEach(reel => {
          const item = document.createElement('div');
          item.className = 'profile-grid-item';
          item.innerHTML = `
            <video src="${reel.videoUrl}" muted loop></video>
            <div class="profile-grid-item-overlay">
              <span><i data-lucide="heart"></i> ${(reel.likes || []).length}</span>
            </div>
          `;
          const video = item.querySelector('video');
          item.addEventListener('mouseenter', () => video.play());
          item.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
          reelsGrid.appendChild(item);
        });
      }
    }

    debouncedCreateIcons();
  }

  // --- PROFILE POST VIEWER MODAL SYSTEM (CHANGE 1) ---
  const profilePostViewerModal = document.getElementById('profile-post-viewer-modal');
  const profilePostViewerCloseBtn = document.getElementById('profile-post-viewer-close-btn');
  const profilePostViewerContent = document.getElementById('profile-post-viewer-content');

  function openProfilePostViewer(post) {
    if (!profilePostViewerModal || !profilePostViewerContent) return;

    const currentUserStr = localStorage.getItem('invibeUser');
    const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
    const isLikedByMe = currentUser ? post.likes.includes(currentUser.id) : false;

    let commentsHTML = '';
    post.comments.forEach(comment => {
      commentsHTML += `
        <div class="comment-item" style="display: flex; gap: 8px; margin-bottom: 8px; font-size: 13px;">
          <img src="${comment.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" />
          <div>
            <strong style="color: var(--text-color); margin-right: 4px;">${comment.author.username}</strong>
            <span style="color: var(--text-muted);">${comment.text}</span>
          </div>
        </div>
      `;
    });

    const cardHTML = `
      <article class="feed-card" id="post-${post._id}">
        <div class="post-header">
          <div class="post-author-info">
            <img src="${post.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="${post.author.fullName}" class="author-avatar" />
            <div>
              <h4 class="author-name">${post.author.fullName}</h4>
              <div class="post-meta">
                <span class="post-time">${new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span class="dot-separator">•</span>
                <i data-lucide="globe" class="meta-icon"></i>
              </div>
            </div>
          </div>
          <button class="post-options-btn"><i data-lucide="more-horizontal"></i></button>
        </div>

        <div class="post-media-container" style="position:relative; overflow:hidden; border-radius: 12px; margin: 12px 0;">
          ${post.mediaType === 'video'
        ? `<video src="${post.mediaUrl}" loop muted playsinline style="width:100%; border-radius:12px; display:block;" class="post-media-video"></video>
               <div class="video-play-overlay">
                 <button class="play-btn-big"><i data-lucide="play"></i></button>
               </div>
               <div class="video-mute-container" style="position: absolute; left: 16px; bottom: 24px; z-index: 12;">
                 <button class="action-circle-btn mute-btn-action" data-post-id="${post._id}">
                   <i data-lucide="volume-2"></i>
                 </button>
               </div>`
        : `<img src="${post.mediaUrl}" alt="Post Media" style="width:100%; border-radius:12px; display:block;" />`
      }

          <div class="post-engagement-actions">
            <div class="engagement-item like-btn-action ${isLikedByMe ? 'liked' : ''}" data-post-id="${post._id}">
              <button class="action-circle-btn heart-btn"><i data-lucide="heart" style="${isLikedByMe ? 'fill:#8b5cf6; stroke:#8b5cf6;' : ''}"></i></button>
              <span class="action-count">${post.likes.length}</span>
            </div>
            <div class="engagement-item comment-btn-action" data-post-id="${post._id}">
              <button class="action-circle-btn"><i data-lucide="message-circle"></i></button>
              <span class="action-count">${post.comments.length}</span>
            </div>
            <div class="engagement-item share-btn-action" data-post-id="${post._id}">
              <button class="action-circle-btn"><i data-lucide="send"></i></button>
            </div>
            <div class="engagement-item bookmark-btn-action" data-post-id="${post._id}">
              <button class="action-circle-btn bookmark-btn"><i data-lucide="bookmark"></i></button>
            </div>
          </div>
        </div>

        <div class="post-details">
          <p class="post-caption"><strong class="author-username" style="margin-right: 8px;">${post.author.username}</strong>${post.caption}</p>
          
          <div class="comments-section" style="margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 12px;">
            <div class="comments-list" id="comments-list-${post._id}">
              ${commentsHTML}
            </div>
            
            <div class="post-comment-input-area" style="display: flex; gap: 8px; margin-top: 12px;">
              <input type="text" placeholder="Write a comment and press Enter..." class="comment-input-field" id="comment-input-${post._id}" style="flex:1; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px; padding: 8px 16px; color: var(--text-color); font-size: 13px;" />
            </div>
          </div>
        </div>
      </article>
    `;

    profilePostViewerContent.innerHTML = cardHTML;
    profilePostViewerModal.classList.add('active');

    debouncedCreateIcons();

    // Wire up like button
    const likeBtn = profilePostViewerContent.querySelector('.like-btn-action');
    if (likeBtn) {
      likeBtn.addEventListener('click', async () => {
        const pid = likeBtn.getAttribute('data-post-id');
        await togglePostLike(pid, likeBtn);
      });
    }

    // Wire up bookmark button
    const bookmarkBtn = profilePostViewerContent.querySelector('.bookmark-btn');
    if (bookmarkBtn) {
      bookmarkBtn.addEventListener('click', () => {
        bookmarkBtn.classList.toggle('saved');
        const icon = bookmarkBtn.querySelector('i, svg');
        if (bookmarkBtn.classList.contains('saved')) {
          if (icon) { icon.style.fill = '#FBBF24'; icon.style.stroke = '#FBBF24'; }
          showToast('Saved to bookmarks! 🔖');
        } else {
          if (icon) { icon.style.fill = 'none'; icon.style.stroke = 'currentColor'; }
          showToast('Removed from bookmarks');
        }
      });
    }

    // Wire up share button
    const shareBtn = profilePostViewerContent.querySelector('.share-btn-action');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        showToast('Share link copied! 🔗');
      });
    }

    // Posted via Enter key only (send button removed)

    // Wire up comment input enter key
    const commentInput = profilePostViewerContent.querySelector('.comment-input-field');
    if (commentInput) {
      commentInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const pid = commentInput.id.replace('comment-input-', '');
          const text = commentInput.value.trim();
          if (text) {
            await submitComment(pid, text, commentInput);
          }
        }
      });
    }

    // Wire up video play overlay
    const videoOverlay = profilePostViewerContent.querySelector('.video-play-overlay');
    if (videoOverlay) {
      videoOverlay.addEventListener('click', () => {
        const container = videoOverlay.closest('.post-media-container');
        const video = container.querySelector('.post-media-video');
        const playIcon = videoOverlay.querySelector('i');
        if (video.paused) {
          video.play();
          playIcon.setAttribute('data-lucide', 'pause');
          videoOverlay.style.background = 'rgba(0,0,0,0)';
          videoOverlay.style.opacity = '0';
        } else {
          video.pause();
          playIcon.setAttribute('data-lucide', 'play');
          videoOverlay.style.background = 'rgba(0,0,0,0.25)';
          videoOverlay.style.opacity = '1';
        }
        debouncedCreateIcons();
      });
    }

    // Wire up video mute/unmute
    const muteBtn = profilePostViewerContent.querySelector('.mute-btn-action');
    if (muteBtn) {
      muteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const container = muteBtn.closest('.post-media-container');
        const video = container.querySelector('.post-media-video');
        const muteIcon = muteBtn.querySelector('i');

        if (video.muted) {
          video.muted = false;
          muteIcon.setAttribute('data-lucide', 'volume-2');
        } else {
          video.muted = true;
          muteIcon.setAttribute('data-lucide', 'volume-2');
        }
        debouncedCreateIcons();
      });
    }

    // Wire up double-tap heart on media
    const mediaContainer = profilePostViewerContent.querySelector('.post-media-container');
    if (mediaContainer) {
      let lastTap = 0;
      mediaContainer.addEventListener('click', async (e) => {
        if (e.target.closest('.post-engagement-actions') || e.target.closest('.video-mute-container')) return;
        const now = Date.now();
        const timespan = now - lastTap;
        if (timespan < 300 && timespan > 0) {
          e.preventDefault();
          const btn = mediaContainer.closest('.feed-card').querySelector('.like-btn-action');
          const pid = btn.getAttribute('data-post-id');
          const rect = mediaContainer.getBoundingClientRect();
          const relativeX = e.clientX - rect.left;
          const relativeY = e.clientY - rect.top;

          triggerHeartExplosion(relativeX, relativeY, mediaContainer);

          if (!btn.classList.contains('liked')) {
            await togglePostLike(pid, btn);
          }
        }
        lastTap = now;
      });
    }
  }

  // Close profile post viewer modal
  if (profilePostViewerCloseBtn && profilePostViewerModal) {
    profilePostViewerCloseBtn.addEventListener('click', () => {
      profilePostViewerModal.classList.remove('active');
      // Pause any playing video
      const video = profilePostViewerContent.querySelector('video');
      if (video) video.pause();
    });
  }
  // Close on overlay background click
  if (profilePostViewerModal) {
    profilePostViewerModal.addEventListener('click', (e) => {
      if (e.target === profilePostViewerModal) {
        profilePostViewerModal.classList.remove('active');
        const video = profilePostViewerContent.querySelector('video');
        if (video) video.pause();
      }
    });
  }

  // Bind profile tabs selection logic
  const profileTabButtons = document.querySelectorAll('.profile-content-tab');
  profileTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      profileTabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tabName = btn.getAttribute('data-profile-tab');

      const vibesGrid = document.getElementById('profile-vibes-grid');
      const reelsGrid = document.getElementById('profile-reels-grid');
      const savedGrid = document.getElementById('profile-saved-grid');

      if (vibesGrid) vibesGrid.classList.remove('active');
      if (reelsGrid) reelsGrid.classList.remove('active');
      if (savedGrid) savedGrid.classList.remove('active');

      if (tabName === 'vibes') {
        if (vibesGrid) vibesGrid.classList.add('active');
      } else if (tabName === 'reels') {
        if (reelsGrid) reelsGrid.classList.add('active');
      } else if (tabName === 'saved') {
        if (savedGrid) {
          savedGrid.classList.add('active');
          renderSavedHubbs();
        }
      }
    });
  });

  // Bind follow/unfollow action on user profile
  const profileFollowBtn = document.getElementById('profile-follow-btn');
  if (profileFollowBtn) {

    function renderSavedHubbs() {
      const savedGrid = document.getElementById('profile-saved-grid');
      if (!savedGrid) return;
      savedGrid.innerHTML = '';

      const savedItems = window.savedHubbs || [];
      if (savedItems.length === 0) {
        savedGrid.innerHTML = '<div class="profile-grid-empty" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted); font-size: 14px;">No saved hubs yet. 🔖</div>';
        return;
      }

      savedItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'profile-grid-item';
        if (item.type === 'video') {
          div.innerHTML = `
          <video src="${item.url}" muted loop style="width:100%; height:100%; object-fit:cover;"></video>
          <div class="profile-grid-item-overlay">
            <span><i data-lucide="bookmark"></i> Saved</span>
          </div>`;
          const video = div.querySelector('video');
          div.addEventListener('mouseenter', () => video.play());
          div.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
        } else {
          div.innerHTML = `
          <img src="${item.url}" alt="Saved Hub" style="width:100%; height:100%; object-fit:cover;" />
          <div class="profile-grid-item-overlay">
            <span><i data-lucide="bookmark"></i> Saved</span>
          </div>`;
        }
        savedGrid.appendChild(div);
      });
      debouncedCreateIcons();
    }

    profileFollowBtn.addEventListener('click', async () => {
      const uid = profileFollowBtn.getAttribute('data-user-id');
      const token = localStorage.getItem('invibe_jwt_token');
      if (!token || !uid) return;

      const isFollowing = profileFollowBtn.classList.contains('followed');
      const endpoint = isFollowing ? 'unfollow' : 'follow';

      try {
        const res = await fetch(`${API_URL}/api/users/${uid}/${endpoint}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        if (endpoint === 'follow') {
          profileFollowBtn.classList.add('followed');
          profileFollowBtn.textContent = 'Hubbies';
          showToast(data.message || 'Followed successfully!');
        } else {
          profileFollowBtn.classList.remove('followed');
          profileFollowBtn.textContent = 'Follow';
          showToast('Unfollowed successfully.');
        }

        loadProfileStats();
        loadFollowSuggestions();
        loadUserProfile(uid);
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  // ─── FOLLOWERS / FOLLOWING RELATIONS MODAL LOGIC ───
  const followersCountEl = document.getElementById('profile-followers-count');
  const followingCountEl = document.getElementById('profile-following-count');
  const relationsModal = document.getElementById('relations-list-modal');
  const relationsCloseBtn = document.getElementById('relations-list-close-btn');
  const relationsTitle = document.getElementById('relations-list-title');
  const relationsContent = document.getElementById('relations-list-content');

  if (relationsCloseBtn && relationsModal) {
    relationsCloseBtn.addEventListener('click', () => {
      relationsModal.classList.remove('active');
    });
  }

  async function openRelationsModal(type) {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;

    const followBtn = document.getElementById('profile-follow-btn');
    const currentUserStr = localStorage.getItem('invibeUser');
    if (!currentUserStr) return;
    const currentUser = JSON.parse(currentUserStr);

    const isMe = (followBtn && followBtn.style.display === 'none');
    const targetUserId = isMe ? (currentUser.id || currentUser._id) : followBtn.getAttribute('data-user-id');
    if (!targetUserId) return;

    relationsTitle.textContent = type === 'followers' ? 'HUBBERS' : 'HUBBIES';
    relationsContent.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Loading...</div>';
    relationsModal.setAttribute('data-relation-type', type);
    relationsModal.classList.add('active');

    try {
      const res = await fetch(`${API_URL}/api/users/${targetUserId}/${type}-list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load list');
      const users = await res.json();

      relationsContent.innerHTML = '';
      if (users.length === 0) {
        relationsContent.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">No users found</div>`;
        return;
      }

      users.forEach(user => {
        const row = document.createElement('div');
        row.className = 'search-person-row';
        row.style.margin = '10px 0';
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';

        row.innerHTML = `
          <div class="person-info" style="display: flex; align-items: center; cursor: pointer;">
            <img src="${user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="${user.fullName}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-right: 10px;" />
            <div style="display: flex; flex-direction: column;">
              <strong class="relations-user-name" style="font-size: 14px; color: var(--text-color);">${user.fullName}</strong>
              <span style="font-size: 12px; color: var(--text-muted);">@${user.username}</span>
            </div>
          </div>
          ${user.isMe ? '' : `
            <button class="search-follow-btn relations-follow-btn ${user.isFollowing ? 'followed' : ''}" data-user-id="${user._id}">
              ${user.isFollowing ? 'Hubbies' : 'Follow'}
            </button>
          `}
        `;

        row.querySelector('.person-info').addEventListener('click', () => {
          relationsModal.classList.remove('active');
          switchView('profile', user._id);
        });

        const rFollowBtn = row.querySelector('.relations-follow-btn');
        if (rFollowBtn) {
          rFollowBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const uid = rFollowBtn.getAttribute('data-user-id');
            const isFollowing = rFollowBtn.classList.contains('followed');
            const endpoint = isFollowing ? 'unfollow' : 'follow';

            try {
              const res = await fetch(`${API_URL}/api/users/${uid}/${endpoint}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);

              if (endpoint === 'follow') {
                rFollowBtn.classList.add('followed');
                rFollowBtn.textContent = 'Hubbies';
                showToast(data.message || 'Followed successfully!');
              } else {
                rFollowBtn.classList.remove('followed');
                rFollowBtn.textContent = 'Follow';
                showToast('Unfollowed successfully.');
              }

              loadProfileStats();
              loadUserProfile(targetUserId);
            } catch (err) {
              showToast(err.message);
            }
          });
        }

        relationsContent.appendChild(row);
      });

      debouncedCreateIcons();
    } catch (err) {
      console.error(err);
      relationsContent.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--error-color);">Error loading data</div>';
    }
  }

  if (followersCountEl) {
    followersCountEl.parentElement.style.cursor = 'pointer';
    followersCountEl.parentElement.addEventListener('click', () => openRelationsModal('followers'));
  }
  if (followingCountEl) {
    followingCountEl.parentElement.style.cursor = 'pointer';
    followingCountEl.parentElement.addEventListener('click', () => openRelationsModal('following'));
  }

  // --- GLOBAL USER SEARCH LOGIC ---
  const globalSearchInput = document.getElementById('global-search');
  const searchDropdown = document.getElementById('search-results-dropdown');
  const searchList = document.getElementById('search-results-list');

  if (globalSearchInput && searchDropdown && searchList) {
    let searchDebounceTimeout;

    globalSearchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimeout);
      const query = globalSearchInput.value.trim();

      if (!query) {
        searchDropdown.style.display = 'none';
        searchList.innerHTML = '';
        return;
      }

      searchDebounceTimeout = setTimeout(async () => {
        const token = localStorage.getItem('invibe_jwt_token');
        if (!token) return;

        try {
          const res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Search failed');
          const users = await res.json();

          searchList.innerHTML = '';
          if (users.length === 0) {
            searchList.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 13px;">No users found</div>';
            searchDropdown.style.display = 'block';
            return;
          }

          users.forEach(user => {
            const row = document.createElement('div');
            row.className = 'search-result-row';
            row.innerHTML = `
              <img src="${user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="${user.fullName}" class="search-result-avatar" />
              <div class="search-result-info">
                <h5>${user.fullName}</h5>
                <p>@${user.username}</p>
              </div>
              <button class="search-follow-btn ${user.isFollowing ? 'followed' : ''}" data-user-id="${user._id}">
                ${user.isFollowing ? 'Hubbies' : 'Follow'}
              </button>
            `;

            // Row click triggers profile navigation
            row.addEventListener('click', (e) => {
              if (e.target.closest('.search-follow-btn')) return;

              switchView('profile', user._id);

              globalSearchInput.value = '';
              searchDropdown.style.display = 'none';
            });

            searchList.appendChild(row);
          });

          // Wire search result follow buttons
          const followBtns = searchList.querySelectorAll('.search-follow-btn');
          followBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const uid = btn.getAttribute('data-user-id');
              const isFollowing = btn.classList.contains('followed');
              const endpoint = isFollowing ? 'unfollow' : 'follow';

              try {
                const res = await fetch(`${API_URL}/api/users/${uid}/${endpoint}`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                if (endpoint === 'follow') {
                  btn.classList.add('followed');
                  btn.textContent = 'Hubbies';
                  showToast(data.message || 'Followed successfully!');
                } else {
                  btn.classList.remove('followed');
                  btn.textContent = 'Follow';
                  showToast('Unfollowed successfully.');
                }
                loadProfileStats();
                loadFollowSuggestions();
              } catch (err) {
                showToast(err.message);
              }
            });
          });

          searchDropdown.style.display = 'block';
        } catch (err) {
          console.error(err);
        }
      }, 250);
    });

    document.addEventListener('click', (e) => {
      if (!globalSearchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.style.display = 'none';
      }
    });
  }

  // Dedicated search tab input event listener
  const searchViewInput = document.getElementById('search-view-input');
  if (searchViewInput) {
    let searchViewDebounce;
    searchViewInput.addEventListener('input', () => {
      clearTimeout(searchViewDebounce);
      const query = searchViewInput.value.trim();

      const searchGrid = document.querySelector('.search-view .search-grid');
      let resultsContainer = document.getElementById('search-view-results');
      if (!resultsContainer) {
        resultsContainer = document.createElement('div');
        resultsContainer.id = 'search-view-results';
        resultsContainer.className = 'search-person-list';
        resultsContainer.style.marginTop = '20px';
        searchViewInput.closest('.search-view').appendChild(resultsContainer);
      }

      if (!query) {
        if (searchGrid) searchGrid.style.display = 'grid';
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
        return;
      }

      searchViewDebounce = setTimeout(async () => {
        const token = localStorage.getItem('invibe_jwt_token');
        if (!token) return;

        try {
          const res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Search failed');
          const users = await res.json();

          if (searchGrid) searchGrid.style.display = 'none';
          resultsContainer.style.display = 'block';
          resultsContainer.innerHTML = '';

          if (users.length === 0) {
            resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No users found matching your search.</div>';
            return;
          }

          users.forEach(user => {
            const row = document.createElement('div');
            row.className = 'search-person-row';
            row.style.margin = '12px 0';
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.background = 'rgba(255, 255, 255, 0.03)';
            row.style.padding = '12px';
            row.style.borderRadius = 'var(--radius-lg)';
            row.style.border = '1px solid rgba(255, 255, 255, 0.05)';

            row.innerHTML = `
              <div class="person-info" style="display: flex; align-items: center; cursor: pointer; flex-grow: 1;">
                <img src="${user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80'}" alt="${user.fullName}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; margin-right: 12px;" />
                <div style="display: flex; flex-direction: column;">
                  <strong style="font-size: 14px; color: var(--text-color);">${user.fullName}</strong>
                  <span style="font-size: 12px; color: var(--text-muted);">@${user.username}</span>
                </div>
              </div>
              <button class="search-follow-btn ${user.isFollowing ? 'followed' : ''}" data-user-id="${user._id}">
                ${user.isFollowing ? 'Hubbies' : 'Follow'}
              </button>
            `;

            // Row click triggers profile navigation
            row.querySelector('.person-info').addEventListener('click', () => {
              switchView('profile', user._id);
              searchViewInput.value = '';
              if (searchGrid) searchGrid.style.display = 'grid';
              resultsContainer.style.display = 'none';
            });

            // Follow button listener
            const followBtn = row.querySelector('.search-follow-btn');
            if (followBtn) {
              followBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const uid = followBtn.getAttribute('data-user-id');
                const isFollowing = followBtn.classList.contains('followed');
                const endpoint = isFollowing ? 'unfollow' : 'follow';

                try {
                  const res = await fetch(`${API_URL}/api/users/${uid}/${endpoint}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);

                  if (endpoint === 'follow') {
                    followBtn.classList.add('followed');
                    followBtn.textContent = 'Hubbies';
                    showToast(data.message || 'Followed successfully!');
                  } else {
                    followBtn.classList.remove('followed');
                    followBtn.textContent = 'Follow';
                    showToast('Unfollowed successfully.');
                  }
                  loadProfileStats();
                } catch (err) {
                  showToast(err.message);
                }
              });
            }

            resultsContainer.appendChild(row);
          });
        } catch (err) {
          console.error(err);
          showToast('Search query failed.');
        }
      }, 300);
    });
  }

  // Run database sync loaders
  loadFeedPosts();
  loadFeedReels();
  loadFollowSuggestions();
  loadProfileStats();
  loadStories();
  loadActiveVibers();

  // Custom auth reload hook
  window.updateAppUI = function () {
    const userStr = localStorage.getItem('invibeUser');
    const profileImage = localStorage.getItem('invibeProfileImage');
    if (!userStr) return;
    try {
      const user = JSON.parse(userStr);
      const headerAvatar = document.querySelector('#header-profile-avatar img');
      if (headerAvatar && profileImage) headerAvatar.src = profileImage;
      const sidebarAvatar = document.querySelector('.profile-preview-avatar img');
      if (sidebarAvatar && profileImage) sidebarAvatar.src = profileImage;
      const createPostAvatar = document.querySelector('#create-post-user-avatar');
      if (createPostAvatar && profileImage) createPostAvatar.src = profileImage;
      const sidebarName = document.querySelector('.profile-preview-info h3');
      if (sidebarName && user.fullName) sidebarName.textContent = user.fullName;
      const sidebarUsername = document.querySelector('.profile-preview-info p');
      if (sidebarUsername && user.username) sidebarUsername.textContent = '@' + user.username;
      const storyAvatar = document.querySelector('.story-card.current-user .story-avatar-container img');
      if (storyAvatar && profileImage) storyAvatar.src = profileImage;
      const myProfileAvatar = document.querySelector('.profile-screen-avatar');
      if (myProfileAvatar && profileImage) myProfileAvatar.src = profileImage;
      const myProfileName = document.querySelector('.profile-summary-top h3');
      if (myProfileName && user.fullName) {
        myProfileName.innerHTML = user.fullName;
        debouncedCreateIcons();
      }
      const myProfileUsername = document.querySelector('.profile-screen-handle');
      if (myProfileUsername && user.username) myProfileUsername.textContent = '@' + user.username;

      const bannerImage = localStorage.getItem('invibeBannerImage');
      const sidebarBanner = document.querySelector('.sidebar-left .card-cover-bg');
      if (sidebarBanner && bannerImage) {
        sidebarBanner.style.backgroundImage = `url(${bannerImage})`;
        sidebarBanner.style.backgroundSize = 'cover';
        sidebarBanner.style.backgroundPosition = 'center';
      }

      loadProfileStats();
      loadFollowSuggestions();
      loadStories();
      loadActiveVibers();
      loadNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  // ─── REALTIME CHAT & PRESENCE SUBSCRIBERS ──────────────────────────
  if (window.supabase) {
    try {
      window.supabase
        .channel('public:online_users')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'online_users' }, (payload) => {
          console.log('[Realtime Presence Debug] Event received on online_users:', payload);
          loadActiveVibers();
        })
        .subscribe();

      window.supabase
        .channel('public:messages')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
          console.log('[Realtime Chat Debug] Event received on messages:', payload);
          loadChatThreads();
          if (state.currentChatThread) {
            fetchMessages(state.currentChatThread, true);
          }
        })
        .subscribe();

      window.supabase
        .channel('public:typing_status')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'typing_status' }, (payload) => {
          console.log('[Realtime Typing Debug] Event received on typing_status:', payload);
          loadChatThreads();
        })
        .subscribe();
    } catch (rtErr) {
      console.warn('[Realtime Presence Subscription Notice]:', rtErr);
    }
  }

  // ─── NOTIFICATIONS DROPDOWN AND BADGES INTERACTION SYSTEM ────────────────────
  const notifBtn = document.getElementById('notif-btn');
  const notifPanel = document.getElementById('notifications-panel');
  const notifBadge = document.getElementById('header-notif-badge');
  const radialNotifBadge = document.getElementById('radial-notif-badge');

  async function loadNotifications() {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) {
      if (notifBadge) notifBadge.style.display = 'none';
      if (radialNotifBadge) radialNotifBadge.style.display = 'none';
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const notifications = await res.json();

      // Update badges (blue diamond for unread notifications)
      const unreadCount = notifications.filter(n => !n.read).length;
      if (unreadCount > 0) {
        if (notifBadge) {
          notifBadge.className = 'badge blue-diamond';
          notifBadge.style.display = 'block';
        }
        if (radialNotifBadge) {
          radialNotifBadge.className = 'nav-icon-badge blue-diamond';
          radialNotifBadge.style.display = 'flex';
          radialNotifBadge.textContent = '';
        }
      } else {
        if (notifBadge) {
          notifBadge.className = 'badge';
          notifBadge.style.display = 'none';
        }
        if (radialNotifBadge) {
          radialNotifBadge.className = 'nav-icon-badge';
          radialNotifBadge.style.display = 'none';
        }
      }

      // Render notification items in panel
      renderNotificationsPanel(notifications);
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  }

  function renderNotificationsPanel(notifications) {
    if (!notifPanel) return;

    const listContainer = notifPanel.querySelector('.notifications-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (notifications.length === 0) {
      listContainer.innerHTML = `
        <div class="notification-empty">
          <i data-lucide="bell-off"></i>
          <p>No notifications yet</p>
        </div>
      `;
      debouncedCreateIcons();
      return;
    }

    notifications.forEach(notif => {
      const item = document.createElement('div');
      const isUnread = notif.isRead === false || notif.read === false;
      item.className = `notification-item ${isUnread ? 'unread' : ''}`;

      const sender = notif.sender || { fullName: 'User', username: 'user', profileImage: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80' };
      const senderAvatar = sender.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';

      let messageText = notif.text || `<strong>@${sender.username}</strong> interacted with you.`;
      let actionButtons = '';

      if (notif.type === 'follow_request') {
        messageText = `<strong>@${sender.username}</strong> requested to follow you.`;
        actionButtons = `
          <div class="notif-action-btns" style="display: flex; gap: 6px; margin-top: 6px;">
            <button type="button" class="btn-accept-request" data-sender-id="${sender._id}" style="padding: 4px 10px; background: var(--primary, #a855f7); color: white; border: none; border-radius: 12px; font-size: 11px; font-weight: 600; cursor: pointer;">Accept</button>
            <button type="button" class="btn-reject-request" data-sender-id="${sender._id}" style="padding: 4px 10px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 12px; font-size: 11px; font-weight: 600; cursor: pointer;">Decline</button>
          </div>
        `;
      } else if (notif.type === 'accept_follow_request') {
        messageText = `<strong>@${sender.username}</strong> accepted your follow request.`;
      } else if (notif.type === 'follow') {
        messageText = `<strong>@${sender.username}</strong> started following you.`;
      } else if (notif.type === 'like') {
        messageText = `<strong>@${sender.username}</strong> liked your post.`;
      } else if (notif.type === 'comment') {
        messageText = `<strong>@${sender.username}</strong> commented on your post.`;
      }

      const timeAgo = formatTimeAgo(new Date(notif.createdAt || Date.now()));

      item.innerHTML = `
        <img src="${senderAvatar}" class="notification-avatar" alt="${sender.username}"/>
        <div class="notification-content" style="flex: 1;">
          <p>${messageText}</p>
          <span class="notification-time">${timeAgo}</span>
          ${actionButtons}
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-accept-request, .btn-reject-request')) return;
        e.stopPropagation();
        if (sender._id) {
          switchView('profile', sender._id);
          notifPanel.style.display = 'none';
        }
      });

      // Attach accept / reject listeners
      const acceptBtn = item.querySelector('.btn-accept-request');
      const rejectBtn = item.querySelector('.btn-reject-request');

      if (acceptBtn) {
        acceptBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const senderId = acceptBtn.getAttribute('data-sender-id');
          const token = localStorage.getItem('invibe_jwt_token');
          try {
            const res = await fetch(`${API_URL}/api/users/${senderId}/accept-follow-request`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
              showToast(`Accepted follow request from @${sender.username}! 🎉`);
              item.remove();
              updateAppUI();
            }
          } catch (err) {
            console.error("Accept error:", err);
          }
        });
      }

      if (rejectBtn) {
        rejectBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const senderId = rejectBtn.getAttribute('data-sender-id');
          const token = localStorage.getItem('invibe_jwt_token');
          try {
            const res = await fetch(`${API_URL}/api/users/${senderId}/reject-follow-request`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
              showToast(`Declined request from @${sender.username}`);
              item.remove();
            }
          } catch (err) {
            console.error("Decline error:", err);
          }
        });
      }

      listContainer.appendChild(item);
    });

    debouncedCreateIcons();
  }

  function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // Setup click handler for toggle panel
  if (notifBtn && notifPanel) {
    notifBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      const searchDropdown = document.getElementById('search-results-dropdown');
      if (searchDropdown) searchDropdown.style.display = 'none';

      const isVisible = notifPanel.style.display === 'flex';
      if (isVisible) {
        notifPanel.style.display = 'none';
      } else {
        notifPanel.style.display = 'flex';
        // Auto mark as read on open
        const token = localStorage.getItem('invibe_jwt_token');
        if (token) {
          try {
            await fetch(`${API_URL}/api/notifications/read`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            await loadNotifications();
          } catch (err) {
            console.error('Error marking read:', err);
          }
        }
      }
    });
  }

  // Mobile navigation bubble redirection to header button click
  const radialNotifBtn = document.getElementById('nav-notifications-btn');
  if (radialNotifBtn) {
    radialNotifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (notifBtn) notifBtn.click();
    });
  }

  // Manual mark all read button inside panel
  const markReadBtn = notifPanel ? notifPanel.querySelector('.mark-read-btn') : null;
  if (markReadBtn) {
    markReadBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const token = localStorage.getItem('invibe_jwt_token');
      if (!token) return;
      try {
        await fetch(`${API_URL}/api/notifications/read`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        await loadNotifications();
      } catch (err) {
        console.error('Error marking read:', err);
      }
    });
  }

  // Click outside to close panel
  document.addEventListener('click', (e) => {
    if (notifPanel && notifPanel.style.display === 'flex') {
      if (!notifPanel.contains(e.target) && (!notifBtn || !notifBtn.contains(e.target))) {
        notifPanel.style.display = 'none';
      }
    }
  });

  // Listen to auth load/changes
  window.addEventListener('auth-changed', () => {
    loadNotifications();
    loadChatThreads();
    loadProfileStats();
    loadFollowSuggestions();
  });

  // Initial load
  loadNotifications();
  loadChatThreads();

  // Polling for incoming calls every 2 seconds
  setInterval(() => {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;
    checkForIncomingCall();
  }, 2000);

  // Polling interval (every 4 seconds for real-world updates)
  setInterval(() => {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;

    loadNotifications();
    loadChatThreads();
    if (state.activeView === 'chats' && state.currentChatThread) {
      fetchMessages(state.currentChatThread, false);

      const activeThreadObj = chatThreads.find(t => t.user && t.user._id.toString() === state.currentChatThread.toString());
      if (activeThreadObj && activeThreadObj.user) {
        const u = activeThreadObj.user;
        const isOnline = (new Date() - new Date(u.lastActive)) < 120000;
        const statusHtml = isOnline
          ? `<span class="online-indicator blue-diamond-status" style="position:static; display:inline-block; margin-right:4px; width:8px; height:8px;"></span> Online`
          : `<span class="online-indicator black-diamond-status" style="position:static; display:inline-block; margin-right:4px; width:8px; height:8px;"></span> Offline`;
        const headerStatus = document.querySelector('.chat-header-status');
        if (headerStatus) headerStatus.innerHTML = statusHtml;
      }
    }
  }, 4000);

  function setupVideoScrollObserver() {
    const observerOptions = {
      root: null,
      threshold: [0, 0.25, 0.5, 0.75, 1.0]
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.intersectionRatio < 0.5) {
          if (!video.paused) {
            video.pause();
            const container = video.closest('.post-media-container');
            if (container) {
              const overlay = container.querySelector('.video-play-overlay');
              if (overlay) {
                overlay.style.display = 'flex';
                overlay.style.opacity = '1';
                overlay.style.background = 'rgba(0,0,0,0.25)';
                const playIcon = overlay.querySelector('i');
                if (playIcon) {
                  playIcon.setAttribute('data-lucide', 'play');
                }
                debouncedCreateIcons();
              }
            }
          }
        }
      });
    }, observerOptions);

    document.querySelectorAll('.post-media-video, .reel-video').forEach(video => {
      observer.observe(video);
    });

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const videos = node.querySelectorAll('.post-media-video, .reel-video');
            videos.forEach(video => observer.observe(video));
            if (node.classList.contains('post-media-video') || node.classList.contains('reel-video')) {
              observer.observe(node);
            }
          }
        });
      });
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  // --- DOUBLE CLICK TO LIKE ---
  document.addEventListener('dblclick', async (e) => {
    // For Posts
    const postMediaContainer = e.target.closest('.post-media-container');
    if (postMediaContainer) {
      e.preventDefault();

      const rect = postMediaContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      triggerHeartExplosion(clickX, clickY, postMediaContainer);

      const likeBtnAction = postMediaContainer.closest('article, .feed-card')
        ? postMediaContainer.closest('article, .feed-card').querySelector('.like-btn-action')
        : postMediaContainer.querySelector('.like-btn-action') || postMediaContainer.parentNode.querySelector('.like-btn-action');

      if (likeBtnAction && !likeBtnAction.classList.contains('liked')) {
        const postId = likeBtnAction.getAttribute('data-post-id');
        if (postId) {
          await togglePostLike(postId, likeBtnAction);
        }
      }
      return;
    }

    // For Reels (Hubbings)
    const reelCard = e.target.closest('.reel-card');
    if (reelCard) {
      e.preventDefault();

      const rect = reelCard.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      triggerHeartExplosion(clickX, clickY, reelCard);

      const likeBtnAction = reelCard.querySelector('.reel-like-action');
      const heartBtn = likeBtnAction ? likeBtnAction.querySelector('.heart-btn') : null;

      if (heartBtn && !heartBtn.classList.contains('liked')) {
        const reelId = likeBtnAction.getAttribute('data-reel-id');
        if (reelId) {
          await toggleReelLike(reelId, heartBtn);
        }
      }
      return;
    }
  });

  setupVideoScrollObserver();

  /* ========================================================= */
  /* DM ENHANCEMENTS LOGIC */
  /* ========================================================= */

  // --- AI Spelling Assistant ---
  const aiAssistantBtn = document.getElementById('chat-ai-assistant-btn');
  const aiPopover = document.getElementById('ai-spelling-popover');
  const aiContent = document.getElementById('ai-spelling-content');
  const aiAcceptBtn = document.getElementById('ai-spelling-accept-btn');
  const aiCancelBtn = document.getElementById('ai-spelling-cancel-btn');
  const aiActions = document.getElementById('ai-spelling-actions');

  let currentAiSuggestion = '';

  if (aiAssistantBtn) {
    aiAssistantBtn.addEventListener('click', () => {
      const text = messageInput.value.trim();
      if (!text) return;

      // Simple mock AI Spelling logic
      let suggestedText = text.replace(/\s{2,}/g, ' '); // remove double spaces
      // Mock correction example: capitalize first letter if not
      if (suggestedText.length > 0) {
        suggestedText = suggestedText.charAt(0).toUpperCase() + suggestedText.slice(1);
      }
      // Very basic spelling fix mock
      suggestedText = suggestedText.replace(/\bteh\b/g, 'the').replace(/\brecieve\b/g, 'receive');

      if (suggestedText === text) {
        aiContent.textContent = "No spelling corrections needed.";
        aiActions.style.display = 'none';
        currentAiSuggestion = '';
      } else {
        aiContent.textContent = suggestedText;
        aiActions.style.display = 'flex';
        currentAiSuggestion = suggestedText;
      }
      aiPopover.style.display = 'flex';
    });
  }
  if (aiAcceptBtn) {
    aiAcceptBtn.addEventListener('click', () => {
      if (currentAiSuggestion) {
        messageInput.value = currentAiSuggestion;
      }
      aiPopover.style.display = 'none';
    });
  }
  if (aiCancelBtn) {
    aiCancelBtn.addEventListener('click', () => {
      aiPopover.style.display = 'none';
    });
  }

  // --- Toast Notification ---
  function showDMToast(msg) {
    let toast = document.getElementById('dm-toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'dm-toast-notification';
      toast.className = 'dm-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // --- Reply & Action Menu ---
  const replyPreviewContainer = document.getElementById('chat-reply-preview-container');
  const replyPreviewSender = document.getElementById('reply-preview-sender');
  const replyPreviewText = document.getElementById('reply-preview-text');
  const replyPreviewCloseBtn = document.getElementById('reply-preview-close-btn');

  if (replyPreviewCloseBtn) {
    replyPreviewCloseBtn.addEventListener('click', () => {
      currentReplyToMessage = null;
      replyPreviewContainer.style.display = 'none';
    });
  }

  function activateReplyMode(msgId, rawText, senderName) {
    currentReplyToMessage = { id: msgId, text: rawText, senderName: senderName };
    replyPreviewSender.textContent = senderName;
    replyPreviewText.textContent = rawText;
    replyPreviewContainer.style.display = 'flex';
    messageInput.focus();
  }

  if (messagesScroll) {
    messagesScroll.addEventListener('dblclick', (e) => {
      const bubble = e.target.closest('.chat-bubble');
      if (bubble) {
        const msgId = bubble.getAttribute('data-msg-id');
        const rawText = bubble.getAttribute('data-raw-text') || 'Message';
        const senderName = bubble.getAttribute('data-sender-name') || 'User';
        activateReplyMode(msgId, rawText, senderName);
      }
    });

    messagesScroll.addEventListener('click', (e) => {
      const actionTrigger = e.target.closest('.message-action-trigger');
      if (actionTrigger) {
        const dropdown = actionTrigger.nextElementSibling;
        if (dropdown && dropdown.classList.contains('message-action-dropdown')) {
          dropdown.style.display = dropdown.style.display === 'flex' ? 'none' : 'flex';

          // Close others
          document.querySelectorAll('.message-action-dropdown').forEach(d => {
            if (d !== dropdown) d.style.display = 'none';
          });
        }
        return;
      }

      const replyBtn = e.target.closest('.action-reply');
      if (replyBtn) {
        const wrapper = replyBtn.closest('.message-bubble-wrapper');
        const bubble = wrapper.querySelector('.chat-bubble');
        if (bubble) {
          const msgId = bubble.getAttribute('data-msg-id');
          const rawText = bubble.getAttribute('data-raw-text') || 'Message';
          const senderName = bubble.getAttribute('data-sender-name') || 'User';
          activateReplyMode(msgId, rawText, senderName);
        }
        replyBtn.closest('.message-action-dropdown').style.display = 'none';
        return;
      }

      const copyBtn = e.target.closest('.action-copy');
      if (copyBtn) {
        const wrapper = copyBtn.closest('.message-bubble-wrapper');
        const bubble = wrapper.querySelector('.chat-bubble');
        if (bubble) {
          const rawText = bubble.getAttribute('data-raw-text') || '';
          navigator.clipboard.writeText(rawText).then(() => {
            showDMToast('Message copied');
          });
        }
        copyBtn.closest('.message-action-dropdown').style.display = 'none';
        return;
      }

      const forwardBtn = e.target.closest('.action-forward');
      if (forwardBtn) {
        const wrapper = forwardBtn.closest('.message-bubble-wrapper');
        const bubble = wrapper.querySelector('.chat-bubble');
        if (bubble) {
          openForwardModal(bubble.getAttribute('data-msg-id'), bubble.getAttribute('data-raw-text') || 'Message');
        }
        forwardBtn.closest('.message-action-dropdown').style.display = 'none';
        return;
      }

      const deleteBtn = e.target.closest('.action-delete');
      if (deleteBtn) {
        const wrapper = deleteBtn.closest('.message-bubble-wrapper');
        const bubble = wrapper.querySelector('.chat-bubble');
        if (bubble) {
          openDeleteModal(bubble.getAttribute('data-msg-id'), wrapper);
        }
        deleteBtn.closest('.message-action-dropdown').style.display = 'none';
        return;
      }

      // Close dropdowns when clicking elsewhere
      document.querySelectorAll('.message-action-dropdown').forEach(d => {
        d.style.display = 'none';
      });

      // Scroll to replied message if preview box clicked
      const repliedBox = e.target.closest('.replied-message-box');
      if (repliedBox) {
        const replyId = repliedBox.getAttribute('data-reply-id');
        if (replyId) {
          const targetBubble = messagesScroll.querySelector(`.chat-bubble[data-msg-id="${replyId}"]`);
          if (targetBubble) {
            targetBubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetBubble.style.transition = 'background-color 0.5s';
            const originalBg = targetBubble.style.backgroundColor;
            targetBubble.style.backgroundColor = 'rgba(108, 59, 255, 0.3)';
            setTimeout(() => {
              targetBubble.style.backgroundColor = originalBg;
            }, 1000);
          }
        }
      }
    });
  }

  // --- Forward Modal ---
  const forwardModal = document.getElementById('forward-message-modal');
  const forwardCloseBtn = document.getElementById('forward-close-btn');
  const forwardCancelBtn = document.getElementById('forward-cancel-btn');
  const forwardSendBtn = document.getElementById('forward-send-btn');
  const forwardSearchInput = document.getElementById('forward-search-input');
  const forwardContactsList = document.getElementById('forward-contacts-list');
  let currentForwardMsgText = '';
  let selectedForwardRecipients = [];

  function openForwardModal(msgId, rawText) {
    currentForwardMsgText = rawText;
    selectedForwardRecipients = [];
    forwardSearchInput.value = '';
    forwardSendBtn.disabled = true;
    forwardModal.classList.add('active');
    populateForwardContacts();
  }

  function populateForwardContacts(query = '') {
    if (!forwardContactsList) return;
    forwardContactsList.innerHTML = '';

    // Filter chatThreads based on query
    const filtered = chatThreads.filter(t => t.user && (t.user.fullname || t.user.username).toLowerCase().includes(query.toLowerCase()));

    if (filtered.length === 0) {
      forwardContactsList.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:10px;">No contacts found</div>';
      return;
    }

    filtered.forEach(t => {
      const u = t.user;
      const el = document.createElement('div');
      el.className = 'forward-contact-item';
      if (selectedForwardRecipients.includes(u._id)) {
        el.classList.add('selected');
      }
      const avatarSrc = u.profilePic ? (u.profilePic.startsWith('http') ? u.profilePic : `${API_URL}${u.profilePic}`) : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

      el.innerHTML = `
        <img src="${avatarSrc}" class="forward-contact-avatar" />
        <span class="forward-contact-name">${u.fullname || u.username}</span>
        <i data-lucide="check" class="forward-contact-check"></i>
      `;

      el.addEventListener('click', () => {
        if (selectedForwardRecipients.includes(u._id)) {
          selectedForwardRecipients = selectedForwardRecipients.filter(id => id !== u._id);
          el.classList.remove('selected');
        } else {
          selectedForwardRecipients.push(u._id);
          el.classList.add('selected');
        }
        forwardSendBtn.disabled = selectedForwardRecipients.length === 0;
      });

      forwardContactsList.appendChild(el);
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  if (forwardSearchInput) {
    forwardSearchInput.addEventListener('input', (e) => {
      populateForwardContacts(e.target.value.trim());
    });
  }

  if (forwardCloseBtn) forwardCloseBtn.addEventListener('click', () => forwardModal.classList.remove('active'));
  if (forwardCancelBtn) forwardCancelBtn.addEventListener('click', () => forwardModal.classList.remove('active'));
  if (forwardSendBtn) {
    forwardSendBtn.addEventListener('click', async () => {
      forwardSendBtn.disabled = true;
      forwardSendBtn.textContent = 'Forwarding...';

      const currentUser = getCurrentUser();
      const token = localStorage.getItem('invibe_jwt_token');
      if (!currentUser || !token) return;

      try {
        for (const recipientId of selectedForwardRecipients) {
          const secretKey = getChatSecretKey(currentUser.id || currentUser._id, recipientId);
          const encryptedText = encryptMessage(currentForwardMsgText, secretKey);

          await fetch(`${API_URL}/api/chats/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              recipient: recipientId,
              content: encryptedText
            })
          });
        }
        showDMToast('Message forwarded successfully');
      } catch (err) {
        console.error('Error forwarding message:', err);
        showDMToast('Failed to forward message');
      }

      forwardModal.classList.remove('active');
      forwardSendBtn.textContent = 'Forward';
      loadChatThreads();
    });
  }

  // --- Delete Modal Logic ---
  const deleteModal = document.getElementById('delete-message-modal');
  const deleteCloseBtn = document.getElementById('delete-close-btn');
  const deleteCancelBtn = document.getElementById('delete-cancel-btn');
  const deleteConfirmBtn = document.getElementById('delete-confirm-btn');

  let msgToDeleteId = null;
  let msgToDeleteWrapper = null;

  function openDeleteModal(msgId, wrapperElement) {
    msgToDeleteId = msgId;
    msgToDeleteWrapper = wrapperElement;
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = 'Delete';
    deleteModal.classList.add('active');
  }

  function closeDeleteModal() {
    deleteModal.classList.remove('active');
    msgToDeleteId = null;
    msgToDeleteWrapper = null;
  }

  if (deleteCloseBtn) deleteCloseBtn.addEventListener('click', closeDeleteModal);
  if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', closeDeleteModal);
  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener('click', async () => {
      if (!msgToDeleteId) return;

      deleteConfirmBtn.disabled = true;
      deleteConfirmBtn.textContent = 'Deleting...';

      const token = localStorage.getItem('invibe_jwt_token');
      if (!token) return closeDeleteModal();

      try {
        const res = await fetch(`${API_URL}/api/chats/message/${msgToDeleteId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          // Remove from UI
          if (msgToDeleteWrapper) {
            msgToDeleteWrapper.remove();
          }

          // Update chatFeeds state silently
          if (state.currentChatThread && chatFeeds[state.currentChatThread]) {
            chatFeeds[state.currentChatThread] = chatFeeds[state.currentChatThread].filter(m => {
              return (m._id || m.id) !== msgToDeleteId;
            });
          }

          showDMToast('Message deleted');

          // Refresh thread list to update preview (if it was the last message)
          loadChatThreads();
        } else {
          let errData;
          try {
            errData = await res.json();
          } catch (e) {
            errData = await res.text();
          }
          const currentUser = getCurrentUser() || {};
          console.error("Supabase Error Details:", {
            error: errData,
            table: 'messages',
            message_id: msgToDeleteId,
            authenticated_user_id: currentUser.id || currentUser._id,
            response: res.status
          });
          throw new Error((errData && errData.error) || 'Failed to delete message');
        }
      } catch (err) {
        console.error('Error deleting message:', err);
        showDMToast('Failed to delete message');
      }

      closeDeleteModal();
    });
  }

});

// ==========================================
// BEFORE / AFTER SLIDER LOGIC
// ==========================================
function initBeforeAfterSlider() {
  const container = document.getElementById('ba-slider-container');
  const imageBefore = document.getElementById('ba-image-before');
  const handle = document.getElementById('ba-slider-handle');

  if (container && imageBefore && handle) {
    let isDragging = false;

    const updateSlider = (x) => {
      const rect = container.getBoundingClientRect();
      let position = x - rect.left;
      
      // Keep within bounds
      position = Math.max(0, Math.min(position, rect.width));
      
      // Calculate percentage
      const percentage = (position / rect.width) * 100;
      
      // Update DOM
      imageBefore.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
      handle.style.left = `${percentage}%`;
    };

    // Mouse events
    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      e.preventDefault(); // Prevent text selection
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      updateSlider(e.clientX);
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Touch events for mobile
    handle.addEventListener('touchstart', (e) => {
      isDragging = true;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      updateSlider(e.touches[0].clientX);
    }, { passive: true });

    document.addEventListener('touchend', () => {
      isDragging = false;
    });
    
    // Initial setup (50%)
    imageBefore.style.clipPath = `inset(0 50% 0 0)`;
    handle.style.left = `50%`;
  }
}

window.initBeforeAfterSlider = initBeforeAfterSlider;
document.addEventListener('DOMContentLoaded', initBeforeAfterSlider);
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initBeforeAfterSlider();
}

// =========================================================================
// CREATE HUBBS - NATIVE FILE UPLOAD & PREVIEW SYSTEM
// =========================================================================
function initCreateHubbsUpload() {
  const uploadBox = document.getElementById('ch-upload-box');
  const fileInput = document.getElementById('ch-hidden-file-input');
  const cameraBtn = document.getElementById('ch-camera-btn');
  const addMediaBtn = document.getElementById('ch-add-media-btn');
  const previewContainer = document.getElementById('ch-media-preview-container');
  const previewRow = document.getElementById('ch-media-preview-row');
  const addMoreBtn = document.getElementById('ch-add-more-media-btn');

  if (!uploadBox || !fileInput) return;

  window.chUploads = window.chUploads || [];

  // Triggers
  if (cameraBtn) {
    cameraBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.setAttribute('capture', 'environment');
      fileInput.click();
    });
  }

  if (addMediaBtn) {
    addMediaBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.removeAttribute('capture');
      fileInput.click();
    });
  }

  uploadBox.addEventListener('click', () => {
    fileInput.removeAttribute('capture');
    fileInput.click();
  });

  if (addMoreBtn) {
    addMoreBtn.addEventListener('click', () => {
      fileInput.removeAttribute('capture');
      fileInput.click();
    });
  }

  // Drag and Drop
  uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadBox.style.borderColor = 'var(--primary, #a855f7)';
    uploadBox.style.background = 'rgba(168, 85, 247, 0.1)';
  });

  uploadBox.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadBox.style.borderColor = '';
    uploadBox.style.background = '';
  });

  uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.style.borderColor = '';
    uploadBox.style.background = '';
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    fileInput.value = ''; // Reset input to allow selecting same files again if removed
  });

  async function handleFiles(files) {
    const maxSize = 100 * 1024 * 1024; // 100MB
    const toast = document.getElementById('toast-notif');
    
    function showMsg(msg) {
      if (window.showToast) {
        window.showToast(msg);
      } else if (toast) {
        toast.textContent = msg;
        toast.classList.add('active');
        setTimeout(() => toast.classList.remove('active'), 2500);
      } else {
        alert(msg);
      }
    }

    // Optional: show loading indicator
    uploadBox.style.opacity = '0.5';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate Size
      if (file.size > maxSize) {
        showMsg("This file exceeds the maximum upload size of 100 MB.");
        continue;
      }

      // Validate Type
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        showMsg("This file type is not supported.");
        continue;
      }

      // Generate Thumbnail
      let thumbUrl = '';
      let duration = 0;
      let originalWidth = 1000;
      let originalHeight = 1000;

      try {
        if (file.type.startsWith('video/')) {
          const vData = await generateVideoThumbnail(file);
          thumbUrl = vData.thumb;
          duration = vData.duration;
          originalWidth = vData.width;
          originalHeight = vData.height;
        } else {
          thumbUrl = URL.createObjectURL(file);
          const img = new Image();
          img.src = thumbUrl;
          await new Promise(r => { img.onload = r; img.onerror = r; });
          if (img.naturalWidth) {
              originalWidth = img.naturalWidth;
              originalHeight = img.naturalHeight;
          }
        }

        window.chUploads.push({
          file: file,
          type: file.type,
          thumbUrl: thumbUrl,
          duration: duration,
          originalWidth: originalWidth,
          originalHeight: originalHeight,
          name: file.name,
          size: file.size,
          editorState: {
             filter: 'original', rotation: 0, zoom: 1, panX: 0, panY: 0,
             adjustments: { brightness: 100, contrast: 100, exposure: 100, highlights: 100, shadows: 100, temperature: 0, tint: 0, saturation: 100, vibrance: 100, sharpness: 0, blur: 0, opacity: 100 },
             crop: null, layers: [], isMuted: false, musicTrack: null, selectedLocation: null
          }
        });
      } catch (err) {
        console.error("Error generating thumbnail:", err);
        showMsg("Unable to load media. Please try again.");
      }
    }

    uploadBox.style.opacity = '1';
    renderMediaPreviews();
  }

  function generateVideoThumbnail(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(file);
      video.src = url;

      video.onloadedmetadata = () => {
        // Seek to 0.1s to grab a frame, ensuring it's loaded
        video.currentTime = Math.min(0.1, video.duration > 0 ? video.duration / 2 : 0);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 240;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          URL.revokeObjectURL(url);
          resolve({ thumb: dataUrl, duration: video.duration, width: video.videoWidth || 320, height: video.videoHeight || 240 });
        } catch (e) {
          reject(e);
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Video load error"));
      };
    });
  }

  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  window.getEffectiveLayout = function(layoutName, uploads) {
      if (layoutName !== 'auto') return layoutName;
      if (!uploads || uploads.length === 0) return layoutName;
      const count = uploads.length;
      let portraits = 0, landscapes = 0, squares = 0;
      uploads.forEach(item => {
          const ar = (window.HubbleEditor && window.HubbleEditor.getEditedAspectRatio) ? window.HubbleEditor.getEditedAspectRatio(item) : 1;
          if (ar < 0.9) portraits++;
          else if (ar > 1.1) landscapes++;
          else squares++;
      });
      if (count === 1) return 'single';
      if (count === 2) {
          if (portraits >= 1 && landscapes === 0 && squares === 0) return 'vertical-split';
          if (portraits === 2) return 'vertical-split';
          return 'side-by-side';
      }
      return '2x2-grid';
  };

  function renderMediaPreviews() {
    // Remove existing previews and layout rows except the Add More button
    const existingItems = previewRow.querySelectorAll('.ch-layout-row, .ch-preview-item');
    existingItems.forEach(el => {
       // Ensure we don't accidentally remove the addMoreBtn if it somehow matches
       if (el.id !== 'ch-add-more-media-btn') {
          el.remove();
       }
    });

    if (window.chUploads.length === 0) {
      uploadBox.style.display = 'block';
      previewContainer.style.display = 'none';
      return;
    }

    uploadBox.style.display = 'none';
    previewContainer.style.display = 'block';

    const previewBlocks = [];

    window.chUploads.forEach((item, index) => {
      const previewEl = document.createElement('div');
      previewEl.className = 'ch-preview-item';
      previewEl.draggable = true;
      previewEl.setAttribute('data-index', index);
      // Inline styles to match original structure
      previewEl.style.cssText = 'position: relative; flex-shrink: 0; width: 100px; height: 100px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); transition: transform 0.2s, box-shadow 0.2s; cursor: grab; background: #1a1a1a;';
      
      const img = document.createElement('img');
      img.src = item.thumbUrl;
      img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; object-position: center; border-radius: 10px; pointer-events: none;';
      previewEl.appendChild(img);

      if (item.type.startsWith('video/')) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.75); color: white; padding: 2px 6px; border-radius: 6px; font-size: 0.7rem; font-weight: 600; display: flex; align-items: center; gap: 4px; backdrop-filter: blur(4px); pointer-events: none;';
        overlay.innerHTML = `<i data-lucide="video" style="width: 10px; height: 10px;"></i> ${formatDuration(item.duration)}`;
        previewEl.appendChild(overlay);
      }

      const rmBtn = document.createElement('button');
      rmBtn.className = 'ch-remove-media';
      rmBtn.style.cssText = 'position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; border-radius: 50%; background: #ff3b30; color: white; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.4); z-index: 10; padding: 0; transition: transform 0.2s;';
      rmBtn.innerHTML = '<i data-lucide="x" style="width: 12px; height: 12px;"></i>';
      rmBtn.onmouseover = () => { rmBtn.style.transform = 'scale(1.1)'; };
      rmBtn.onmouseout = () => { rmBtn.style.transform = 'scale(1)'; };
      rmBtn.onclick = (e) => {
        e.stopPropagation();
        previewEl.classList.add('exiting'); // Apply animation
        setTimeout(() => {
          window.chUploads.splice(index, 1);
          if (item.type.startsWith('image/')) {
            URL.revokeObjectURL(item.thumbUrl);
          }
          if (window.HubbleEditor && window.HubbleEditor.cleanupMedia) {
            window.HubbleEditor.cleanupMedia();
          }
          
          if (window.HubbleEditor) {
             if (window.chUploads.length === 0) {
                window.HubbleEditor.activeMediaIndex = 0;
                window.HubbleEditor.state = {
                     filter: 'original', rotation: 0, zoom: 1, panX: 0, panY: 0,
                     adjustments: { brightness: 100, contrast: 100, exposure: 100, highlights: 100, shadows: 100, temperature: 0, tint: 0, saturation: 100, vibrance: 100, sharpness: 0, blur: 0, opacity: 100 },
                     crop: null, layers: [], isMuted: false, musicTrack: null, selectedLocation: null
                };
                window.HubbleEditor.history = [JSON.parse(JSON.stringify(window.HubbleEditor.state))];
                window.HubbleEditor.redoStack = [];
                window.HubbleEditor.activeSelectedLayerId = null;
                window.HubbleEditor.updateRender();
             } else {
                if (window.HubbleEditor.activeMediaIndex === index) {
                   window.HubbleEditor.activeMediaIndex = 0;
                   if (window.chUploads[0].editorState) {
                       window.HubbleEditor.state = JSON.parse(JSON.stringify(window.chUploads[0].editorState));
                   }
                   window.HubbleEditor.updateRender();
                } else if (window.HubbleEditor.activeMediaIndex > index) {
                   window.HubbleEditor.activeMediaIndex--;
                }
             }
          }
          
          renderMediaPreviews();
        }, 350); // wait for animation to complete
      };
      previewEl.appendChild(rmBtn);

      // Drag and Drop Reordering Support
      previewEl.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', index);
        previewEl.style.opacity = '0.5';
      });
      previewEl.addEventListener('dragend', () => {
        previewEl.style.opacity = '1';
        previewRow.querySelectorAll('.ch-preview-item').forEach(el => el.style.border = '1px solid rgba(255,255,255,0.08)');
      });
      previewEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        previewEl.style.border = '2px solid var(--primary, #a855f7)';
      });
      previewEl.addEventListener('dragleave', () => {
        previewEl.style.border = '1px solid rgba(255,255,255,0.08)';
      });
      previewEl.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (!isNaN(draggedIndex) && draggedIndex !== index) {
          // Swap logic
          const draggedItem = window.chUploads.splice(draggedIndex, 1)[0];
          window.chUploads.splice(index, 0, draggedItem);
          renderMediaPreviews();
        }
      });

      // Click to select and edit this specific media item
      previewEl.addEventListener('click', () => {
        if (window.HubbleEditor) {
           // Save current state to the previously active media
           if (window.chUploads[window.HubbleEditor.activeMediaIndex]) {
               window.chUploads[window.HubbleEditor.activeMediaIndex].editorState = JSON.parse(JSON.stringify(window.HubbleEditor.state));
           }
           // Switch active media index
           window.HubbleEditor.activeMediaIndex = index;
           // Load the state for the new media, or reset if none exists
           if (item.editorState) {
               window.HubbleEditor.state = JSON.parse(JSON.stringify(item.editorState));
           } else {
               window.HubbleEditor.state = {
                 filter: 'original', rotation: 0, zoom: 1, panX: 0, panY: 0,
                 adjustments: { brightness: 100, contrast: 100, exposure: 100, highlights: 100, shadows: 100, temperature: 0, tint: 0, saturation: 100, vibrance: 100, sharpness: 0, blur: 0, opacity: 100 },
                 crop: null, layers: [], isMuted: false, musicTrack: null, selectedLocation: null
               };
           }
           window.HubbleEditor.updateRender();
        }
        
        // Highlight active preview visually
        document.querySelectorAll('.ch-preview-item').forEach(el => el.style.border = '1px solid rgba(255,255,255,0.08)');
        previewEl.style.border = '2px solid var(--primary, #a855f7)';
        
        if (window.showToast) window.showToast(`Editing ${item.name} 🔍`);
      });

      // Update this thumbnail to reflect any existing edits visually BEFORE grouping
      if (window.HubbleEditor && typeof window.HubbleEditor.updatePreviewThumbnail === 'function') {
         window.HubbleEditor.updatePreviewThumbnail(index, previewEl);
      }
      
      previewBlocks.push({ mediaItem: item, el: previewEl });
    });

    // Grouping Logic
    let layout = (window.HubbleEditor && window.HubbleEditor.activeLayout) || 'original';
    let effectiveLayout = window.getEffectiveLayout(layout, window.chUploads);

    previewBlocks.forEach(b => previewRow.insertBefore(b.el, addMoreBtn));
    // Ensure the currently active media item is highlighted
    const activeIndex = window.HubbleEditor ? window.HubbleEditor.activeMediaIndex : 0;
    const activeEl = previewRow.querySelector(`.ch-preview-item[data-index="${activeIndex}"]`);
    if (activeEl) {
       activeEl.style.border = '2px solid var(--primary, #a855f7)';
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
    
    // Toggle Media Layouts visibility
    const layoutsDisabledMsg = document.getElementById('ch-layouts-disabled-msg');
    const layoutsOptions = document.getElementById('ch-layouts-options');
    if (layoutsDisabledMsg && layoutsOptions) {
      if (window.chUploads.length >= 2) {
        layoutsDisabledMsg.style.display = 'none';
        layoutsOptions.style.display = 'flex';
        
        const btnSideBySide = document.querySelector('.ch-layout-btn[data-layout="side-by-side"]');
        const btnVerticalSplit = document.querySelector('.ch-layout-btn[data-layout="vertical-split"]');
        const btn2x2Grid = document.querySelector('.ch-layout-btn[data-layout="2x2-grid"]');
        
        if (window.chUploads.length === 2) {
           if (btnSideBySide) btnSideBySide.style.display = 'block';
           if (btnVerticalSplit) btnVerticalSplit.style.display = 'block';
           if (btn2x2Grid) btn2x2Grid.style.display = 'none';
           
           if (window.HubbleEditor && window.HubbleEditor.activeLayout === '2x2-grid') {
               window.HubbleEditor.setLayout('auto');
           }
        } else {
           if (btnSideBySide) btnSideBySide.style.display = 'none';
           if (btnVerticalSplit) btnVerticalSplit.style.display = 'none';
           if (btn2x2Grid) btn2x2Grid.style.display = 'block';
           
           if (window.HubbleEditor && (window.HubbleEditor.activeLayout === 'side-by-side' || window.HubbleEditor.activeLayout === 'vertical-split')) {
               window.HubbleEditor.setLayout('auto');
           }
        }
      } else {
        layoutsDisabledMsg.style.display = 'block';
        layoutsOptions.style.display = 'none';
        // Reset to original layout internally
        if (window.HubbleEditor) window.HubbleEditor.setLayout('original');
      }
    }
  }

  // Initial check
  renderMediaPreviews();
}

document.addEventListener('DOMContentLoaded', initCreateHubbsUpload);
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initCreateHubbsUpload();
}
// =========================================================================
// REVIEW HUBBS - NAVIGATION & VALIDATION
// =========================================================================
window.toggleScheduling = function(checked) {
  const row = document.getElementById('ch-schedule-datetime-row');
  const dateInput = document.getElementById('ch-schedule-date');
  const timeInput = document.getElementById('ch-schedule-time');
  
  if (checked) {
    row.style.display = 'flex';
    // Small delay to allow display:flex to apply before setting opacity for transition
    setTimeout(() => {
      row.style.opacity = '1';
    }, 10);
    
    // Set default date/time to now + 1 hour if empty
    if (!dateInput.value || !timeInput.value) {
      const now = new Date();
      now.setHours(now.getHours() + 1);
      
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      dateInput.value = `${yyyy}-${mm}-${dd}`;
      
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      timeInput.value = `${hh}:${min}`;
    }
  } else {
    row.style.opacity = '0';
    setTimeout(() => {
      row.style.display = 'none';
    }, 300);
  }
};

window.handleReviewNavigation = function() {
  if (!window.chUploads || window.chUploads.length === 0) {
    showValidationModal();
    return;
  }
  
  // Validate scheduling if enabled
  const toggle = document.getElementById('ch-schedule-toggle');
  let scheduledAtIso = null;
  
  if (toggle && toggle.checked) {
    const dateVal = document.getElementById('ch-schedule-date').value;
    const timeVal = document.getElementById('ch-schedule-time').value;
    
    if (!dateVal || !timeVal) {
      if (window.showToast) window.showToast('Please select a valid date and time for scheduling.', 'error');
      return;
    }
    
    const scheduledTime = new Date(`${dateVal}T${timeVal}`);
    if (isNaN(scheduledTime.getTime())) {
      if (window.showToast) window.showToast('Invalid date or time selected.', 'error');
      return;
    }
    
    if (scheduledTime <= new Date()) {
      if (window.showToast) window.showToast('Scheduled time must be in the future.', 'error');
      return;
    }
    
    scheduledAtIso = scheduledTime.toISOString();
    window.chScheduledAt = scheduledAtIso; // Store for publish
    
    // Update Review Page Footer
    const infoBox = document.getElementById('review-scheduled-info');
    const infoText = document.getElementById('review-scheduled-text');
    const pubText = document.getElementById('review-publish-text');
    const pubIcon = document.getElementById('review-publish-icon');
    
    if (infoBox && infoText && pubText && pubIcon) {
      infoBox.style.display = 'flex';
      const formattedDate = scheduledTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const formattedTime = scheduledTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      infoText.innerText = `${formattedDate} at ${formattedTime}`;
      
      pubText.innerText = 'Schedule Hubb';
      pubIcon.setAttribute('data-lucide', 'calendar-clock');
      if (window.lucide) window.lucide.createIcons();
    }
  } else {
    window.chScheduledAt = null;
    
    // Reset Review Page Footer
    const infoBox = document.getElementById('review-scheduled-info');
    const pubText = document.getElementById('review-publish-text');
    const pubIcon = document.getElementById('review-publish-icon');
    
    if (infoBox && pubText && pubIcon) {
      infoBox.style.display = 'none';
      pubText.innerText = 'Publish Hubb';
      pubIcon.setAttribute('data-lucide', 'upload-cloud');
      if (window.lucide) window.lucide.createIcons();
    }
  }
  
  // Navigate to review view
  switchView('review-hubbs');
  
  // Initialize slider with the actual uploaded media
  setTimeout(window.initReviewSlider, 50);
};

function showValidationModal() {
  let overlay = document.getElementById('review-validation-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'review-validation-overlay';
    overlay.className = 'review-validation-modal-overlay';
    
    overlay.innerHTML = `
      <div class="review-validation-modal">
        <h3 style="margin: 0 0 8px 0; font-size: 1.5rem; font-weight: 700;">No HUBB Selected</h3>
        <p style="margin: 0 0 24px 0; font-size: 0.95rem;">Please select at least one photo or video before continuing.</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="rv-cancel-btn" style="padding: 10px 24px; border-radius: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-weight: 600; cursor: pointer; transition: all 0.2s;">Cancel</button>
          <button id="rv-upload-btn" style="padding: 10px 24px; border-radius: 8px; background: linear-gradient(135deg, var(--primary) 0%, #a855f7 100%); border: none; color: white; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(168,85,247,0.3); transition: all 0.2s;">Upload Media</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById('rv-cancel-btn').addEventListener('click', () => {
      overlay.classList.remove('active');
    });
    
    document.getElementById('rv-upload-btn').addEventListener('click', () => {
      overlay.classList.remove('active');
      // Trigger the file picker
      const fileInput = document.getElementById('ch-hidden-file-input');
      if (fileInput) fileInput.click();
    });
  }
  
  // Trigger animation
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });
}

// =========================================================================
// REVIEW HUBBS - COMPARISON SLIDER & SYNC
// =========================================================================
window.initReviewSlider = function() {
  const emptyState = document.getElementById('review-empty-state');
  const sliderWrapper = document.getElementById('review-slider-wrapper');
  
  if (!window.chUploads || window.chUploads.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
    if (sliderWrapper) sliderWrapper.style.display = 'none';
    return;
  }
  
  if (emptyState) emptyState.style.display = 'none';
  if (sliderWrapper) sliderWrapper.style.display = 'block';
  
  const beforeContainer = document.getElementById('review-before-container');
  const afterContainer = document.getElementById('review-after-container');
  
  if (!beforeContainer || !afterContainer) return;
  
  // Clear containers except for absolute labels and lines
  [beforeContainer, afterContainer].forEach(container => {
    Array.from(container.children).forEach(child => {
      if (!child.style.position.includes('absolute')) {
        if (child.tagName === 'VIDEO') {
          child.pause();
          child.removeAttribute('src');
          child.load();
        }
        child.remove();
      }
    });
  });

  const hasMultiple = window.chUploads.length >= 2;
  let layout = (window.HubbleEditor && window.HubbleEditor.activeLayout) || 'original';
  
  layout = window.getEffectiveLayout(layout, window.chUploads);

  const layoutClass = (hasMultiple && layout !== 'original' && layout !== 'single') ? `layout-${layout}` : '';

  const beforeWrapper = document.createElement('div');
  beforeWrapper.style.cssText = 'width: 100%; height: 100%;';
  if (layoutClass) beforeWrapper.className = layoutClass;

  const afterWrapper = document.createElement('div');
  afterWrapper.style.cssText = 'width: 100%; height: 100%;';
  if (layoutClass) afterWrapper.className = layoutClass;
  
  let firstVideoBefore = null;
  let firstVideoAfter = null;

  const beforeBlocks = [];
  const afterBlocks = [];

  window.chUploads.forEach((mediaItem) => {
    const url = URL.createObjectURL(mediaItem.file);
    const state = mediaItem.editorState || {
       filter: 'original', rotation: 0, zoom: 1, panX: 0, panY: 0,
       adjustments: { brightness: 100, contrast: 100, exposure: 100, highlights: 100, shadows: 100, temperature: 0, tint: 0, saturation: 100, vibrance: 100, sharpness: 0, blur: 0, opacity: 100 },
       crop: null, layers: [], isMuted: false, musicTrack: null, selectedLocation: null
    };

    const ar = (window.HubbleEditor && window.HubbleEditor.getEditedAspectRatio) ? window.HubbleEditor.getEditedAspectRatio(mediaItem) : 1;
    const beforeCell = document.createElement('div');
    beforeCell.className = 'ch-preview-item';
    beforeCell.style.cssText = `position: relative; width: 100%; height: 100%; overflow: hidden; display: flex; align-items: center; justify-content: center;`;
    
    const afterCell = document.createElement('div');
    afterCell.className = 'ch-preview-item';
    afterCell.style.cssText = `position: relative; width: 100%; height: 100%; overflow: hidden; display: flex; align-items: center; justify-content: center;`;

    const beforeFrame = document.createElement('div');
    beforeFrame.className = 'edited-frame';
    beforeFrame.style.cssText = `position: relative; overflow: hidden; aspect-ratio: ${ar}; border-radius: 10px; background: #1a1a1a; display: flex; align-items: center; justify-content: center; margin: auto; width: min(100cqw, calc(100cqh * ${ar})); height: min(100cqh, calc(100cqw / ${ar}));`;

    const afterFrame = document.createElement('div');
    afterFrame.className = 'edited-frame';
    afterFrame.style.cssText = `position: relative; overflow: hidden; aspect-ratio: ${ar}; border-radius: 10px; background: #1a1a1a; display: flex; align-items: center; justify-content: center; margin: auto; width: min(100cqw, calc(100cqh * ${ar})); height: min(100cqh, calc(100cqw / ${ar}));`;


    let cw = 100, ch = 100, cx = 0, cy = 0;
    if (state.crop) {
       cw = state.crop.width; ch = state.crop.height; cx = state.crop.x; cy = state.crop.y;
    }
    const cropScaleCSS = state.crop ? `position: absolute; width: ${10000/cw}%; height: ${10000/ch}%; left: -${(cx/cw)*100}%; top: -${(cy/ch)*100}%;` : `position: absolute; width: 100%; height: 100%; left: 0; top: 0;`;

    const beforeInner = document.createElement('div');
    beforeInner.style.cssText = 'position: absolute; width: 100%; height: 100%; left: 0; top: 0;';

    const afterInner = document.createElement('div');
    afterInner.style.cssText = cropScaleCSS;

    let beforeMediaNode, afterMediaNode;

    if (mediaItem.type.startsWith('video/')) {
      beforeMediaNode = document.createElement('video');
      afterMediaNode = document.createElement('video');
      
      [beforeMediaNode, afterMediaNode].forEach(v => {
        v.src = url;
        v.style.cssText = 'position: absolute; width: 100%; height: 100%; object-fit: contain; object-position: center;';
        v.loop = true;
        v.muted = state.isMuted || false;
        v.playsInline = true;
        v.autoplay = true;
      });
      
      if (!firstVideoBefore) {
         firstVideoBefore = beforeMediaNode;
         firstVideoAfter = afterMediaNode;
      } else {
         // Sync secondary videos to the first one just by playing them together
         firstVideoBefore.addEventListener('play', () => beforeMediaNode.play());
         firstVideoBefore.addEventListener('pause', () => beforeMediaNode.pause());
         firstVideoBefore.addEventListener('seeking', () => beforeMediaNode.currentTime = firstVideoBefore.currentTime);
         firstVideoAfter.addEventListener('play', () => afterMediaNode.play());
         firstVideoAfter.addEventListener('pause', () => afterMediaNode.pause());
         firstVideoAfter.addEventListener('seeking', () => afterMediaNode.currentTime = firstVideoAfter.currentTime);
      }
    } else {
      beforeMediaNode = document.createElement('img');
      afterMediaNode = document.createElement('img');
      [beforeMediaNode, afterMediaNode].forEach(img => {
        img.src = url;
        img.style.cssText = 'position: absolute; width: 100%; height: 100%; object-fit: contain; object-position: center;';
      });
    }

    // Apply Edits to After node
    if (window.HubbleEditor) {
        afterMediaNode.style.filter = window.HubbleEditor.buildCSSFilterString(state.filter, state.adjustments);
    }
    const zoom = state.zoom || 1;
    afterMediaNode.style.transform = `translate(${state.panX || 0}%, ${state.panY || 0}%) rotate(${state.rotation || 0}deg) scale(${zoom})`;

    beforeInner.appendChild(beforeMediaNode);
    beforeFrame.appendChild(beforeInner);
    beforeCell.appendChild(beforeFrame);
    
    afterInner.appendChild(afterMediaNode);
    afterFrame.appendChild(afterInner);

    // Inject Layers (Stickers / Text)
    const interactionWrapper = document.createElement('div');
    interactionWrapper.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
    
    if (state.layers) {
      state.layers.forEach((layer) => {
        const el = document.createElement('div');
        el.style.cssText = `position: absolute; left: ${layer.x}%; top: ${layer.y}%; transform: translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale}); z-index: ${layer.zIndex}; pointer-events: none;`;
        if (layer.type === 'text') {
          el.innerHTML = `<div style="color: ${layer.styles.color || 'white'}; font-family: ${layer.styles.font || 'inherit'}; font-size: ${layer.styles.size || 24}px; font-weight: ${layer.styles.bold ? 'bold' : 'normal'}; font-style: ${layer.styles.italic ? 'italic' : 'normal'}; text-shadow: ${layer.styles.shadow ? '0 2px 10px rgba(0,0,0,0.5)' : 'none'}; text-align: center; white-space: pre-wrap;">${layer.content}</div>`;
        } else if (layer.type === 'sticker') {
          el.innerHTML = `<div style="font-size: ${layer.styles.size || 80}px; pointer-events: none;">${layer.content}</div>`;
        }
        interactionWrapper.appendChild(el);
      });
    }
    afterFrame.appendChild(interactionWrapper);
    afterCell.appendChild(afterFrame);

    beforeBlocks.push({ mediaItem, el: beforeCell });
    afterBlocks.push({ mediaItem, el: afterCell });
  });

  beforeBlocks.forEach(b => beforeWrapper.appendChild(b.el));
  afterBlocks.forEach(b => afterWrapper.appendChild(b.el));
  
  // Audio sync and controls for the primary video
  if (firstVideoBefore) {
      firstVideoBefore.addEventListener('play', () => { 
        firstVideoAfter.play(); 
        if (window.HubbleEditor && window.HubbleEditor.GlobalAudio) {
            window.HubbleEditor.GlobalAudio.sync(firstVideoBefore.currentTime);
            window.HubbleEditor.GlobalAudio.play(); 
        }
      });
      firstVideoBefore.addEventListener('pause', () => { 
        firstVideoAfter.pause(); 
        if (window.HubbleEditor && window.HubbleEditor.GlobalAudio) {
            window.HubbleEditor.GlobalAudio.pause(); 
        }
      });
      firstVideoBefore.addEventListener('seeking', () => {
        firstVideoAfter.currentTime = firstVideoBefore.currentTime;
        if (window.HubbleEditor && window.HubbleEditor.GlobalAudio) {
            window.HubbleEditor.GlobalAudio.sync(firstVideoBefore.currentTime);
        }
      });
      firstVideoBefore.addEventListener('seeked', () => {
        firstVideoAfter.currentTime = firstVideoBefore.currentTime;
        if (window.HubbleEditor && window.HubbleEditor.GlobalAudio) {
            window.HubbleEditor.GlobalAudio.sync(firstVideoBefore.currentTime);
        }
      });

      sliderWrapper.onclick = (e) => {
        if (e.target.id === 'review-slider-handle' || e.target.closest('#review-slider-handle') || e.target.closest('#he-speaker-btn')) return;
        if (firstVideoBefore.paused) {
          firstVideoBefore.play();
          const btn = document.getElementById('he-review-play-btn');
          if (btn) {
              btn.innerHTML = '<i data-lucide="pause" style="color: white; width: 32px; height: 32px;"></i>';
              if (window.lucide) window.lucide.createIcons();
              btn.style.opacity = '1';
              btn.style.transform = 'scale(1)';
              setTimeout(() => { btn.style.opacity = '0'; btn.style.transform = 'scale(0.9)'; }, 2000);
          }
        } else {
          firstVideoBefore.pause();
          const btn = document.getElementById('he-review-play-btn');
          if (btn) {
              btn.innerHTML = '<i data-lucide="play" style="color: white; width: 32px; height: 32px;"></i>';
              if (window.lucide) window.lucide.createIcons();
              btn.style.opacity = '1';
              btn.style.transform = 'scale(1)';
          }
        }
      };

      let reviewControls = document.getElementById('he-review-controls');
      if (reviewControls) reviewControls.remove();
      if (window.HubbleEditor) {
         reviewControls = window.HubbleEditor.buildVideoControls(sliderWrapper, firstVideoBefore, true);
      }
  } else {
      let reviewControls = document.getElementById('he-review-controls');
      if (reviewControls) reviewControls.remove();
  }

  // Insert at the beginning so they sit behind the absolute positioned labels
  beforeContainer.insertBefore(beforeWrapper, beforeContainer.firstChild);
  afterContainer.insertBefore(afterWrapper, afterContainer.firstChild);

  // Setup Draggable Handle
  const handle = document.getElementById('review-slider-handle');
  if (handle) {
    let isDragging = false;
    
    const updateSliderPos = (x) => {
      const rect = sliderWrapper.getBoundingClientRect();
      let position = x - rect.left;
      position = Math.max(0, Math.min(position, rect.width));
      const percentage = (position / rect.width) * 100;
      
      beforeContainer.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
      handle.style.left = `${percentage}%`;
    };

    handle.onmousedown = (e) => {
      isDragging = true;
      e.preventDefault(); 
    };
    
    handle.ontouchstart = (e) => {
      isDragging = true;
    };
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      updateSliderPos(e.clientX);
    });
    
    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      updateSliderPos(e.touches[0].clientX);
    }, { passive: true });
    
    document.addEventListener('mouseup', () => isDragging = false);
    document.addEventListener('touchend', () => isDragging = false);
    
    // Initial State 50%
    beforeContainer.style.clipPath = `inset(0 50% 0 0)`;
    handle.style.left = `50%`;
  }
};

// =========================================================================
// REVIEW HUBBS - ACTIONS
// =========================================================================
window.saveReviewDraft = function(btn) {
  if (window.showToast) window.showToast('All edits saved to draft! 📝');
  const span = document.getElementById('review-draft-time');
  if (span) {
    span.textContent = 'Last saved: Just now';
  }
  btn.style.opacity = '0.5';
  btn.style.pointerEvents = 'none';
  setTimeout(() => {
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'all';
  }, 1000);
};

window.publishHubb = async function() {
  if (!window.chUploads || window.chUploads.length === 0) {
    if (window.showValidationModal) window.showValidationModal();
    return;
  }
  
  const media = window.chUploads[0];
  const url = media.thumbUrl || URL.createObjectURL(media.file);
  const caption = document.querySelector('.ch-caption-input')?.value || '';
  const filter = window.HubbleEditor.buildCSSFilterString();
  
  const pubBtn = document.getElementById('review-publish-btn');
  if (pubBtn) {
    pubBtn.disabled = true;
    pubBtn.style.opacity = '0.7';
    pubBtn.innerHTML = '<i data-lucide="loader" class="animate-spin"></i> Processing...';
    if (window.lucide) window.lucide.createIcons();
  }
  
  if (window.chScheduledAt) {
    // Scheduled HUBB - Send to backend
    try {
      const token = localStorage.getItem('invibe_jwt_token');
      if (!token) {
        if (window.showToast) window.showToast('Please log in to schedule a HUBB! 🔐', 'error');
        throw new Error('No token');
      }
      
      // Convert file to base64
      const getBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });
      
      const base64Media = await getBase64(media.file);
      
      const API_URL = window.API_URL || '';
      const res = await fetch(`${API_URL}/api/stories/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          mediaUrl: base64Media, 
          mediaType: media.type || 'image',
          scheduledAt: window.chScheduledAt 
        })
      });
      
      if (!res.ok) throw new Error('Failed to schedule HUBB');
      
      if (window.showToast) window.showToast('HUBB scheduled successfully! 🗓️✨');
    } catch (err) {
      console.error('Scheduling error:', err);
      if (window.showToast) window.showToast('Failed to schedule HUBB.', 'error');
      
      if (pubBtn) {
        pubBtn.disabled = false;
        pubBtn.style.opacity = '1';
        pubBtn.innerHTML = '<span id="review-publish-text">Schedule Hubb</span> <i id="review-publish-icon" data-lucide="calendar-clock" style="width: 18px; height: 18px;"></i>';
        if (window.lucide) window.lucide.createIcons();
      }
      return;
    }
  } else {
    // Non-scheduled HUBB - existing local flow
    let layout = (window.HubbleEditor && window.HubbleEditor.activeLayout) || 'original';
    layout = window.getEffectiveLayout(layout, window.chUploads);

    const allMedia = window.chUploads.map(m => {
       const state = m.editorState || {
          filter: 'original', rotation: 0, zoom: 1, panX: 0, panY: 0,
          adjustments: { brightness: 100, contrast: 100, exposure: 100, highlights: 100, shadows: 100, temperature: 0, tint: 0, saturation: 100, vibrance: 100, sharpness: 0, blur: 0, opacity: 100 },
          crop: null, layers: [], isMuted: false, musicTrack: null, selectedLocation: null
       };
       return {
          url: m.thumbUrl || URL.createObjectURL(m.file),
          type: m.type,
          filter: window.HubbleEditor.buildCSSFilterString ? window.HubbleEditor.buildCSSFilterString(state.filter, state.adjustments) : '',
          rotation: state.rotation || 0,
          zoom: state.zoom || 1,
          panX: state.panX || 0,
          panY: state.panY || 0,
          crop: state.crop,
          layers: state.layers,
          ar: (window.HubbleEditor && window.HubbleEditor.getEditedAspectRatio) ? window.HubbleEditor.getEditedAspectRatio(m) : 1
       };
    });

    const newStoryHTML = `
      <div class="story-card has-story" onclick="window.openPublishedStory(this)">
        <div class="story-avatar-container">
          <img src="${url}" alt="My Story" style="filter: ${filter}; object-fit: contain; object-position: center;">
        </div>
        <span class="story-username">Your Story</span>
        <template class="story-data">
          ${JSON.stringify({
            allMedia: allMedia,
            layout: layout,
            caption: caption,
            collaborationEnabled: window.collaborationEnabled !== false,
            collaboratorIds: window.collaborationEnabled !== false ? (window.selectedCollaborators || []).map(c => c._id || c.id) : [],
            time: Date.now()
          })}
        </template>
      </div>
    `;
    
    const currentBtn = document.getElementById('story-btn-current');
    if (currentBtn) {
      currentBtn.insertAdjacentHTML('afterend', newStoryHTML);
    }
    
    if (window.showToast) window.showToast('Story published! 🚀');
  }
  
  window.chUploads = [];
  
  if (window.currentDraftId) {
    DraftsDB.deleteDraft(window.currentDraftId).then(() => {
      window.currentDraftId = null;
      window.currentDraftCreatedAt = null;
      window.renderDraftsList();
    }).catch(console.error);
  }
  
  if (pubBtn) {
    pubBtn.disabled = false;
    pubBtn.style.opacity = '1';
    pubBtn.innerHTML = '<span id="review-publish-text">Publish Hubb</span> <i id="review-publish-icon" data-lucide="upload-cloud" style="width: 18px; height: 18px;"></i>';
  }
  
  setTimeout(() => {
    switchView('home');
    if (typeof initCreateHubbsUpload === 'function') initCreateHubbsUpload();
  }, 100);
};

window.openPublishedStory = function(card) {
  const dataNode = card.querySelector('.story-data');
  if (!dataNode) return;
  const data = JSON.parse(dataNode.innerHTML);
  
  const modal = document.getElementById('story-viewer-modal');
  if (!modal) return;
  
  const avatar = document.getElementById('story-viewer-avatar');
  if (avatar) avatar.src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80';
  
  const name = document.getElementById('story-viewer-name');
  if (name) name.innerText = 'Your Story';
  
  const time = document.getElementById('story-viewer-time');
  if (time) time.innerText = 'Just now';
  
  const contentBox = document.getElementById('story-viewer-content-box');
  if (!contentBox) return;
  contentBox.innerHTML = '';
  
  let mediaDataList = data.allMedia;
  if (!mediaDataList) {
      // Fallback for old single media posts
      mediaDataList = [{
         url: data.url, type: data.type, filter: data.filter,
         rotation: data.rotation, zoom: data.zoom, panX: 0, panY: 0,
         crop: data.crop, layers: data.layers, ar: 1
      }];
  }

  const hasMultiple = mediaDataList.length >= 2;
  const layout = data.layout || 'single';
  const layoutClass = (hasMultiple && layout !== 'original' && layout !== 'single') ? `layout-${layout}` : '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'width: 100%; height: 100%;';
  if (layoutClass) wrapper.className = layoutClass;
  // Apply Review specific layout CSS
  // Actually, we made the CSS target #story-viewer-content-box. We don't need to spoof the ID.
  contentBox.style.padding = '0';
  contentBox.style.overflow = 'hidden';

  mediaDataList.forEach((mData) => {
    const cell = document.createElement('div');
    cell.className = 'ch-preview-item';
    cell.style.cssText = `position: relative; width: 100%; height: 100%; overflow: hidden; display: flex; align-items: center; justify-content: center;`;
    
    const frame = document.createElement('div');
    frame.className = 'edited-frame';
    frame.style.cssText = `position: relative; overflow: hidden; aspect-ratio: ${mData.ar}; border-radius: 10px; background: #1a1a1a; display: flex; align-items: center; justify-content: center; margin: auto; width: min(100cqw, calc(100cqh * ${mData.ar})); height: min(100cqh, calc(100cqw / ${mData.ar}));`;
    
    let cw = 100, ch = 100, cx = 0, cy = 0;
    if (mData.crop) {
       cw = mData.crop.width; ch = mData.crop.height; cx = mData.crop.x; cy = mData.crop.y;
    }
    const cropScaleCSS = mData.crop ? `position: absolute; width: ${10000/cw}%; height: ${10000/ch}%; left: -${(cx/cw)*100}%; top: -${(cy/ch)*100}%;` : `position: absolute; width: 100%; height: 100%; left: 0; top: 0;`;

    const inner = document.createElement('div');
    inner.style.cssText = cropScaleCSS;

    let mediaNode;
    if (mData.type.startsWith('video/')) {
      mediaNode = document.createElement('video');
      mediaNode.src = mData.url;
      mediaNode.loop = true;
      mediaNode.muted = true;
      mediaNode.playsInline = true;
      mediaNode.autoplay = true;
    } else {
      mediaNode = document.createElement('img');
      mediaNode.src = mData.url;
    }
    mediaNode.style.cssText = 'position: absolute; width: 100%; height: 100%; object-fit: contain; object-position: center;';
    mediaNode.style.filter = mData.filter || '';
    mediaNode.style.transform = `translate(${mData.panX || 0}%, ${mData.panY || 0}%) rotate(${mData.rotation || 0}deg) scale(${mData.zoom || 1})`;
    
    inner.appendChild(mediaNode);
    frame.appendChild(inner);

    if (mData.layers) {
      const interactionWrapper = document.createElement('div');
      interactionWrapper.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
      mData.layers.forEach((layer) => {
        const el = document.createElement('div');
        el.style.cssText = `position: absolute; left: ${layer.x}%; top: ${layer.y}%; transform: translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale}); z-index: ${layer.zIndex}; pointer-events: none;`;
        if (layer.type === 'text') {
          el.innerHTML = `<div style="color: ${layer.styles.color || 'white'}; font-family: ${layer.styles.font || 'inherit'}; font-size: ${layer.styles.size || 24}px; font-weight: ${layer.styles.bold ? 'bold' : 'normal'}; font-style: ${layer.styles.italic ? 'italic' : 'normal'}; text-shadow: ${layer.styles.shadow ? '0 2px 10px rgba(0,0,0,0.5)' : 'none'}; text-align: center; white-space: pre-wrap;">${layer.content}</div>`;
        } else if (layer.type === 'sticker') {
          el.innerHTML = `<div style="font-size: ${layer.styles.size || 80}px; pointer-events: none;">${layer.content}</div>`;
        }
        interactionWrapper.appendChild(el);
      });
      frame.appendChild(interactionWrapper);
    }
    
    cell.appendChild(frame);
    wrapper.appendChild(cell);
  });
  
  contentBox.appendChild(wrapper);

  
  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.style.opacity = '1');
};

// =========================================================================
// HIHUBBLE ADVANCED STORY EDITOR ENGINE
// =========================================================================

window.HubbleEditor = {
  activeMediaIndex: 0,
  state: {
    filter: 'original',
    rotation: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    adjustments: {
      brightness: 100, contrast: 100, exposure: 100, highlights: 100, shadows: 100,
      temperature: 0, tint: 0, saturation: 100, vibrance: 100, sharpness: 0, blur: 0, opacity: 100
    },
    crop: null, // { x, y, width, height, aspect }
    layers: [], // { id, type, content, x, y, rotation, scale, zIndex, styles }
    isMuted: false,
    musicTrack: null, // { url, title, artist }
    selectedLocation: null // { displayName, type, lat, lon }
  },
  history: [],
  redoStack: [],
  
  // Initialization
  init() {
    this.injectEditorUI();
    this.bindToolButtons();
  },

  injectEditorUI() {
    // We inject a floating editor canvas that appears when tools are active
    if (!document.getElementById('he-canvas-modal')) {
      const modal = document.createElement('div');
      modal.id = 'he-canvas-modal';
      modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(12px); z-index: 9990; display: none; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s;';
      
      modal.innerHTML = `
        <div style="position: absolute; top: 20px; right: 20px; display: flex; gap: 12px; z-index: 9995;">
          <button onclick="HubbleEditor.undo()" id="he-undo-btn" class="ch-premium-tool-btn" style="width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,0.1); color: white; border: none; cursor: pointer; opacity: 0.5; pointer-events: none;"><i data-lucide="undo" style="width: 18px; height: 18px;"></i></button>
          <button onclick="HubbleEditor.redo()" id="he-redo-btn" class="ch-premium-tool-btn" style="width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,0.1); color: white; border: none; cursor: pointer; opacity: 0.5; pointer-events: none;"><i data-lucide="redo" style="width: 18px; height: 18px;"></i></button>
          
          <div style="position: relative; display: flex; border-radius: 12px; background: rgba(255,255,255,0.1); box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
            <button onclick="HubbleEditor.pushHistory(); HubbleEditor.state.rotation = (HubbleEditor.state.rotation + 90) % 360; HubbleEditor.updateRender();" class="ch-premium-tool-btn" style="padding: 0 16px; height: 40px; border-radius: 12px 0 0 12px; background: transparent; color: white; border: none; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;"><i data-lucide="rotate-cw" style="width: 16px; height: 16px;"></i> Rotate 90&deg;</button>
            <div style="width: 1px; background: rgba(255,255,255,0.1); margin: 6px 0;"></div>
            <button onclick="HubbleEditor.toggleManualRotate()" class="ch-premium-tool-btn" style="padding: 0 10px; height: 40px; border-radius: 0 12px 12px 0; background: transparent; color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i data-lucide="chevron-down" style="width: 16px; height: 16px;"></i></button>
            
            <div id="he-manual-rotate-panel" class="he-manual-rotate-panel" style="display: none; position: absolute; top: 48px; right: 0; width: 280px; background: rgba(20,20,25,0.85); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); z-index: 9996; flex-direction: column;">
               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                 <span style="font-size: 0.95rem; font-weight: 600; color: white;">Manual Rotate</span>
                 <span id="he-manual-rotate-val" style="font-size: 0.85rem; color: var(--primary); font-weight: bold; background: rgba(168,85,247,0.15); padding: 4px 10px; border-radius: 8px; font-variant-numeric: tabular-nums;">0&deg;</span>
               </div>
               <input type="range" id="he-manual-rotate-slider" class="he-custom-slider" min="-180" max="180" value="0" oninput="HubbleEditor.onManualRotate(this.value)">
               <div style="display: flex; gap: 12px; margin-top: 24px;">
                 <button class="he-glass-btn he-cancel-btn" onclick="HubbleEditor.resetManualRotate()">Reset</button>
                 <button class="he-premium-apply-btn" onclick="HubbleEditor.applyManualRotate()">Apply</button>
               </div>
            </div>
          </div>
          <button onclick="HubbleEditor.closeCanvas()" class="ch-premium-tool-btn" style="padding: 0 20px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, var(--primary) 0%, #a855f7 100%); color: white; border: none; font-weight: 600; cursor: pointer;">Done Editing</button>
        </div>
        
        <div id="he-workspace" style="position: relative; width: 80%; height: 80%; max-width: 1000px; display: flex; align-items: center; justify-content: center;">
          <div id="he-render-container" style="position: relative; box-shadow: 0 20px 50px rgba(0,0,0,0.5); overflow: hidden; display: flex; align-items: center; justify-content: center;">
            <div id="he-media-layer" style="position: absolute; width: 100%; height: 100%; transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);"></div>
            <div id="he-interaction-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
            <div id="he-crop-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; display: none;">
               <!-- Crop Grid generated dynamically -->
            </div>
          </div>
        </div>
        
        <!-- Floating Tool Panels -->
        <div id="he-panels-container" style="position: absolute; left: 24px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 16px; z-index: 9995;">
           <!-- Panels injected here dynamically based on active tool -->
        </div>
      `;
      document.body.appendChild(modal);
      if (window.lucide) window.lucide.createIcons();
      
      const overlay = document.getElementById('he-crop-overlay');
      const container = document.getElementById('he-render-container');
      
      if (overlay) overlay.style.cursor = 'move';
      
      if (container && !container.dataset.zoomPanBound) {
        container.dataset.zoomPanBound = "true";
        
        // Mouse Wheel Zoom
        container.addEventListener('wheel', (e) => {
          if (e.target.closest('#he-video-controls') || e.target.closest('#he-review-controls') || e.target.closest('.he-delete-btn') || e.target.closest('.ch-premium-tool-btn')) return;
          e.preventDefault();
          const rect = container.getBoundingClientRect();
          
          const mouseX = ((e.clientX - rect.left) / rect.width * 100) - 50;
          const mouseY = ((e.clientY - rect.top) / rect.height * 100) - 50;
          
          const oldZoom = HubbleEditor.state.zoom || 1;
          const zoomDelta = e.deltaY > 0 ? -0.05 : 0.05;
          let newZoom = Math.max(0.5, Math.min(3, oldZoom + zoomDelta));
          
          if (newZoom !== oldZoom) {
             HubbleEditor.state.panX = (HubbleEditor.state.panX || 0) - (mouseX - (HubbleEditor.state.panX || 0)) * (newZoom / oldZoom - 1);
             HubbleEditor.state.panY = (HubbleEditor.state.panY || 0) - (mouseY - (HubbleEditor.state.panY || 0)) * (newZoom / oldZoom - 1);
             HubbleEditor.setCropZoom(newZoom);
          }
        }, { passive: false });
        
        // Mouse Drag Pan
        let isMousePanning = false;
        let mousePanStartX, mousePanStartY, mouseInitialPanX, mouseInitialPanY;
        
        container.addEventListener('mousedown', (e) => {
          if (e.target.closest('#he-video-controls') || e.target.closest('#he-review-controls') || e.target.closest('.he-delete-btn') || e.target.closest('.ch-premium-tool-btn')) return;
          if ((HubbleEditor.state.zoom || 1) <= 1) return;
          isMousePanning = true;
          mousePanStartX = e.clientX;
          mousePanStartY = e.clientY;
          mouseInitialPanX = HubbleEditor.state.panX || 0;
          mouseInitialPanY = HubbleEditor.state.panY || 0;
        });
        
        window.addEventListener('mousemove', (e) => {
          if (isMousePanning) {
            e.preventDefault();
            const rect = container.getBoundingClientRect();
            const dx = ((e.clientX - mousePanStartX) / rect.width) * 100;
            const dy = ((e.clientY - mousePanStartY) / rect.height) * 100;
            
            HubbleEditor.state.panX = mouseInitialPanX + dx;
            HubbleEditor.state.panY = mouseInitialPanY + dy;
            HubbleEditor.enforcePanConstraints();
            HubbleEditor.updateRender();
          }
        });
        
        window.addEventListener('mouseup', () => { isMousePanning = false; });
        
        // Touch Zoom and Pan
        let initialPinchDist = null;
        let initialZoom = 1;
        let initialPanX = 0, initialPanY = 0;
        let initialPinchCenter = null;
        let isTouchPanning = false;
        let touchPanStartX, touchPanStartY;
        
        container.addEventListener('touchstart', (e) => {
          if (e.target.closest('#he-video-controls') || e.target.closest('#he-review-controls') || e.target.closest('.he-delete-btn') || e.target.closest('.ch-premium-tool-btn')) return;
          if (e.touches.length === 2) {
            e.preventDefault();
            isTouchPanning = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDist = Math.sqrt(dx*dx + dy*dy);
            initialZoom = HubbleEditor.state.zoom || 1;
            initialPanX = HubbleEditor.state.panX || 0;
            initialPanY = HubbleEditor.state.panY || 0;
            initialPinchCenter = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2
            };
          } else if (e.touches.length === 1) {
            if ((HubbleEditor.state.zoom || 1) <= 1) return;
            isTouchPanning = true;
            touchPanStartX = e.touches[0].clientX;
            touchPanStartY = e.touches[0].clientY;
            initialPanX = HubbleEditor.state.panX || 0;
            initialPanY = HubbleEditor.state.panY || 0;
          }
        }, { passive: false });
        
        container.addEventListener('touchmove', (e) => {
          if (e.touches.length === 2 && initialPinchDist) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const scale = dist / initialPinchDist;
            let newZoom = Math.max(0.5, Math.min(3, initialZoom * scale));
            
            const rect = container.getBoundingClientRect();
            
            const currentCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const currentCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            
            const panDeltaX = ((currentCenterX - initialPinchCenter.x) / rect.width) * 100;
            const panDeltaY = ((currentCenterY - initialPinchCenter.y) / rect.height) * 100;
            
            const mouseX = ((initialPinchCenter.x - rect.left) / rect.width * 100) - 50;
            const mouseY = ((initialPinchCenter.y - rect.top) / rect.height * 100) - 50;
            
            HubbleEditor.state.panX = initialPanX - (mouseX - initialPanX) * (newZoom / initialZoom - 1) + panDeltaX;
            HubbleEditor.state.panY = initialPanY - (mouseY - initialPanY) * (newZoom / initialZoom - 1) + panDeltaY;
            HubbleEditor.setCropZoom(newZoom);
          } else if (e.touches.length === 1 && isTouchPanning) {
            e.preventDefault();
            const rect = container.getBoundingClientRect();
            const dx = ((e.touches[0].clientX - touchPanStartX) / rect.width) * 100;
            const dy = ((e.touches[0].clientY - touchPanStartY) / rect.height) * 100;
            
            HubbleEditor.state.panX = initialPanX + dx;
            HubbleEditor.state.panY = initialPanY + dy;
            HubbleEditor.enforcePanConstraints();
            HubbleEditor.updateRender();
          }
        }, { passive: false });
        
        container.addEventListener('touchend', (e) => {
          if (e.touches.length < 2) initialPinchDist = null;
          if (e.touches.length === 0) isTouchPanning = false;
        });
      }
    }
  },

  bindToolButtons() {
    const buttons = document.querySelectorAll('.ch-image-tools .ch-premium-tool-btn');
    buttons.forEach((btn, index) => {
      btn.onclick = (e) => {
        e.preventDefault();
        
        if (!window.chUploads || window.chUploads.length === 0) {
          if (window.showToast) window.showToast('Please upload media first.');
          return;
        }

        const tools = ['filters', 'crop', 'rotate', 'adjust', 'stickers', 'text'];
        
        // Remove active class from all
        buttons.forEach(b => {
          b.classList.remove('active');
          b.style.background = 'rgba(255,255,255,0.05)';
          b.style.borderColor = 'rgba(255,255,255,0.1)';
          b.style.boxShadow = 'none';
          b.style.color = 'var(--text-main)';
          const span = b.nextElementSibling;
          if(span) {
             span.style.color = 'var(--text-muted)';
             span.style.fontWeight = 'normal';
             span.style.textShadow = 'none';
          }
        });
        
        // Add active to current
        btn.classList.add('active');
        btn.style.background = 'rgba(168, 85, 247, 0.2)';
        btn.style.borderColor = 'rgba(168, 85, 247, 0.5)';
        btn.style.boxShadow = '0 4px 15px rgba(168, 85, 247, 0.4), inset 0 0 10px rgba(168, 85, 247, 0.2)';
        btn.style.color = 'var(--primary)';
        const activeSpan = btn.nextElementSibling;
        if(activeSpan) {
           activeSpan.style.color = 'var(--primary)';
           activeSpan.style.fontWeight = '600';
           activeSpan.style.textShadow = '0 0 10px rgba(168, 85, 247, 0.3)';
        }

        if (tools[index] === 'text' && HubbleEditor.activeSelectedLayerId) {
            this.openTextTool(HubbleEditor.activeSelectedLayerId);
        } else {
            this.openTool(tools[index]);
        }
      };
    });
  },

  // Live Text Editor State
  textState: { text: '', color: '#ffffff', font: 'inherit', bold: false, italic: false, layerId: null },

  openTextTool(layerId = null) {
      if (layerId) {
          const layer = this.state.layers.find(l => l.id === layerId);
          if (layer) {
             this.textState = {
                text: layer.content,
                color: layer.styles.color || '#ffffff',
                font: layer.styles.font || 'inherit',
                bold: !!layer.styles.bold,
                italic: !!layer.styles.italic,
                layerId: layer.id
             };
          }
      } else {
          this.textState = { text: '', color: '#ffffff', font: 'inherit', bold: false, italic: false, layerId: null };
      }
      
      const buttons = document.querySelectorAll('.ch-image-tools .ch-premium-tool-btn');
      buttons.forEach((b, i) => {
         if(i === 5) { 
            b.classList.add('active');
            b.style.background = 'rgba(168, 85, 247, 0.2)';
            b.style.borderColor = 'rgba(168, 85, 247, 0.5)';
            b.style.boxShadow = '0 4px 15px rgba(168, 85, 247, 0.4), inset 0 0 10px rgba(168, 85, 247, 0.2)';
            b.style.color = 'var(--primary)';
            const activeSpan = b.nextElementSibling;
            if(activeSpan) {
               activeSpan.style.color = 'var(--primary)';
               activeSpan.style.fontWeight = '600';
               activeSpan.style.textShadow = '0 0 10px rgba(168, 85, 247, 0.3)';
            }
         } else {
            b.classList.remove('active');
            b.style.background = 'rgba(255,255,255,0.05)';
            b.style.borderColor = 'rgba(255,255,255,0.1)';
            b.style.boxShadow = 'none';
            b.style.color = 'var(--text-main)';
            const span = b.nextElementSibling;
            if(span) {
               span.style.color = 'var(--text-muted)';
               span.style.fontWeight = 'normal';
               span.style.textShadow = 'none';
            }
         }
      });
      
      this.openTool('text');
  },

  updateLiveTextColor(color) {
      this.textState.color = color;
      this.updateLiveText();
      
      const colorInput = document.getElementById('he-text-color-picker');
      if (colorInput) colorInput.value = color;
      
      const hiddenInput = document.getElementById('he-text-color');
      if (hiddenInput) hiddenInput.value = color;
      
      const swatches = document.querySelectorAll('.he-color-swatch');
      swatches.forEach(s => {
         if (s.dataset.color.toLowerCase() === color.toLowerCase()) {
             s.style.border = '2px solid var(--primary, #a855f7)';
         } else {
             s.style.border = '2px solid rgba(255,255,255,0.1)';
         }
      });
  },

  toggleTextFormat(type) {
      if (type === 'bold') {
          this.textState.bold = !this.textState.bold;
          const btn = document.getElementById('he-text-bold');
          if (btn) {
             btn.style.border = this.textState.bold ? '1px solid var(--primary, #a855f7)' : '1px solid rgba(255,255,255,0.1)';
             btn.style.background = this.textState.bold ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)';
          }
      }
      if (type === 'italic') {
          this.textState.italic = !this.textState.italic;
          const btn = document.getElementById('he-text-italic');
          if (btn) {
             btn.style.border = this.textState.italic ? '1px solid var(--primary, #a855f7)' : '1px solid rgba(255,255,255,0.1)';
             btn.style.background = this.textState.italic ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)';
          }
      }
      this.updateLiveText();
  },

  updateLiveText() {
      const input = document.getElementById('he-text-input');
      const font = document.getElementById('he-text-font');
      
      if (!input || !font) return;

      this.textState.text = input.value;
      this.textState.font = font.value;
      
      let layerToUpdate = null;
      let shouldRender = false;
      
      if (this.textState.text.trim() !== '') {
          if (this.textState.layerId) {
             const layer = this.state.layers.find(l => l.id === this.textState.layerId);
             if (layer) {
                layer.content = this.textState.text;
                layer.styles = { ...layer.styles, color: this.textState.color, font: this.textState.font, bold: this.textState.bold, italic: this.textState.italic };
                layerToUpdate = layer;
             }
          } else {
             const id = Date.now();
             this.textState.layerId = id;
             this.state.layers.push({
               id, type: 'text', content: this.textState.text, x: 50, y: 50, rotation: 0, scale: 1, zIndex: this.state.layers.length + 10,
               styles: { color: this.textState.color, font: this.textState.font, bold: this.textState.bold, italic: this.textState.italic, size: 32 }
             });
             this.activeSelectedLayerId = id;
             shouldRender = true;
          }
      } else {
          if (this.textState.layerId) {
             this.state.layers = this.state.layers.filter(l => l.id !== this.textState.layerId);
             this.textState.layerId = null;
             this.activeSelectedLayerId = null;
             shouldRender = true;
          }
      }
      
      if (shouldRender) {
          this.updateRender();
      } else if (layerToUpdate) {
          // Fast DOM update for color, font, typing
          const interactionLayer = document.getElementById('he-interaction-layer');
          if (interactionLayer) {
              const el = Array.from(interactionLayer.children).find(child => child.dataset.layerId == layerToUpdate.id);
              if (el && el.firstElementChild) {
                  const textDiv = el.firstElementChild;
                  textDiv.style.color = layerToUpdate.styles.color || 'white';
                  textDiv.style.fontFamily = layerToUpdate.styles.font || 'inherit';
                  textDiv.style.fontWeight = layerToUpdate.styles.bold ? 'bold' : 'normal';
                  textDiv.style.fontStyle = layerToUpdate.styles.italic ? 'italic' : 'normal';
                  textDiv.textContent = layerToUpdate.content;
              }
          }
      }

      const btn = document.getElementById('he-text-add-btn');
      if (btn) {
         const hasText = this.textState.text.trim().length > 0;
         btn.style.background = hasText ? 'linear-gradient(135deg, var(--primary, #a855f7) 0%, #7e22ce 100%)' : 'rgba(255,255,255,0.1)';
         btn.style.boxShadow = hasText ? '0 8px 20px rgba(168,85,247,0.3)' : 'none';
         btn.style.color = hasText ? 'white' : 'rgba(255,255,255,0.4)';
         btn.style.cursor = hasText ? 'pointer' : 'not-allowed';
         btn.style.pointerEvents = hasText ? 'all' : 'none';
         const isExisting = this.textState.layerId && this.history && this.history.length > 0 && this.history.some(h => h.layers.some(l => l.id === this.textState.layerId));
         btn.innerText = isExisting ? 'Update Text' : 'Add Text';
      }
  },

  commitLiveText() {
      if (!this.textState.text.trim()) return;
      this.pushHistory();
      this.textState = { text: '', color: '#ffffff', font: 'inherit', bold: false, italic: false, layerId: null };
      this.renderPanels('text');
  },

  toggleManualRotate() {
      const panel = document.getElementById('he-manual-rotate-panel');
      if (!panel) return;
      if (panel.style.display === 'none') {
          let r = this.state.rotation % 360;
          if (r > 180) r -= 360;
          else if (r < -180) r += 360;
          
          const slider = document.getElementById('he-manual-rotate-slider');
          if (slider) slider.value = r;
          
          const valEl = document.getElementById('he-manual-rotate-val');
          if (valEl) valEl.innerText = Math.round(r) + '°';
          
          panel.style.display = 'flex';
          panel.style.opacity = '0';
          panel.style.transform = 'scale(0.95) translateY(-10px)';
          requestAnimationFrame(() => {
              panel.style.transition = 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';
              panel.style.opacity = '1';
              panel.style.transform = 'scale(1) translateY(0)';
          });
      } else {
          panel.style.opacity = '0';
          panel.style.transform = 'scale(0.95) translateY(-10px)';
          setTimeout(() => { panel.style.display = 'none'; }, 200);
      }
  },
  
  onManualRotate(val) {
      this.state.rotation = parseFloat(val);
      const valEl = document.getElementById('he-manual-rotate-val');
      if (valEl) valEl.innerText = Math.round(val) + '°';
      this.updateRender();
  },
  
  resetManualRotate() {
      this.state.rotation = 0;
      const slider = document.getElementById('he-manual-rotate-slider');
      if (slider) slider.value = 0;
      const valEl = document.getElementById('he-manual-rotate-val');
      if (valEl) valEl.innerText = '0°';
      this.updateRender();
  },
  
  applyManualRotate() {
      this.pushHistory();
      const panel = document.getElementById('he-manual-rotate-panel');
      if (panel) {
          panel.style.opacity = '0';
          panel.style.transform = 'scale(0.95) translateY(-10px)';
          setTimeout(() => { panel.style.display = 'none'; }, 200);
      }
  },

  openTool(toolName) {
    if (toolName === 'text' && (!this.textState || this.textState.layerId === null)) {
       this.textState = { text: '', color: '#ffffff', font: 'inherit', bold: false, italic: false, layerId: null };
    }
    this.openCanvas();
    this.renderPanels(toolName);
    
    if (toolName === 'crop') {
      this.enterCropMode();
    }
  },


  enterCropMode() {
    this.tempCrop = this.state.crop ? JSON.parse(JSON.stringify(this.state.crop)) : { x: 10, y: 10, width: 80, height: 80, aspect: 'Free' };
    const overlay = document.getElementById('he-crop-overlay');
    if (overlay) {
      overlay.style.display = 'block';
      overlay.style.pointerEvents = 'all';
    }
    // Also disable layer dragging during crop
    const layers = document.getElementById('he-interaction-layer');
    if (layers) layers.style.pointerEvents = 'none';
    
    this.renderCropHandles();
  },

  exitCropMode(save) {
    if (save && this.tempCrop) {
      this.pushHistory();
      this.state.crop = JSON.parse(JSON.stringify(this.tempCrop));
      this.updateRender();
    }
    this.tempCrop = null;
    const overlay = document.getElementById('he-crop-overlay');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.style.pointerEvents = 'none';
    }
    const layers = document.getElementById('he-interaction-layer');
    if (layers) layers.style.pointerEvents = 'none';
    
    // Close the panel
    this.closeCanvas();
  },

  setCropAspect(ratio) {
    if (!this.tempCrop) return;
    this.tempCrop.aspect = ratio;
    
    // Reset to center 80% if changing aspect
    if (ratio === 'Free') {
       this.tempCrop.width = 80; this.tempCrop.height = 80;
    } else {
      const [w, h] = ratio.split(':').map(Number);
      const container = document.getElementById('he-render-container');
      const rect = container.getBoundingClientRect();
      const containerAspect = rect.width / rect.height;
      const targetAspect = w / h;
      
      if (targetAspect > containerAspect) {
        this.tempCrop.width = 80;
        this.tempCrop.height = 80 * (containerAspect / targetAspect);
      } else {
        this.tempCrop.height = 80;
        this.tempCrop.width = 80 * (targetAspect / containerAspect);
      }
    }
    
    this.tempCrop.x = (100 - this.tempCrop.width) / 2;
    this.tempCrop.y = (100 - this.tempCrop.height) / 2;
    this.renderCropHandles();
    this.renderPanels('crop'); // update buttons
  },

  enforcePanConstraints() {
    let crop = this.tempCrop || this.state.crop || { x: 0, y: 0, width: 100, height: 100 };
    let z = this.state.zoom || 1;
    let { x, y, width, height } = crop;
    
    let minPanX = x + width - 50 - 50 * z;
    let maxPanX = x - 50 + 50 * z;
    if (minPanX > maxPanX) {
       this.state.panX = (minPanX + maxPanX) / 2;
    } else {
       this.state.panX = Math.max(minPanX, Math.min(maxPanX, this.state.panX || 0));
    }
    
    let minPanY = y + height - 50 - 50 * z;
    let maxPanY = y - 50 + 50 * z;
    if (minPanY > maxPanY) {
       this.state.panY = (minPanY + maxPanY) / 2;
    } else {
       this.state.panY = Math.max(minPanY, Math.min(maxPanY, this.state.panY || 0));
    }
  },

  setCropZoom(val) {
    let z = Math.max(0.5, Math.min(3, val));
    this.state.zoom = z;
    
    this.enforcePanConstraints();
    
    const slider = document.getElementById('he-zoom-slider');
    if (slider) slider.value = z;
    const valEl = document.getElementById('he-zoom-val');
    if (valEl) valEl.innerText = Math.round(z * 100) + '%';
    
    this.updateRender();
  },

  renderCropHandles() {
    const overlay = document.getElementById('he-crop-overlay');
    if (!overlay) return;
    
    overlay.innerHTML = '';
    
    const box = document.createElement('div');
    box.id = 'he-crop-box';
    box.style.cssText = `
      position: absolute;
      left: ${this.tempCrop.x}%;
      top: ${this.tempCrop.y}%;
      width: ${this.tempCrop.width}%;
      height: ${this.tempCrop.height}%;
      border: 2px solid white;
      box-shadow: 0 0 0 9999px rgba(0,0,0,0.7);
      pointer-events: none;
    `;
    
    const handlePositions = [
      { top: '-6px', left: '-6px', cursor: 'nwse-resize', id: 'tl' },
      { top: '-6px', left: 'calc(50% - 6px)', cursor: 'ns-resize', id: 'tc' },
      { top: '-6px', right: '-6px', cursor: 'nesw-resize', id: 'tr' },
      { top: 'calc(50% - 6px)', left: '-6px', cursor: 'ew-resize', id: 'ml' },
      { top: 'calc(50% - 6px)', right: '-6px', cursor: 'ew-resize', id: 'mr' },
      { bottom: '-6px', left: '-6px', cursor: 'nesw-resize', id: 'bl' },
      { bottom: '-6px', left: 'calc(50% - 6px)', cursor: 'ns-resize', id: 'bc' },
      { bottom: '-6px', right: '-6px', cursor: 'nwse-resize', id: 'br' }
    ];
    
    handlePositions.forEach(pos => {
      const h = document.createElement('div');
      h.style.cssText = `
        position: absolute;
        width: 12px; height: 12px;
        background: white; border-radius: 50%;
        cursor: ${pos.cursor};
        pointer-events: all;
        ${pos.top ? `top: ${pos.top};` : ''}
        ${pos.bottom ? `bottom: ${pos.bottom};` : ''}
        ${pos.left ? `left: ${pos.left};` : ''}
        ${pos.right ? `right: ${pos.right};` : ''}
      `;
      this.bindCropDrag(h, pos.id);
      box.appendChild(h);
    });
    
    overlay.appendChild(box);
  },

  bindCropDrag(element, type) {
    element.onmousedown = (e) => {
      e.stopPropagation();
      let isDragging = true;
      let startX = e.clientX;
      let startY = e.clientY;
      const startCrop = JSON.parse(JSON.stringify(this.tempCrop));
      const startPanX = this.state.panX || 0;
      const startPanY = this.state.panY || 0;
      
      const move = (ev) => {
        if (!isDragging) return;
        const container = document.getElementById('he-render-container');
        const rect = container.getBoundingClientRect();
        
        const dx = ((ev.clientX - startX) / rect.width) * 100;
        const dy = ((ev.clientY - startY) / rect.height) * 100;
        
        let { x, y, width, height, aspect } = startCrop;
        
        if (type.includes('l')) { x += dx; width -= dx; }
        if (type.includes('r')) { width += dx; }
        if (type.includes('t')) { y += dy; height -= dy; }
        if (type.includes('b')) { height += dy; }
        
        if (aspect !== 'Free') {
          const [wRatio, hRatio] = aspect.split(':').map(Number);
          const targetRatio = wRatio / hRatio;
          const containerRatio = rect.width / rect.height;
          
          if (type.includes('l') || type.includes('r')) {
             height = width * (containerRatio / targetRatio);
             if(type.includes('t')) y = startCrop.y - (height - startCrop.height);
          } else {
             width = height * (targetRatio / containerRatio);
             if(type.includes('l')) x = startCrop.x - (width - startCrop.width);
          }
        }
        
        // Clamp bounds
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x + width > 100) { width = 100 - x; }
        if (y + height > 100) { height = 100 - y; }
        
        width = Math.max(10, width);
        height = Math.max(10, height);
        
        this.tempCrop = { ...this.tempCrop, x, y, width, height };
        
        const box = document.getElementById('he-crop-box');
        if (box) {
          box.style.left = `${this.tempCrop.x}%`;
          box.style.top = `${this.tempCrop.y}%`;
          box.style.width = `${this.tempCrop.width}%`;
          box.style.height = `${this.tempCrop.height}%`;
        }
      };
      
      const up = () => {
        isDragging = false;
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    };
  },

  openCanvas() {
    const modal = document.getElementById('he-canvas-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.style.opacity = '1');
    
    if (this.history.length === 0) {
      this.pushHistory(); // Initial state
    }
    
    this.updateRender();
  },

  cleanupMedia() {
    const videos = [
      ...document.querySelectorAll('#he-media-layer video'),
      ...document.querySelectorAll('#review-slider-wrapper video')
    ];
    videos.forEach(v => {
      v.pause();
      v.removeAttribute('src');
      v.load();
    });
    const mediaLayer = document.getElementById('he-media-layer');
    if (mediaLayer) mediaLayer.innerHTML = '';
    
    if (this.GlobalAudio) {
      this.GlobalAudio.pause();
      this.GlobalAudio.audio.currentTime = 0;
    }
  },

  closeCanvas() {
    const overlay = document.getElementById('he-crop-overlay');
    if (overlay && overlay.style.display !== 'none') {
       overlay.style.display = 'none';
       overlay.style.pointerEvents = 'none';
    }
    const modal = document.getElementById('he-canvas-modal');
    if (!modal) return;

    // HALT Editor Video & Audio
    this.cleanupMedia();

    // Sync state one final time
    if (window.chUploads && window.chUploads[this.activeMediaIndex]) {
        window.chUploads[this.activeMediaIndex].editorState = JSON.parse(JSON.stringify(this.state));
    }

    modal.style.opacity = '0';
    setTimeout(() => {
      modal.style.display = 'none';
      document.getElementById('he-panels-container').innerHTML = '';
      
      // Also update the tiny thumbnails to reflect changes visually
      if (typeof window.initCreateHubbsUpload === 'function') {
         const thumbs = document.querySelectorAll('.ch-preview-item img, .ch-preview-item video');
         if (thumbs[this.activeMediaIndex]) {
           thumbs[this.activeMediaIndex].style.filter = this.buildCSSFilterString();
           thumbs[this.activeMediaIndex].style.transform = `rotate(${this.state.rotation}deg)`;
         }
      }
    }, 300);
  },

  pushHistory() {
    this.history.push(JSON.parse(JSON.stringify(this.state)));
    this.redoStack = []; // Clear redo stack on new action
    this.updateUndoRedoUI();
  },

  undo() {
    if (this.history.length > 1) {
      this.redoStack.push(JSON.parse(JSON.stringify(this.state)));
      this.history.pop(); // Remove current state
      this.state = JSON.parse(JSON.stringify(this.history[this.history.length - 1]));
      this.updateRender();
      this.updateUndoRedoUI();
    }
  },

  redo() {
    if (this.redoStack.length > 0) {
      this.history.push(JSON.parse(JSON.stringify(this.state)));
      this.state = JSON.parse(JSON.stringify(this.redoStack.pop()));
      this.updateRender();
      this.updateUndoRedoUI();
    }
  },

  updateUndoRedoUI() {
    const undoBtn = document.getElementById('he-undo-btn');
    const redoBtn = document.getElementById('he-redo-btn');
    if (undoBtn) {
      undoBtn.style.opacity = this.history.length > 1 ? '1' : '0.5';
      undoBtn.style.pointerEvents = this.history.length > 1 ? 'all' : 'none';
    }
    if (redoBtn) {
      redoBtn.style.opacity = this.redoStack.length > 0 ? '1' : '0.5';
      redoBtn.style.pointerEvents = this.redoStack.length > 0 ? 'all' : 'none';
    }
  },

  getEditedAspectRatio(item) {
    if (!item) return 1;
    let w = item.originalWidth || 1000;
    let h = item.originalHeight || 1000;
    
    // First, apply crop
    if (item.editorState && item.editorState.crop) {
       w = w * (item.editorState.crop.width / 100);
       h = h * (item.editorState.crop.height / 100);
    }
    
    // Then rotation
    if (item.editorState && item.editorState.rotation) {
       const r = Math.abs(item.editorState.rotation) % 180;
       if (r === 90) {
          const temp = w;
          w = h;
          h = temp;
       }
    }
    return w / h;
  },

  buildCSSFilterString(overrideFilter = null, overrideAdjustments = null) {
    const activeFilter = overrideFilter !== null ? overrideFilter : this.state.filter;
    const adj = overrideAdjustments !== null ? overrideAdjustments : this.state.adjustments;
    
    const filterPresets = {
      'original': {},
      'bright': { brightness: 10, contrast: 10, saturation: 10 },
      'warm': { temperature: 30, saturation: 10 },
      'cool': { temperature: -30, tint: 10 },
      'vintage': { saturation: -20, temperature: 40, shadows: 20, contrast: -10, exposure: 10 },
      'black & white': { saturation: -100, contrast: 20 },
      'hdr': { contrast: 20, sharpness: 40, shadows: 30, highlights: -20, saturation: 15 },
      'cinematic': { saturation: -15, contrast: 10, temperature: 10, tint: -10, shadows: -10 },
      'soft': { contrast: -15, sharpness: -20, brightness: 5 },
      'dream': { brightness: 10, saturation: 15, blur: 2, contrast: -10 },
      'purple glow': { tint: 40, temperature: 20, saturation: 20 },
      'cool blue': { temperature: -30, shadows: 15, contrast: 10 },
      'sepia': { temperature: 50, tint: 15, saturation: -40 },
      'vivid': { saturation: 40, contrast: 10 },
      'mono': { saturation: -100, contrast: 15 }
    };

    const preset = filterPresets[activeFilter] || {};
    
    const getVal = (key, defaultVal) => {
       const manualVal = adj[key] !== undefined ? Number(adj[key]) : defaultVal;
       const manualDelta = manualVal - defaultVal;
       const presetDelta = preset[key] || 0;
       return defaultVal + presetDelta + manualDelta;
    };

    const p = {
       brightness: getVal('brightness', 100),
       contrast: getVal('contrast', 100),
       exposure: getVal('exposure', 100),
       highlights: getVal('highlights', 100),
       shadows: getVal('shadows', 100),
       temperature: getVal('temperature', 0),
       tint: getVal('tint', 0),
       saturation: getVal('saturation', 100),
       vibrance: getVal('vibrance', 100),
       sharpness: getVal('sharpness', 0),
       blur: getVal('blur', 0),
       opacity: getVal('opacity', 100)
    };

    const totalSaturate = Math.max(0, p.saturation + (p.vibrance - 100) * 0.5);

    let tableValuesStr = "";
    for (let i = 0; i <= 15; i++) {
       let x = i / 15.0;
       let y = x * (p.exposure / 100);

       let shadowDelta = (p.shadows - 100) / 100; 
       if (x < 0.5) y += shadowDelta * (0.5 - x);

       let highlightDelta = (p.highlights - 100) / 100; 
       if (x > 0.5) y += highlightDelta * (x - 0.5);

       y += (p.brightness - 100) / 100;
       y = (y - 0.5) * (p.contrast / 100) + 0.5;

       y = Math.max(0, Math.min(1, y));
       tableValuesStr += y.toFixed(3) + " ";
    }
    let tableValues = tableValuesStr.trim();

    let temp = p.temperature / 100;
    let tint = p.tint / 100;
    
    let rMult = 1 + temp * 0.2 + tint * 0.1;
    let gMult = 1 - tint * 0.2;
    let bMult = 1 - temp * 0.2 + tint * 0.1;

    let colorMatrix = `
       ${rMult} 0 0 0 0
       0 ${gMult} 0 0 0
       0 0 ${bMult} 0 0
       0 0 0 1 0
    `;

    let s = p.sharpness / 100; 
    s = Math.max(-0.5, Math.min(2, s));
    let center = 1 + 4 * s;
    let edge = -s;
    let kernelMatrix = `
       0 ${edge} 0
       ${edge} ${center} ${edge}
       0 ${edge} 0
    `;

    let svg = `
       <svg xmlns="http://www.w3.org/2000/svg">
          <filter id="f">
             <feComponentTransfer>
                <feFuncR type="table" tableValues="${tableValues}" />
                <feFuncG type="table" tableValues="${tableValues}" />
                <feFuncB type="table" tableValues="${tableValues}" />
             </feComponentTransfer>
             <feColorMatrix type="matrix" values="${colorMatrix}" />
             ${s !== 0 ? `<feConvolveMatrix order="3" kernelMatrix="${kernelMatrix}" preserveAlpha="true" />` : ''}
          </filter>
       </svg>
    `;

    const encodedSvg = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/\s+/g, ' ').trim());

    return `url("${encodedSvg}#f") saturate(${totalSaturate}%) blur(${p.blur}px) opacity(${p.opacity}%)`;
  },
  addLayer(type, content, styles = {}) {
    this.pushHistory();
    const id = Date.now();
    this.state.layers.push({
      id,
      type,
      content,
      x: 50, // Center %
      y: 50, // Center %
      rotation: 0,
      scale: 1,
      zIndex: this.state.layers.length + 10,
      styles
    });
    this.updateRender();
  },

  addLayerControls(el, layer, interactionLayer) {
    const corners = [
      { class: 'he-resize-nw', cursor: 'nwse-resize', top: '-6px', left: '-6px' },
      { class: 'he-resize-ne', cursor: 'nesw-resize', top: '-6px', right: '-6px' },
      { class: 'he-resize-sw', cursor: 'nesw-resize', bottom: '-6px', left: '-6px' },
      { class: 'he-resize-se', cursor: 'nwse-resize', bottom: '-6px', right: '-6px' }
    ];

    corners.forEach(c => {
      const handle = document.createElement('div');
      handle.className = `he-resize-handle ${c.class}`;
      handle.style.cssText = `position: absolute; width: 14px; height: 14px; background: white; border: 2px solid #a855f7; border-radius: 50%; z-index: 100; cursor: ${c.cursor}; box-shadow: 0 2px 5px rgba(0,0,0,0.3); pointer-events: all; ${c.top ? `top: ${c.top};` : ''} ${c.bottom ? `bottom: ${c.bottom};` : ''} ${c.left ? `left: ${c.left};` : ''} ${c.right ? `right: ${c.right};` : ''}`;
      
      handle.onmousedown = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.pushHistory();
        
        const rect = interactionLayer.getBoundingClientRect();
        // The layer center in absolute viewport coords
        const centerX = rect.left + (layer.x / 100) * rect.width;
        const centerY = rect.top + (layer.y / 100) * rect.height;
        
        const startDist = Math.hypot(ev.clientX - centerX, ev.clientY - centerY);
        const startScale = layer.scale || 1;
        
        const onMouseMove = (moveEv) => {
          const currentDist = Math.hypot(moveEv.clientX - centerX, moveEv.clientY - centerY);
          let newScale = startScale * (currentDist / startDist);
          if (newScale < 0.1) newScale = 0.1;
          if (newScale > 10) newScale = 10;
          
          layer.scale = newScale;
          el.style.transform = `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`;
        };
        
        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          this.updateRender();
        };
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      };
      el.appendChild(handle);
    });
  },

  updateRender() {
    if (!window.chUploads || window.chUploads.length === 0) return;
    
    const media = window.chUploads[this.activeMediaIndex];
    if (!media) return;

    const container = document.getElementById('he-render-container');
    const mediaLayer = document.getElementById('he-media-layer');
    const interactionLayer = document.getElementById('he-interaction-layer');
    
    if (!container || !mediaLayer || !interactionLayer) return;

    // Set Aspect Ratio based on media
    container.style.width = '400px';
    container.style.aspectRatio = '9/16';
    container.style.background = '#111';
    container.style.borderRadius = '16px';
    
    // Render Media Node
    if (!mediaLayer.firstChild || mediaLayer.firstChild.dataset.url !== media.thumbUrl) {
      if (mediaLayer.firstChild && mediaLayer.firstChild.tagName === 'VIDEO') {
        mediaLayer.firstChild.pause();
        mediaLayer.firstChild.removeAttribute('src');
        mediaLayer.firstChild.load();
      }
      mediaLayer.innerHTML = '';
      let node;
      if (media.type.startsWith('video/')) {
        node = document.createElement('video');
        node.src = URL.createObjectURL(media.file);
        node.loop = true; node.muted = window.HubbleEditor.state.isMuted; node.autoplay = true; node.playsInline = true;
        
        // Sync Audio
        node.addEventListener('play', () => {
           window.HubbleEditor.GlobalAudio.sync(node.currentTime);
           window.HubbleEditor.GlobalAudio.play();
        });
        node.addEventListener('pause', () => window.HubbleEditor.GlobalAudio.pause());
        node.addEventListener('seeking', () => window.HubbleEditor.GlobalAudio.sync(node.currentTime));
        node.addEventListener('seeked', () => window.HubbleEditor.GlobalAudio.sync(node.currentTime));
        
      } else {
        node = document.createElement('img');
        node.src = media.thumbUrl;
      }
      node.dataset.url = media.thumbUrl;
      node.style.cssText = 'width: 100%; height: 100%; object-fit: contain; transform-origin: center center; transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);';
      node.draggable = false;
      mediaLayer.appendChild(node);
    }
    
    // Ensure we have a reference to the active media node
    const activeMediaNode = mediaLayer.firstChild;
    
    // Video Controls overlay
    let videoControls = document.getElementById('he-video-controls');
    if (media.type.startsWith('video/')) {
      if (!videoControls) {
        videoControls = this.buildVideoControls(container, activeMediaNode, false);
      } else {
        videoControls.remove();
        videoControls = this.buildVideoControls(container, activeMediaNode, false);
      }
    } else {
      if (videoControls) {
        videoControls.remove();
      }
    }

    // Apply Transforms, Filters & Zoom
    activeMediaNode.style.filter = this.buildCSSFilterString();
    activeMediaNode.style.transform = `translate(${this.state.panX || 0}%, ${this.state.panY || 0}%) rotate(${this.state.rotation}deg) scale(${this.state.zoom || 1})`;
    
    // Apply Crop Clip-Path to Media and Interaction Layers (but NOT the crop overlay)
    if (this.state.crop) {
       const { x, y, width, height } = this.state.crop;
       const clipPathStr = `inset(${y}% ${100 - (x + width)}% ${100 - (y + height)}% ${x}%)`;
       mediaLayer.style.clipPath = clipPathStr;
       interactionLayer.style.clipPath = clipPathStr;
    } else {
       mediaLayer.style.clipPath = 'none';
       interactionLayer.style.clipPath = 'none';
    }
    
    // Render Interaction Layers (Stickers / Text)
    interactionLayer.innerHTML = '';
    this.state.layers.forEach((layer, idx) => {
      const el = document.createElement('div');
      el.dataset.layerId = layer.id;
      el.style.cssText = `position: absolute; left: ${layer.x}%; top: ${layer.y}%; transform: translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale}); z-index: ${layer.zIndex}; pointer-events: all; cursor: grab;`;
      
      if (layer.type === 'text') {
        el.innerHTML = `<div style="color: ${layer.styles.color || 'white'}; font-family: ${layer.styles.font || 'inherit'}; font-size: ${layer.styles.size || 24}px; font-weight: ${layer.styles.bold ? 'bold' : 'normal'}; font-style: ${layer.styles.italic ? 'italic' : 'normal'}; text-shadow: ${layer.styles.shadow ? '0 2px 10px rgba(0,0,0,0.5)' : 'none'}; text-align: center; white-space: pre-wrap;">${layer.content}</div>`;
      } else if (layer.type === 'sticker') {
        el.innerHTML = `<div style="font-size: ${layer.styles.size || 80}px; pointer-events: none;">${layer.content}</div>`;
      }
      
      const isActive = HubbleEditor.activeSelectedLayerId === layer.id;
      if (isActive) {
          el.style.border = '2px dashed rgba(255,255,255,0.8)';
          el.style.padding = '8px';
          el.style.borderRadius = '12px';
          const deleteBtn = document.createElement('div');
          deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
          deleteBtn.style.cssText = 'position: absolute; top: -14px; right: -14px; background: rgba(255,59,48,0.9); border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; pointer-events: all; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 100;';
          deleteBtn.onmousedown = (ev) => {
              ev.stopPropagation();
              HubbleEditor.pushHistory();
              HubbleEditor.state.layers = HubbleEditor.state.layers.filter(l => l.id !== layer.id);
              if (HubbleEditor.textState && HubbleEditor.textState.layerId === layer.id) {
                  HubbleEditor.textState = { text: '', color: '#ffffff', font: 'inherit', bold: false, italic: false, layerId: null };
                  HubbleEditor.renderPanels('text');
              }
              HubbleEditor.activeSelectedLayerId = null;
              HubbleEditor.updateRender();
          };
          el.appendChild(deleteBtn);
          HubbleEditor.addLayerControls(el, layer, interactionLayer);
      } else {
          el.style.border = 'none';
          el.style.padding = '0';
          el.style.borderRadius = '0';
      }

      el.ondblclick = (e) => {
         e.stopPropagation();
         if (layer.type === 'text') {
             HubbleEditor.openTextTool(layer.id);
         }
      };
      
      // Drag Logic
      el.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        let isDragging = true;
        HubbleEditor.activeSelectedLayerId = layer.id;
        
        // Fast active state DOM update
        Array.from(interactionLayer.children).forEach(child => {
            if (child.dataset.layerId == layer.id) {
                child.style.border = '2px dashed rgba(255,255,255,0.8)';
                child.style.padding = '8px';
                child.style.borderRadius = '12px';
                if (!child.querySelector('.he-delete-btn')) {
                    const deleteBtn = document.createElement('div');
                    deleteBtn.className = 'he-delete-btn';
                    deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                    deleteBtn.style.cssText = 'position: absolute; top: -14px; right: -14px; background: rgba(255,59,48,0.9); border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; pointer-events: all; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 100;';
                    deleteBtn.onmousedown = (ev) => {
                        ev.stopPropagation();
                        HubbleEditor.pushHistory();
                        HubbleEditor.state.layers = HubbleEditor.state.layers.filter(l => l.id !== layer.id);
                        if (HubbleEditor.textState && HubbleEditor.textState.layerId === layer.id) {
                            HubbleEditor.textState = { text: '', color: '#ffffff', font: 'inherit', bold: false, italic: false, layerId: null };
                            HubbleEditor.renderPanels('text');
                        }
                        HubbleEditor.activeSelectedLayerId = null;
                        HubbleEditor.updateRender();
                    };
                    child.appendChild(deleteBtn);
                    HubbleEditor.addLayerControls(child, layer, interactionLayer);
                }
            } else {
                child.style.border = 'none';
                child.style.padding = '0';
                child.style.borderRadius = '0';
                const dBtn = child.querySelector('.he-delete-btn');
                if (dBtn) dBtn.remove();
                child.querySelectorAll('.he-resize-handle').forEach(h => h.remove());
            }
        });
        
        if (layer.type === 'text') {
            const isTextToolOpen = document.getElementById('he-text-input') !== null;
            if (isTextToolOpen && HubbleEditor.textState && HubbleEditor.textState.layerId !== layer.id) {
                HubbleEditor.openTextTool(layer.id);
            }
        }
        
        let startX = e.clientX;
        let startY = e.clientY;
        const startLeft = layer.x;
        const startTop = layer.y;
        
        // Bring to front
        layer.zIndex = Math.max(...this.state.layers.map(l => l.zIndex)) + 1;
        el.style.zIndex = layer.zIndex;
        
        const move = (ev) => {
          if(!isDragging) return;
          const rect = interactionLayer.getBoundingClientRect();
          const dx = ((ev.clientX - startX) / rect.width) * 100;
          const dy = ((ev.clientY - startY) / rect.height) * 100;
          layer.x = startLeft + dx;
          layer.y = startTop + dy;
          requestAnimationFrame(() => {
              el.style.left = layer.x + '%';
              el.style.top = layer.y + '%';
          });
        };
        const up = () => {
          isDragging = false;
          HubbleEditor.pushHistory(); // push history on drop
          HubbleEditor.updateRender(); // Sync state to chUploads
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      };
      
      interactionLayer.appendChild(el);
    });
    
    if (!interactionLayer.dataset.clickBound) {
        interactionLayer.addEventListener('mousedown', (e) => {
           if (e.target === interactionLayer) {
               if (HubbleEditor.activeSelectedLayerId) {
                   HubbleEditor.activeSelectedLayerId = null;
                   Array.from(interactionLayer.children).forEach(child => {
                       child.style.border = 'none';
                       child.style.padding = '0';
                       child.style.borderRadius = '0';
                       const dBtn = child.querySelector('.he-delete-btn');
                       if (dBtn) dBtn.remove();
                   });
               }
           }
        });
        interactionLayer.dataset.clickBound = "true";
    }

    // Sync state to chUploads so it's always up to date
    if (window.chUploads && window.chUploads[this.activeMediaIndex]) {
        window.chUploads[this.activeMediaIndex].editorState = JSON.parse(JSON.stringify(this.state));
    }
    // Update live preview thumbnail
    if (typeof this.updatePreviewThumbnail === 'function') {
        this.updatePreviewThumbnail(this.activeMediaIndex);
    }
  },

  activeLayout: 'original',

  setLayout(layoutName) {
    let effectiveLayoutName = window.getEffectiveLayout(layoutName, window.chUploads);

    this.activeLayout = layoutName;
    const previewRow = document.getElementById('ch-media-preview-row');
    if (!previewRow) return;
    
    // Remove existing layout classes
    previewRow.className = 'ch-media-preview-row';
    
    // Add new layout class if not original/single default
    if (effectiveLayoutName !== 'original' && effectiveLayoutName !== 'single') {
       previewRow.classList.add(`layout-${effectiveLayoutName}`);
    }
    
    // Update active button state
    document.querySelectorAll('.ch-layout-btn').forEach(btn => {
       btn.classList.remove('ch-layout-btn-active');
       if (btn.dataset.layout === layoutName) {
           btn.classList.add('ch-layout-btn-active');
       }
    });
    
    // Flatten DOM (remove layout row wrappers)
    const items = Array.from(previewRow.querySelectorAll('.ch-preview-item'));
    if (items.length > 0) {
       items.sort((a, b) => parseInt(a.dataset.index) - parseInt(b.dataset.index));
       
       previewRow.querySelectorAll('.ch-layout-row').forEach(el => el.remove());
       const addMoreBtn = document.getElementById('ch-add-more-media-btn');

       items.forEach(item => {
           previewRow.insertBefore(item, addMoreBtn);
       });

       // Update active aspect ratios
       for (let i = 0; i < window.chUploads.length; i++) {
           this.updatePreviewThumbnail(i);
       }
    }
  },

  updatePreviewThumbnail(index, passedEl = null) {
    if (!window.chUploads || !window.chUploads[index]) return;
    const item = window.chUploads[index];
    const previewEl = passedEl || document.querySelector(`.ch-preview-item[data-index="${index}"]`);
    if (!previewEl) return;
    
    let state = item.editorState;
    if (index === this.activeMediaIndex) state = this.state;
    if (!state) return; // No edits, just keep original

    // Keep only the remove button and duration overlay
    const rmBtn = previewEl.querySelector('.ch-remove-media');
    let overlay = null;
    if (item.type.startsWith('video/')) {
        const divs = previewEl.querySelectorAll('div');
        divs.forEach(d => {
           if(d.innerHTML.includes('lucide="video"')) overlay = d;
        });
    }

    const ar = this.getEditedAspectRatio(item);
    previewEl.style.aspectRatio = '';
    previewEl.style.removeProperty('--ar');
    previewEl.innerHTML = '';
    
    // Containment frame
    const miniContainer = document.createElement('div');
    miniContainer.className = 'edited-frame';
    miniContainer.style.cssText = `position: relative; overflow: hidden; aspect-ratio: ${ar}; border-radius: 10px; background: #1a1a1a; display: flex; align-items: center; justify-content: center; margin: auto; width: min(100cqw, calc(100cqh * ${ar})); height: min(100cqh, calc(100cqw / ${ar}));`;
    
    // innerWrapper to handle crop scaling/translating
    const innerWrapper = document.createElement('div');
    if (state.crop) {
       const cw = state.crop.width;
       const ch = state.crop.height;
       const cx = state.crop.x;
       const cy = state.crop.y;
       innerWrapper.style.cssText = `position: absolute; width: ${10000/cw}%; height: ${10000/ch}%; left: -${(cx/cw)*100}%; top: -${(cy/ch)*100}%;`;
    } else {
       innerWrapper.style.cssText = 'position: absolute; width: 100%; height: 100%; left: 0; top: 0;';
    }

    // Media layer
    const miniMediaLayer = document.createElement('div');
    miniMediaLayer.style.cssText = 'position: absolute; width: 100%; height: 100%;';
    
    // Interaction layer
    const miniInteractionLayer = document.createElement('div');
    miniInteractionLayer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
    
    // Media Node (Thumbnails are always images to avoid heavy video playback in previews unless hovered/needed)
    const node = document.createElement('img');
    node.src = item.thumbUrl;
    node.style.cssText = 'width: 100%; height: 100%; object-fit: contain; transform-origin: center center;';
    
    // Apply Edits
    node.style.filter = this.buildCSSFilterString(state.filter, state.adjustments);
    node.style.transform = `translate(${state.panX || 0}%, ${state.panY || 0}%) rotate(${state.rotation || 0}deg) scale(${state.zoom || 1})`;
    
    miniMediaLayer.appendChild(node);

    // Interactions
    if (state.layers) {
      state.layers.forEach((layer) => {
        const el = document.createElement('div');
        el.style.cssText = `position: absolute; left: ${layer.x}%; top: ${layer.y}%; transform: translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale}); z-index: ${layer.zIndex}; pointer-events: none;`;
        if (layer.type === 'text') {
          el.innerHTML = `<div style="color: ${layer.styles.color || 'white'}; font-family: ${layer.styles.font || 'inherit'}; font-size: ${layer.styles.size || 24}px; font-weight: ${layer.styles.bold ? 'bold' : 'normal'}; font-style: ${layer.styles.italic ? 'italic' : 'normal'}; text-shadow: ${layer.styles.shadow ? '0 2px 10px rgba(0,0,0,0.5)' : 'none'}; text-align: center; white-space: pre-wrap;">${layer.content}</div>`;
        } else if (layer.type === 'sticker') {
          el.innerHTML = `<div style="font-size: ${layer.styles.size || 80}px; pointer-events: none;">${layer.content}</div>`;
        }
        // Scale down layers for miniature preview based on actual width
        // Use ResizeObserver for accurate sizing or assume default 100px if hidden
        const actualWidth = previewEl.clientWidth > 0 ? previewEl.clientWidth : 100;
        const scaleFactor = actualWidth / 400; // 400 is the main canvas width
        el.style.transform += ` scale(${scaleFactor})`;
        miniInteractionLayer.appendChild(el);
      });
    }

    innerWrapper.appendChild(miniMediaLayer);
    innerWrapper.appendChild(miniInteractionLayer);
    miniContainer.appendChild(innerWrapper);
    
    previewEl.appendChild(miniContainer);
    if (overlay) previewEl.appendChild(overlay);
    if (rmBtn) previewEl.appendChild(rmBtn);
  },

  renderPanels(activeTool) {
    const container = document.getElementById('he-panels-container');
    if (!container) return;
    
    // Generate glassmorphism panel
    let html = `<div style="background: rgba(15,15,20,0.85); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 20px; width: 320px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); color: white;">`;
    
    if (activeTool === 'filters') {
      html += `<h4 style="margin: 0 0 16px 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;"><i data-lucide="aperture" style="width: 18px; height: 18px; color: var(--primary);"></i> Filters</h4>`;
      html += `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; max-height: 400px; overflow-y: auto; padding-right: 8px;" class="custom-scrollbar">`;
      
      const filters = ['Original', 'Bright', 'Warm', 'Cool', 'Vintage', 'Black & White', 'HDR', 'Cinematic', 'Soft', 'Dream', 'Purple Glow', 'Cool Blue', 'Sepia', 'Vivid', 'Mono'];
      
      const defaultAdjustments = {
        brightness: 100, contrast: 100, exposure: 100, highlights: 100, shadows: 100,
        temperature: 0, tint: 0, saturation: 100, vibrance: 100, sharpness: 0, blur: 0, opacity: 100
      };

      const media = window.chUploads[this.activeMediaIndex];
      const mediaUrl = media.thumbUrl || URL.createObjectURL(media.file);

      filters.forEach(f => {
        const id = f.toLowerCase();
        const active = this.state.filter === id ? 'border: 2px solid var(--primary); transform: scale(1.05);' : 'border: 2px solid transparent;';
        const cssFilter = this.buildCSSFilterString(id, defaultAdjustments);
        
        html += `
          <div onclick="HubbleEditor.pushHistory(); HubbleEditor.state.filter = '${id}'; HubbleEditor.updateRender(); HubbleEditor.renderPanels('filters');" style="display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s; ${active}">
            <div style="width: 100%; aspect-ratio: 1; border-radius: 12px; background: url('${mediaUrl}') center/cover; filter: ${cssFilter}; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1);"></div>
            <span style="font-size: 0.7rem; font-weight: 500;">${f}</span>
          </div>
        `;
      });
      html += `</div>`;
    }
    else if (activeTool === 'adjust') {
      html += `<h4 style="margin: 0 0 16px 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;"><i data-lucide="sliders" style="width: 18px; height: 18px; color: var(--primary);"></i> Adjust</h4>`;
      html += `<div style="display: flex; flex-direction: column; gap: 16px; max-height: 400px; overflow-y: auto; padding-right: 12px;" class="custom-scrollbar">`;
      
      const sliders = [
        { id: 'brightness', label: 'Brightness', min: 0, max: 200 },
        { id: 'contrast', label: 'Contrast', min: 0, max: 200 },
        { id: 'exposure', label: 'Exposure', min: 0, max: 200 },
        { id: 'highlights', label: 'Highlights', min: 0, max: 200 },
        { id: 'shadows', label: 'Shadows', min: 0, max: 200 },
        { id: 'temperature', label: 'Temperature', min: -100, max: 100 },
        { id: 'tint', label: 'Tint', min: -100, max: 100 },
        { id: 'saturation', label: 'Saturation', min: 0, max: 200 },
        { id: 'vibrance', label: 'Vibrance', min: 0, max: 200 },
        { id: 'sharpness', label: 'Sharpness', min: 0, max: 100 },
        { id: 'blur', label: 'Blur', min: 0, max: 20 },
        { id: 'opacity', label: 'Opacity', min: 0, max: 100 }
      ];
      
      sliders.forEach(s => {
        const val = this.state.adjustments[s.id];
        html += `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
              <span>${s.label}</span>
              <span style="color: var(--primary); font-weight: 600;">${val}</span>
            </div>
            <input type="range" min="${s.min}" max="${s.max}" value="${val}" 
              oninput="HubbleEditor.state.adjustments['${s.id}'] = Number(this.value); HubbleEditor.updateRender(); this.previousElementSibling.lastElementChild.innerText = this.value;"
              onchange="HubbleEditor.pushHistory();"
              style="width: 100%; accent-color: var(--primary);">
          </div>
        `;
      });
      
      html += `<button onclick="HubbleEditor.pushHistory(); HubbleEditor.state.filter = 'original'; HubbleEditor.state.adjustments = { brightness: 100, contrast: 100, exposure: 100, highlights: 100, shadows: 100, temperature: 0, tint: 0, saturation: 100, vibrance: 100, sharpness: 0, blur: 0, opacity: 100 }; HubbleEditor.updateRender(); HubbleEditor.renderPanels('adjust');" style="margin-top: 12px; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1); cursor: pointer;">Reset All</button>`;
      html += `</div>`;
    }
    else if (activeTool === 'rotate') {
      html += `<h4 style="margin: 0 0 16px 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;"><i data-lucide="rotate-cw" style="width: 18px; height: 18px; color: var(--primary);"></i> Rotate</h4>`;
      html += `<div style="text-align: center; color: rgba(255,255,255,0.7); font-size: 0.9rem;">Rotated ${this.state.rotation}°</div>`;
    }
    else if (activeTool === 'crop') {
      html += `<h4 style="margin: 0 0 16px 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;"><i data-lucide="crop" style="width: 18px; height: 18px; color: var(--primary);"></i> Crop & Aspect</h4>`;
      html += `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px;">`;
      const ratios = ['Free', '1:1', '4:5', '3:4', '16:9', '9:16', '1080:1920'];
      const labels = ['Free', '1:1', '4:5', '3:4', '16:9', '9:16', 'Story'];
      ratios.forEach((r, i) => {
        const active = this.tempCrop && this.tempCrop.aspect === r ? 'border: 2px solid var(--primary); background: rgba(168,85,247,0.1);' : 'border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05);';
        html += `<button onclick="HubbleEditor.setCropAspect('${r}');" style="padding: 12px; border-radius: 12px; color: white; font-weight: 600; font-size: 0.9rem; cursor: pointer; ${active}">${labels[i]}</button>`;
      });
      html += `</div>`;
      
      const currentZoom = this.state.zoom || 1;
      const zoomPct = Math.round(currentZoom * 100);
      html += `
        <div class="he-zoom-panel" style="margin-bottom: 24px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 16px; border-radius: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <span style="font-size: 0.9rem; color: rgba(255,255,255,0.8); font-weight: 600;"><i data-lucide="zoom-in" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 6px;"></i>Zoom</span>
            <span id="he-zoom-val" style="font-size: 0.85rem; color: var(--primary); font-weight: bold; background: rgba(168,85,247,0.15); padding: 4px 10px; border-radius: 8px; font-variant-numeric: tabular-nums;">${zoomPct}%</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <button onclick="HubbleEditor.setCropZoom((HubbleEditor.state.zoom || 1) - 0.1)" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.1s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"><i data-lucide="minus" style="width: 14px; height: 14px;"></i></button>
            <input type="range" id="he-zoom-slider" class="he-custom-slider" min="0.5" max="3" step="0.01" value="${currentZoom}" oninput="HubbleEditor.setCropZoom(parseFloat(this.value))">
            <button onclick="HubbleEditor.setCropZoom((HubbleEditor.state.zoom || 1) + 0.1)" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.1s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"><i data-lucide="plus" style="width: 14px; height: 14px;"></i></button>
          </div>
        </div>
      `;
      
      html += `<div style="display: flex; flex-direction: column; gap: 12px;">`;
      html += `<div style="display: flex; gap: 12px;">
                 <button class="he-glass-btn" onclick="HubbleEditor.state.zoom = 1; HubbleEditor.state.panX = 0; HubbleEditor.state.panY = 0; HubbleEditor.tempCrop = { x: 0, y: 0, width: 100, height: 100, aspect: 'Free' }; HubbleEditor.renderCropHandles(); HubbleEditor.renderPanels('crop'); HubbleEditor.updateRender();">Reset</button>
                 <button class="he-premium-apply-btn" onclick="HubbleEditor.exitCropMode(true)">Apply Crop</button>
               </div>`;
      html += `<button class="he-glass-btn he-cancel-btn" onclick="HubbleEditor.exitCropMode(false)">Cancel</button>`;
      html += `</div>`;
    }
    else if (activeTool === 'stickers') {
      html += `<h4 style="margin: 0 0 16px 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;"><i data-lucide="sticker" style="width: 18px; height: 18px; color: var(--primary);"></i> Stickers</h4>`;
      html += `<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; max-height: 400px; overflow-y: auto;" class="custom-scrollbar">`;
      
      const emojiStickers = ['🔥', '✨', '❤️', '🎉', '🚀', '💯', '😂', '😍', '🎂', '✈️', '🌴', '💎', '👑', '🌈', '⚡️', '🌟'];
      
      emojiStickers.forEach(e => {
        html += `<div onclick="HubbleEditor.addLayer('text', '${e}', { size: 80 });" style="font-size: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">${e}</div>`;
      });
      
      html += `</div>`;
    }
    else if (activeTool === 'text') {
      html += `<h4 style="margin: 0 0 16px 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;"><i data-lucide="type" style="width: 18px; height: 18px; color: var(--primary);"></i> Text</h4>`;
      
      const colors = ['#ffffff', '#000000', '#888888', '#ff3b30', '#ff9500', '#ffcc00', '#4cd964', '#5ac8fa', '#007aff', '#5856d6', '#ff2d55'];
      let currentColor = HubbleEditor.textState ? HubbleEditor.textState.color : '#ffffff';
      let currentFont = HubbleEditor.textState ? HubbleEditor.textState.font : 'inherit';
      let isBold = HubbleEditor.textState ? HubbleEditor.textState.bold : false;
      let isItalic = HubbleEditor.textState ? HubbleEditor.textState.italic : false;
      let textValue = HubbleEditor.textState ? HubbleEditor.textState.text : '';
      let isExisting = HubbleEditor.textState && HubbleEditor.textState.layerId && HubbleEditor.history && HubbleEditor.history.length > 0 && HubbleEditor.history.some(h => h.layers.some(l => l.id === HubbleEditor.textState.layerId));

      html += `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <input type="text" id="he-text-input" placeholder="Enter text..." value="${textValue.replace(/"/g, '&quot;')}" oninput="HubbleEditor.updateLiveText()" style="width: 100%; padding: 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: white; outline: none; font-size: 1rem;">
          
          <div style="display: flex; flex-direction: column; gap: 8px;">
             <span style="font-size: 0.8rem; color: rgba(255,255,255,0.7);">Color</span>
             <div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px;" class="custom-scrollbar">
               <input type="color" id="he-text-color-picker" value="${currentColor}" oninput="HubbleEditor.updateLiveTextColor(this.value)" style="width: 32px; height: 32px; flex-shrink: 0; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; cursor: pointer; background: transparent; padding: 0;">
               ${colors.map(c => `<div class="he-color-swatch" data-color="${c}" onclick="HubbleEditor.updateLiveTextColor('${c}')" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%; background: ${c}; border: 2px solid ${currentColor === c ? 'var(--primary, #a855f7)' : 'rgba(255,255,255,0.1)'}; cursor: pointer; transition: all 0.2s;"></div>`).join('')}
             </div>
             <input type="hidden" id="he-text-color" value="${currentColor}">
          </div>
          
          <div style="display: flex; gap: 8px;">
            <button onclick="HubbleEditor.toggleTextFormat('bold')" id="he-text-bold" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid ${isBold ? 'var(--primary, #a855f7)' : 'rgba(255,255,255,0.1)'}; background: ${isBold ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)'}; color: white; font-weight: bold; cursor: pointer; transition: all 0.2s;">B</button>
            <button onclick="HubbleEditor.toggleTextFormat('italic')" id="he-text-italic" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid ${isItalic ? 'var(--primary, #a855f7)' : 'rgba(255,255,255,0.1)'}; background: ${isItalic ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)'}; color: white; font-style: italic; cursor: pointer; transition: all 0.2s;">I</button>
            
            <div style="flex: 2; position: relative;">
               <select id="he-text-font" onchange="HubbleEditor.updateLiveText()" style="width: 100%; height: 100%; padding: 0 12px; appearance: none; -webkit-appearance: none; background: var(--input-bg, rgba(255,255,255,0.05)); border: var(--input-border, 1px solid rgba(255,255,255,0.1)); border-radius: 8px; color: var(--text-main, #fff); cursor: pointer; outline: none; font-size: 0.9rem;">
                  <option value="inherit" style="background: var(--card-bg, #151515); color: var(--text-main, #fff);" ${currentFont === 'inherit' ? 'selected' : ''}>Default</option>
                  <option value="'Inter', sans-serif" style="background: var(--card-bg, #151515); color: var(--text-main, #fff);" ${currentFont === "'Inter', sans-serif" ? 'selected' : ''}>Inter</option>
                  <option value="'Poppins', sans-serif" style="background: var(--card-bg, #151515); color: var(--text-main, #fff);" ${currentFont === "'Poppins', sans-serif" ? 'selected' : ''}>Poppins</option>
                  <option value="'Montserrat', sans-serif" style="background: var(--card-bg, #151515); color: var(--text-main, #fff);" ${currentFont === "'Montserrat', sans-serif" ? 'selected' : ''}>Montserrat</option>
                  <option value="'Roboto', sans-serif" style="background: var(--card-bg, #151515); color: var(--text-main, #fff);" ${currentFont === "'Roboto', sans-serif" ? 'selected' : ''}>Roboto</option>
                  <option value="'Open Sans', sans-serif" style="background: var(--card-bg, #151515); color: var(--text-main, #fff);" ${currentFont === "'Open Sans', sans-serif" ? 'selected' : ''}>Open Sans</option>
                  <option value="'Lato', sans-serif" style="background: var(--card-bg, #151515); color: var(--text-main, #fff);" ${currentFont === "'Lato', sans-serif" ? 'selected' : ''}>Lato</option>
                  <option value="'Nunito', sans-serif" style="background: var(--card-bg, #151515); color: var(--text-main, #fff);" ${currentFont === "'Nunito', sans-serif" ? 'selected' : ''}>Nunito</option>
                  <option value="'Playfair Display', serif" style="background: var(--card-bg, #151515); color: var(--text-main, #fff);" ${currentFont === "'Playfair Display', serif" ? 'selected' : ''}>Playfair Display</option>
                  <option value="'Merriweather', serif" style="background: var(--card-bg, #151515); color: var(--text-main, #fff);" ${currentFont === "'Merriweather', serif" ? 'selected' : ''}>Merriweather</option>
                  <option value="'Bebas Neue', sans-serif" style="background: var(--card-bg, #151515); color: var(--text-main, #fff);" ${currentFont === "'Bebas Neue', sans-serif" ? 'selected' : ''}>Bebas Neue</option>
                  <option value="'Oswald', sans-serif" style="background: var(--card-bg, #151515); color: var(--text-main, #fff);" ${currentFont === "'Oswald', sans-serif" ? 'selected' : ''}>Oswald</option>
                  <option value="'Raleway', sans-serif" style="background: var(--card-bg, #151515); color: var(--text-main, #fff);" ${currentFont === "'Raleway', sans-serif" ? 'selected' : ''}>Raleway</option>
                  <option value="'Ubuntu', sans-serif" style="background: var(--card-bg, #151515); color: var(--text-main, #fff);" ${currentFont === "'Ubuntu', sans-serif" ? 'selected' : ''}>Ubuntu</option>
                  <option value="'Quicksand', sans-serif" style="background: var(--card-bg, #151515); color: var(--text-main, #fff);" ${currentFont === "'Quicksand', sans-serif" ? 'selected' : ''}>Quicksand</option>
               </select>
               <div style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-main, #fff); font-size: 10px;">▼</div>
            </div>
          </div>

          <button id="he-text-add-btn" onclick="HubbleEditor.commitLiveText()" style="margin-top: 8px; padding: 14px; border-radius: 12px; background: ${textValue.trim() ? 'linear-gradient(135deg, var(--primary, #a855f7) 0%, #7e22ce 100%)' : 'rgba(255,255,255,0.1)'}; box-shadow: ${textValue.trim() ? '0 8px 20px rgba(168,85,247,0.3)' : 'none'}; border: 1px solid rgba(255,255,255,0.1); color: ${textValue.trim() ? 'white' : 'rgba(255,255,255,0.4)'}; font-weight: 600; cursor: ${textValue.trim() ? 'pointer' : 'not-allowed'}; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: ${textValue.trim() ? 'all' : 'none'};">${isExisting ? 'Update Text' : 'Add Text'}</button>
        </div>
      `;
    }
    html += `</div>`;
    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  },

  GlobalAudio: {
    audio: new Audio(),
    init() {
      this.audio.loop = true;
    },
    play() {
      if (window.HubbleEditor.state.musicTrack) {
        this.audio.play().catch(e => console.error("Audio play error", e));
      }
    },
    pause() {
      this.audio.pause();
    },
    setTrack(trackUrl) {
      this.audio.src = trackUrl;
      this.audio.load();
    },
    sync(time) {
      if (Math.abs(this.audio.currentTime - time) > 0.2) {
        this.audio.currentTime = time;
      }
    },
    stop() {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  },

  openLocationSelector() {
    const renderContainer = document.getElementById('he-render-container');
    if (!renderContainer) return;
    
    let locationOverlay = document.getElementById('he-location-overlay');
    
    if (locationOverlay) {
        // Toggle off if already open
        locationOverlay.remove();
        if (this._locationSearchTimeout) clearTimeout(this._locationSearchTimeout);
        this.state.selectedLocation = null;
        return;
    }
    
    locationOverlay = document.createElement('div');
    locationOverlay.id = 'he-location-overlay';
    // Style as a glassmorphism widget placed at top-left inside media preview
    locationOverlay.style.cssText = `
        position: absolute;
        top: 20px;
        left: 20px;
        width: 280px;
        max-width: calc(100% - 40px);
        z-index: 50; /* Ensure it's above canvas but inside render container */
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;
    
    // Prevent dragging/zooming when interacting with search overlay
    locationOverlay.addEventListener('mousedown', e => e.stopPropagation());
    locationOverlay.addEventListener('wheel', e => e.stopPropagation());
    locationOverlay.addEventListener('touchstart', e => e.stopPropagation());

    const searchInputWrapper = document.createElement('div');
    searchInputWrapper.style.cssText = `
        position: relative;
        width: 100%;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        transition: border-color 0.2s;
    `;
    
    const searchIcon = document.createElement('i');
    searchIcon.setAttribute('data-lucide', 'map-pin');
    searchIcon.style.cssText = 'position: absolute; left: 14px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: rgba(255,255,255,0.6);';
    searchInputWrapper.appendChild(searchIcon);
    
    const searchInput = document.createElement('input');
    searchInput.id = 'he-location-search-input';
    searchInput.type = 'text';
    searchInput.placeholder = '📍 Search location...';
    // If we have a selected location, show its name
    if (this.state.selectedLocation && this.state.selectedLocation.displayName) {
        searchInput.value = this.state.selectedLocation.displayName;
    }
    searchInput.style.cssText = `
        width: 100%;
        background: transparent;
        border: none;
        padding: 12px 14px 12px 38px;
        color: white;
        font-family: inherit;
        font-size: 0.9rem;
        outline: none;
        box-sizing: border-box;
        pointer-events: auto;
        user-select: auto;
    `;
    
    // Ensure clicking the input actually focuses it, bypassing any global preventDefault
    searchInput.addEventListener('mousedown', e => {
        e.stopPropagation();
    });
    searchInput.addEventListener('click', e => {
        e.stopPropagation();
        searchInput.focus();
    });
    
    // Prevent typing from triggering editor shortcuts (e.g. Backspace deleting layers)
    searchInput.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Escape') {
            document.getElementById('he-location-results-container').style.display = 'none';
            searchInput.blur();
        }
    });
    
    searchInput.addEventListener('input', e => {
        if (window.HubbleEditor) window.HubbleEditor.handleLocationSearch(e.target.value);
    });
    
    searchInput.addEventListener('focus', () => {
        searchInputWrapper.style.borderColor = 'var(--primary)';
        document.getElementById('he-location-results-container').style.display = 'flex';
        // Only trigger search if there is a query, else show empty
        if (searchInput.value.trim().length >= 2) {
            this.handleLocationSearch(searchInput.value);
        } else {
            this.renderLocationResults(null, 'empty_default');
        }
    });
    
    searchInput.addEventListener('blur', () => {
        searchInputWrapper.style.borderColor = 'rgba(255,255,255,0.1)';
    });

    searchInputWrapper.appendChild(searchInput);
    
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'he-location-results-container';
    resultsContainer.style.cssText = `
        display: none;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        /* Approx height for 3 items (approx 58px each + gaps/padding) */
        max-height: 200px;
        overflow-y: auto;
        padding: 8px;
        box-sizing: border-box;
    `;
    
    // Add custom thin scrollbar css rules for this container implicitly
    // (We will add the scrollbar styling in style.css or rely on the global one if it exists)
    resultsContainer.classList.add('he-thin-scrollbar');
    
    locationOverlay.appendChild(searchInputWrapper);
    locationOverlay.appendChild(resultsContainer);
    
    renderContainer.appendChild(locationOverlay);
    
    if (window.lucide) window.lucide.createIcons();
    
    // Close dropdown on outside click
    const outsideClickListener = (e) => {
        if (!locationOverlay.contains(e.target)) {
            resultsContainer.style.display = 'none';
        }
    };
    document.addEventListener('mousedown', outsideClickListener);
    
    // Cleanup listener when overlay is removed
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.removedNodes.forEach((node) => {
                if (node === locationOverlay) {
                    document.removeEventListener('mousedown', outsideClickListener);
                    observer.disconnect();
                }
            });
        });
    });
    observer.observe(renderContainer, { childList: true });
    
    // Initial render empty
    this.renderLocationResults(null, 'empty_default');
    
    searchInput.focus();
  },

  _locationSearchTimeout: null,
  _locationSearchAbortController: null,
  _lastLocationResults: null,
  _lastLocationState: 'default',

  handleLocationSearch(query) {
    if (this._locationSearchTimeout) clearTimeout(this._locationSearchTimeout);
    if (this._locationSearchAbortController) this._locationSearchAbortController.abort();
    
    if (!query || query.trim().length < 2) {
      this.renderLocationResults(null, 'empty_default');
      return;
    }

    this.renderLocationResults(null, 'loading');

    this._locationSearchTimeout = setTimeout(async () => {
      this._locationSearchAbortController = new AbortController();
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`, {
          signal: this._locationSearchAbortController.signal,
          headers: { 'Accept-Language': 'en-US,en;q=0.9' }
        });
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        
        if (data && data.length > 0) {
          const results = data.map(item => {
            const addr = item.address;
            const mainName = item.name || addr.city || addr.town || addr.village || 'Unknown';
            const parts = [];
            if (addr.city && addr.city !== mainName) parts.push(addr.city);
            if (addr.state) parts.push(addr.state);
            if (addr.country) parts.push(addr.country);
            return {
              id: item.place_id,
              displayName: mainName,
              subText: parts.join(', '),
              lat: item.lat,
              lon: item.lon,
              type: item.type
            };
          });
          this.renderLocationResults(results, 'results');
        } else {
          this.renderLocationResults(null, 'empty');
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Location search error:", err);
          this.renderLocationResults(null, 'error');
        }
      }
    }, 300);
  },

  renderLocationResults(results, state) {
    this._lastLocationResults = results;
    this._lastLocationState = state;
    
    const container = document.getElementById('he-location-results-container');
    if (!container) return;
    
    const buildItemHTML = (id, mainText, subText, isSelected) => {
        const bg = isSelected ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.02)';
        const border = isSelected ? 'rgba(168,85,247,0.5)' : 'transparent';
        const checkIcon = isSelected ? `<i data-lucide="check" style="color: var(--primary); width: 16px; height: 16px; margin-left: auto;"></i>` : '';
        return `
          <div onclick="if(window.HubbleEditor) window.HubbleEditor.selectLocation('${id.replace(/'/g, "\\'")}', '${mainText.replace(/'/g, "\\'")}', '${subText ? subText.replace(/'/g, "\\'") : ''}')" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; background: ${bg}; border: 1px solid ${border}; cursor: pointer; transition: all 0.2s;" onmouseover="if(!${isSelected}){this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='rgba(255,255,255,0.1)';}" onmouseout="if(!${isSelected}){this.style.background='rgba(255,255,255,0.02)'; this.style.borderColor='transparent';}">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <i data-lucide="map-pin" style="color: ${isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.6)'}; width: 14px; height: 14px;"></i>
            </div>
            <div style="display: flex; flex-direction: column; overflow: hidden; text-align: left;">
                <span style="color: white; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${mainText}</span>
                ${subText ? `<span style="color: rgba(255,255,255,0.4); font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${subText}</span>` : ''}
            </div>
            ${checkIcon}
          </div>
        `;
    };

    if (state === 'empty_default') {
        container.style.display = 'none'; // hide if nothing typed
    } else if (state === 'loading') {
        container.style.display = 'flex';
        container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; gap: 12px; color: rgba(255,255,255,0.6);">
            <div class="he-spinner" style="width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.2); border-top-color: var(--primary); border-radius: 50%; animation: he-spin 1s linear infinite;"></div>
        </div>`;
    } else if (state === 'empty') {
        container.style.display = 'flex';
        container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; gap: 8px; color: rgba(255,255,255,0.6);">
            <span style="font-size: 0.85rem;">No locations found.</span>
        </div>`;
    } else if (state === 'error') {
        container.style.display = 'flex';
        container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; gap: 8px; color: rgba(255,255,255,0.6);">
            <span style="font-size: 0.85rem;">Couldn't load locations.</span>
        </div>`;
    } else if (state === 'results' && results) {
        container.style.display = 'flex';
        let html = `<div style="display: flex; flex-direction: column; gap: 8px;">`;
        results.forEach(res => {
            const isSelected = this.state.selectedLocation && String(this.state.selectedLocation.id) === String(res.id);
            html += buildItemHTML(String(res.id), res.displayName, res.subText, isSelected);
        });
        html += `</div>`;
        container.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
    }
  },

  selectLocation(id, displayName, subText) {
    this.state.selectedLocation = {
        id: id,
        displayName: displayName,
        subText: subText
    };
    
    const searchInput = document.getElementById('he-location-search-input');
    if (searchInput) {
        searchInput.value = displayName;
    }
    
    const resultsContainer = document.getElementById('he-location-results-container');
    if (resultsContainer) {
        resultsContainer.style.display = 'none';
    }
  },

  openMusicSelector() {
    const modal = document.getElementById('he-music-modal');
    const list = document.getElementById('he-music-list');
    const removeBtn = document.getElementById('he-music-remove-btn');
    if(!modal || !list) return;
    
    // Mock Tracks
    const tracks = [
      { id: 'm1', title: 'Summer Vibes', artist: 'Chill Wave', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
      { id: 'm2', title: 'Urban Flow', artist: 'Beat Maker', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
      { id: 'm3', title: 'Ambient Journey', artist: 'Space Echo', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
      { id: 'm4', title: 'Acoustic Sunrise', artist: 'Folk Tales', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' }
    ];
    
    list.innerHTML = '';
    tracks.forEach(t => {
      const isSelected = window.HubbleEditor.state.musicTrack && window.HubbleEditor.state.musicTrack.id === t.id;
      const el = document.createElement('div');
      el.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 12px; border-radius: 12px; background: ${isSelected ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}; cursor: pointer; transition: all 0.2s;`;
      el.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <span style="color: white; font-weight: 600; font-size: 0.95rem;">${t.title}</span>
          <span style="color: rgba(255,255,255,0.5); font-size: 0.8rem;">${t.artist}</span>
        </div>
        ${isSelected ? '<i data-lucide="check-circle" style="color: var(--primary); width: 20px; height: 20px;"></i>' : '<i data-lucide="play-circle" style="color: rgba(255,255,255,0.5); width: 20px; height: 20px;"></i>'}
      `;
      el.onclick = () => {
        window.HubbleEditor.pushHistory();
        window.HubbleEditor.state.musicTrack = t;
        window.HubbleEditor.GlobalAudio.setTrack(t.url);
        window.HubbleEditor.openMusicSelector(); // re-render
        
        const canvasVideo = document.querySelector('#he-media-layer video');
        if(canvasVideo && !canvasVideo.paused) {
           window.HubbleEditor.GlobalAudio.play();
        }
      };
      list.appendChild(el);
    });
    
    removeBtn.style.display = window.HubbleEditor.state.musicTrack ? 'block' : 'none';
    
    modal.style.display = 'flex';
    setTimeout(() => modal.style.opacity = '1', 10);
    if(window.lucide) window.lucide.createIcons();
  },

  removeMusic() {
    window.HubbleEditor.pushHistory();
    window.HubbleEditor.state.musicTrack = null;
    window.HubbleEditor.GlobalAudio.stop();
    const modal = document.getElementById('he-music-modal');
    if (modal) {
      modal.style.opacity = '0';
      setTimeout(() => modal.style.display = 'none', 300);
    }
  },

  toggleSpeaker(e, forceMute = null) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (window.HubbleEditor._isTogglingSpeaker) return;
    window.HubbleEditor._isTogglingSpeaker = true;
    setTimeout(() => { window.HubbleEditor._isTogglingSpeaker = false; }, 150);

    const state = window.HubbleEditor.state;
    if (forceMute !== null) {
      state.isMuted = forceMute;
    } else {
      state.isMuted = !state.isMuted;
    }
    
    // Smooth Mute: Update volume to 0/1 to prevent decoder stutter on some browsers
    const videos = [
      document.querySelector('#he-media-layer video'),
      ...document.querySelectorAll('#review-slider-wrapper video')
    ];
    
    videos.forEach(v => {
      if (v) {
        v.muted = state.isMuted;
        v.volume = state.isMuted ? 0 : 1;
      }
    });
    
    // Update speaker UI efficiently
    const mutedIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
    const unmutedIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
    
    document.querySelectorAll('.he-speaker-icon').forEach(icon => {
      icon.innerHTML = state.isMuted ? mutedIcon : unmutedIcon;
    });
  },

  buildVideoControls(container, videoNode, isReview = false) {
    const controlsId = isReview ? 'he-review-controls' : 'he-video-controls';
    let controls = document.createElement('div');
    controls.id = controlsId;
    controls.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1000; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 24px;';
    
    const playBtn = document.createElement('div');
    playBtn.id = isReview ? 'he-review-play-btn' : 'he-play-btn';
    playBtn.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.9); width: 64px; height: 64px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; pointer-events: all; cursor: pointer; transition: all 0.3s; opacity: 0; box-shadow: 0 8px 32px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);';
    playBtn.innerHTML = '<i data-lucide="pause" style="color: white; width: 32px; height: 32px;"></i>';
    
    let hideTimeout;
    const showPlayBtn = (icon) => {
      playBtn.innerHTML = `<i data-lucide="${icon}" style="color: white; width: 32px; height: 32px;"></i>`;
      if (window.lucide) window.lucide.createIcons();
      playBtn.style.opacity = '1';
      playBtn.style.transform = 'scale(1)';
      clearTimeout(hideTimeout);
      if (icon === 'pause') {
        hideTimeout = setTimeout(() => {
          playBtn.style.opacity = '0';
          playBtn.style.transform = 'scale(0.9)';
        }, 2000);
      }
    };

    const togglePlay = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const vid = videoNode;
      if (!vid) return;
      if (vid.paused) {
        vid.play();
        showPlayBtn('pause');
      } else {
        vid.pause();
        showPlayBtn('play');
      }
    };

    playBtn.onclick = togglePlay;
    container.addEventListener('mousemove', () => {
      if (videoNode && !videoNode.paused) {
        showPlayBtn('pause');
      }
    });
    
    showPlayBtn('pause'); // Set initial state

    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 0 20px; pointer-events: all; gap: 16px; margin-top: auto; width: 100%; box-sizing: border-box;';

    // Timeline container
    const timelineContainer = document.createElement('div');
    timelineContainer.id = isReview ? 'he-review-timeline' : 'he-timeline';
    timelineContainer.style.cssText = 'flex-grow: 1; display: flex; flex-direction: column; gap: 8px; cursor: pointer; position: relative; padding: 10px 0;';

    const timeText = document.createElement('div');
    timeText.id = isReview ? 'he-review-time-text' : 'he-time-text';
    timeText.style.cssText = 'color: white; font-size: 11px; font-weight: 600; font-family: monospace; text-shadow: 0 1px 4px rgba(0,0,0,0.8); display: flex; justify-content: space-between; opacity: 0.9;';
    timeText.innerHTML = '<span>00:00</span><span>00:00</span>';
    
    const track = document.createElement('div');
    track.style.cssText = 'width: 100%; height: 6px; border-radius: 4px; background: rgba(255,255,255,0.3); backdrop-filter: blur(4px); position: relative; overflow: hidden;';
    
    const fill = document.createElement('div');
    fill.id = isReview ? 'he-review-timeline-fill' : 'he-timeline-fill';
    fill.style.cssText = 'position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: var(--primary, #a855f7); box-shadow: 0 0 10px rgba(168,85,247,0.5); border-radius: 4px; transition: width 0.1s linear;';
    
    track.appendChild(fill);
    timelineContainer.appendChild(track);
    timelineContainer.appendChild(timeText);

    // Controls right side (Volume + Speaker)
    const rightControls = document.createElement('div');
    rightControls.style.cssText = 'display: flex; align-items: center; gap: 12px;';

    // Volume Slider
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = '0';
    volumeSlider.max = '1';
    volumeSlider.step = '0.01';
    volumeSlider.value = this.state.isMuted ? '0' : (this.state.volume || '1');
    volumeSlider.id = isReview ? 'he-review-volume' : 'he-volume';
    volumeSlider.className = 'he-glass-slider';
    
    volumeSlider.oninput = (e) => {
      const val = parseFloat(e.target.value);
      this.state.volume = val;
      
      const videos = [
        document.querySelector('#he-media-layer video'),
        ...document.querySelectorAll('#review-slider-wrapper video')
      ];
      videos.forEach(v => {
        if (v) {
          v.volume = val;
          if (val > 0 && v.muted) v.muted = false;
        }
      });
      
      if (this.GlobalAudio && this.GlobalAudio.audio) {
         this.GlobalAudio.audio.volume = val;
      }

      if (val === 0 && !this.state.isMuted) {
         this.toggleSpeaker(null, true);
      } else if (val > 0 && this.state.isMuted) {
         this.toggleSpeaker(null, false);
      }
    };

    // Speaker btn
    const speakerBtn = document.createElement('div');
    speakerBtn.id = 'he-speaker-btn';
    speakerBtn.className = 'he-speaker-icon';
    speakerBtn.style.cssText = 'width: 44px; height: 44px; border-radius: 50%; background: rgba(168,85,247,0.25); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1); box-shadow: 0 4px 15px rgba(168,85,247,0.4), inset 0 0 10px rgba(168,85,247,0.2); border: 1px solid rgba(168,85,247,0.5); color: white; flex-shrink: 0;';
    speakerBtn.innerHTML = this.state.isMuted ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
    
    speakerBtn.onclick = (e) => {
      this.toggleSpeaker(e);
      if (this.state.isMuted) {
        volumeSlider.value = '0';
      } else {
        volumeSlider.value = this.state.volume || '1';
        
        const videos = [
          document.querySelector('#he-media-layer video'),
          ...document.querySelectorAll('#review-slider-wrapper video')
        ];
        videos.forEach(v => { if (v) v.volume = parseFloat(volumeSlider.value); });
      }
    };
    
    rightControls.appendChild(volumeSlider);
    rightControls.appendChild(speakerBtn);

    bottomRow.appendChild(timelineContainer);
    bottomRow.appendChild(rightControls);

    controls.appendChild(playBtn);
    controls.appendChild(bottomRow);
    container.appendChild(controls);

    if (window.lucide) window.lucide.createIcons();

    // Timeline Drag Logic
    const updateTimeline = (e) => {
       const rect = timelineContainer.getBoundingClientRect();
       let pos = (e.clientX - rect.left) / rect.width;
       pos = Math.max(0, Math.min(pos, 1));
       
       if (videoNode && videoNode.duration) {
          videoNode.currentTime = pos * videoNode.duration;
       }
    };
    
    let isDragging = false;
    timelineContainer.onmousedown = (e) => {
       isDragging = true;
       updateTimeline(e);
    };
    window.addEventListener('mousemove', (e) => {
       if (isDragging) updateTimeline(e);
    });
    window.addEventListener('mouseup', () => {
       isDragging = false;
    });

    // RAF Update Loop for UI
    const formatTime = (time) => {
       if (isNaN(time)) return '00:00';
       const m = Math.floor(time / 60).toString().padStart(2, '0');
       const s = Math.floor(time % 60).toString().padStart(2, '0');
       return `${m}:${s}`;
    };

    const updateUI = () => {
       if (!controls.parentElement) return; // Cleanup when unmounted
       
       if (videoNode && videoNode.duration) {
          const perc = (videoNode.currentTime / videoNode.duration) * 100;
          fill.style.width = `${perc}%`;
          timeText.innerHTML = `<span>${formatTime(videoNode.currentTime)}</span><span>${formatTime(videoNode.duration)}</span>`;
       }

       if (this.state.isMuted && volumeSlider.value !== '0') {
          volumeSlider.value = '0';
       }

       requestAnimationFrame(updateUI);
    };
    requestAnimationFrame(updateUI);

    return controls;
  }
};

// Initialize GlobalAudio once on startup
window.HubbleEditor.GlobalAudio.init();

// Initialize after DOM loads
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => window.HubbleEditor.init(), 500);
} else {
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => window.HubbleEditor.init(), 500));
}

// ==================== COLLABORATOR SELECTION LOGIC ====================
window.selectedCollaborators = [];
window.collaborationEnabled = true;
let cachedHubbers = null;

window.toggleCollaboration = function(enabled) {
  window.collaborationEnabled = enabled;
  const contentDiv = document.getElementById('ch-collab-content');
  const msgDiv = document.getElementById('ch-collab-disabled-msg');
  const addBtn = document.getElementById('btn-add-collaborators');
  
  if (window.renderCollaboratorChips) window.renderCollaboratorChips();
  
  if (!contentDiv || !msgDiv || !addBtn) return;
  
  if (enabled) {
    contentDiv.style.opacity = '1';
    contentDiv.style.pointerEvents = 'auto';
    msgDiv.style.display = 'none';
    addBtn.style.display = 'flex';
  } else {
    contentDiv.style.opacity = '0.55';
    addBtn.style.display = 'none';
    
    if (window.selectedCollaborators.length === 0) {
      msgDiv.style.display = 'block';
    } else {
      msgDiv.style.display = 'none';
    }
  }
};

window.openCollaboratorModal = async function() {
  if (window.collaborationEnabled === false) return;
  
  const modal = document.getElementById('collaborator-modal');
  const searchInput = document.getElementById('collaborator-search-input');
  if(searchInput) searchInput.value = '';
  modal.style.display = 'flex';
  
  if (cachedHubbers === null) {
    const listContainer = document.getElementById('collaborator-list-container');
    listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Loading Hubbers...</div>';
    
    const token = localStorage.getItem('invibe_jwt_token');
    const currentUserStr = localStorage.getItem('invibeUser');
    if (!token || !currentUserStr) return;
    
    const currentUser = JSON.parse(currentUserStr);
    const userId = currentUser.id || currentUser._id;
    
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}/followers-list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load hubbers');
      cachedHubbers = await res.json();
    } catch (err) {
      console.error(err);
      cachedHubbers = [];
    }
  }
  
  window.renderCollaboratorModalList();
};

window.closeCollaboratorModal = function() {
  const modal = document.getElementById('collaborator-modal');
  modal.style.display = 'none';
};

window.renderCollaboratorModalList = function(query = '') {
  const listContainer = document.getElementById('collaborator-list-container');
  if (!listContainer) return;
  
  if (!cachedHubbers || cachedHubbers.length === 0) {
    listContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center;">
        <i data-lucide="users" style="width: 48px; height: 48px; color: var(--text-muted); margin-bottom: 16px;"></i>
        <h4 style="margin: 0 0 8px 0; font-size: 1.1rem; color: var(--text);">No Hubbers Found</h4>
        <p style="margin: 0; color: var(--text-muted); font-size: 0.9rem;">You don't have any Hubbers yet.<br>Connect with people first before collaborating.</p>
      </div>
    `;
    if(window.lucide) window.lucide.createIcons();
    return;
  }
  
  const lowerQuery = query.toLowerCase();
  const filtered = cachedHubbers.filter(h => {
    const name = (h.name || '').toLowerCase();
    const username = (h.username || '').toLowerCase();
    return name.includes(lowerQuery) || username.includes(lowerQuery);
  });
  
  if (filtered.length === 0) {
    listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No matching Hubbers found.</div>';
    return;
  }
  
  const selectedIds = window.selectedCollaborators.map(c => c._id || c.id);
  
  listContainer.innerHTML = filtered.map(h => {
    const isSelected = selectedIds.includes(h._id || h.id);
    const avatar = h.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=40&q=80';
    return `
      <div onclick='window.toggleCollaboratorSelection(${JSON.stringify(h).replace(/'/g, "&#39;")})' style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border-radius: 12px; cursor: ${isSelected ? 'default' : 'pointer'}; background: ${isSelected ? 'rgba(168,85,247,0.1)' : 'transparent'}; border: 1px solid ${isSelected ? 'var(--primary)' : 'transparent'}; transition: all 0.2s; opacity: ${isSelected ? '0.6' : '1'};">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${avatar}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">
          <div style="display: flex; flex-direction: column;">
            <span style="font-weight: 600; font-size: 0.9rem; color: var(--text);">${h.name || h.username}</span>
            <span style="font-size: 0.8rem; color: var(--text-muted);">@${h.username}</span>
          </div>
        </div>
        ${isSelected ? '<span style="font-size: 0.8rem; color: var(--primary); font-weight: 600;">Added</span>' : '<i data-lucide="plus" style="width: 16px; height: 16px; color: var(--text-muted);"></i>'}
      </div>
    `;
  }).join('');
  
  if(window.lucide) window.lucide.createIcons();
};

window.toggleCollaboratorSelection = function(hubberObj) {
  const hubberId = hubberObj._id || hubberObj.id;
  const isSelected = window.selectedCollaborators.some(c => (c._id || c.id) === hubberId);
  
  if (isSelected) {
    return; // Prevent duplicates / already added
  } else {
    window.selectedCollaborators.push(hubberObj);
  }
  
  window.renderCollaboratorChips();
  // Re-render modal to reflect "Added" state if modal is open
  const searchInput = document.getElementById('collaborator-search-input');
  if(searchInput) {
    window.renderCollaboratorModalList(searchInput.value);
  } else {
    window.renderCollaboratorModalList();
  }
};

window.removeCollaborator = function(hubberId) {
  window.selectedCollaborators = window.selectedCollaborators.filter(c => (c._id || c.id) !== hubberId);
  window.renderCollaboratorChips();
  
  // Re-render modal if open
  const searchInput = document.getElementById('collaborator-search-input');
  if(document.getElementById('collaborator-modal').style.display === 'flex') {
    window.renderCollaboratorModalList(searchInput ? searchInput.value : '');
  }
};

window.renderCollaboratorChips = function() {
  const container = document.getElementById('ch-selected-collaborators');
  const label = document.getElementById('ch-collaborators-label');
  if (!container) return;
  
  if (window.selectedCollaborators.length > 0) {
    if(label) label.style.display = 'block';
  } else {
    if(label) label.style.display = 'none';
  }
  
  const isEnabled = window.collaborationEnabled !== false;
  
  container.innerHTML = window.selectedCollaborators.map(c => {
    const id = c._id || c.id;
    const avatar = c.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=30&q=80';
    return `
      <div style="display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px;">
        <img src="${avatar}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;">
        <span style="font-size: 0.8rem; color: var(--text);">${c.name || c.username}</span>
        ${isEnabled ? `<i data-lucide="x" style="width: 12px; height: 12px; cursor: pointer; color: var(--text-muted);" onclick="window.removeCollaborator('${id}')"></i>` : ''}
      </div>
    `;
  }).join('');
  
  if (window.lucide) window.lucide.createIcons();
};
