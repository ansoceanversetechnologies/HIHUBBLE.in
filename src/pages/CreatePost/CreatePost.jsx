import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Image as ImageIcon, Video, Music, BarChart2, Smile, MapPin, 
  Users, Hash, Calendar, Sparkles, Send, FileText, Check, 
  X, Plus, RefreshCw, Clock, Bold, Italic, Underline,
  List, Quote, Link, Globe, RotateCw, ChevronRight, Undo2, Redo2, RotateCcw,
  Eye, Monitor, Tablet, Smartphone, Move, Type, Edit3, Heart, Star, Flame
} from 'lucide-react';
import Card from '../../components/Post/Card';
import * as api from '../../services/api';

const CreatePost = ({ onNavigateBack }) => {
  // --- CORE STATE ---
  const [profile, setProfile] = useState({
    fullName: 'mushtaaq Shaik',
    username: 'mushtaaq_12',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80'
  });

  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  // Settings
  const [audience, setAudience] = useState('Public');
  const [customAudienceUsers, setCustomAudienceUsers] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [audienceSearchQuery, setAudienceSearchQuery] = useState('');
  const [previewVisibility, setPreviewVisibility] = useState(true);

  const [location, setLocation] = useState('Hyderabad, Telangana, India');
  const [topics, setTopics] = useState(['#sunset', '#travel', '#photography']);
  const [taggedPeople, setTaggedPeople] = useState(['@friends']);
  
  // Workspace Mode: 'editor' | 'mediastudio' | 'audience' | 'schedule' | 'location' | 'topics' | 'preview' | 'drafts'
  const [workspaceMode, setWorkspaceMode] = useState('editor');

  // Locations / Topics Search
  const [tempLocationSearch, setTempLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [mapCoords, setMapCoords] = useState({ lat: '17.3850', lon: '78.4867' });
  const [tempTopicSearch, setTempTopicSearch] = useState('');

  // Geolocation Search using Nominatim API (Free OpenStreetMap API)
  useEffect(() => {
    if (!tempLocationSearch.trim()) {
      setLocationResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLocationLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(tempLocationSearch)}&limit=5`, {
          headers: {
            'accept-language': 'en'
          }
        });
        if (res.ok) {
          const data = await res.json();
          setLocationResults(data.map(item => ({
            name: item.display_name,
            lat: item.lat,
            lon: item.lon
          })));
        }
      } catch (err) {
        console.error('Error searching location:', err);
      } finally {
        setLocationLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [tempLocationSearch]);

  // Text Overlay Customization Settings
  const [fontText, setFontText] = useState('New Vibe');
  const [fontFamily, setFontFamily] = useState('Outfit');
  const [fontSize, setFontSize] = useState(24);
  const [fontColor, setFontColor] = useState('#ffffff');
  const [fontBgMode, setFontBgMode] = useState('none'); // 'none' | 'solid' | 'shadow' | 'outline'
  const [isFontBold, setIsFontBold] = useState(false);
  const [isFontItalic, setIsFontItalic] = useState(false);
  const [selectedTextId, setSelectedTextId] = useState(null);

  // Music Picker States
  const [musicModalOpen, setMusicModalOpen] = useState(false);
  const [musicSearchQuery, setMusicSearchQuery] = useState('');
  const [musicSearchResults, setMusicSearchResults] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const audioPreviewRef = useRef(null);

  // Dragging states for Crop / Stickers / Texts
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, cropX: 0, cropY: 0 });
  const [activeCropHandle, setActiveCropHandle] = useState(null);
  const cropDragStartRef = useRef({ x: 0, y: 0, startTop: 0, startBottom: 0, startLeft: 0, startRight: 0 });
  const [activeStickerDragId, setActiveStickerDragId] = useState(null);
  const stickerDragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const [activeTextDragId, setActiveTextDragId] = useState(null);
  const textDragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const mediaWrapperRef = useRef(null);

  // Scheduling State
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('Later Today, 8:00 PM');
  const [scheduleDate, setScheduleDate] = useState(19);
  const [scheduleHour, setScheduleHour] = useState('08');
  const [scheduleMinute, setScheduleMinute] = useState('00');
  const [schedulePeriod, setSchedulePeriod] = useState('PM');
  const [scheduleTimezone, setScheduleTimezone] = useState('GMT+5:30 (India Standard Time)');

  // Preview Workspace Mode
  const [previewDevice, setPreviewDevice] = useState('Mobile');
  const [isLoading, setIsLoading] = useState(false);

  // Drafts State
  const [draftsList, setDraftsList] = useState(() => {
    try {
      const saved = localStorage.getItem('hubbleDrafts');
      const list = saved ? JSON.parse(saved) : [];
      return list.filter(d => d.id !== 101 && d.id !== 102 && d.id !== 999);
    } catch (e) {
      return [];
    }
  });
  const [searchDraftsQuery, setSearchDraftsQuery] = useState('');

  // Media Studio Specific Editor State
  const [editorTab, setEditorTab] = useState('crop'); 
  const [isBeforeActive, setIsBeforeActive] = useState(false);
  
  // History for active media file
  const [editorHistory, setEditorHistory] = useState([]);
  const [editorHistoryIndex, setEditorHistoryIndex] = useState(-1);

  // Drag & drop state
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Canvas drawing ref
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [brushColor, setBrushColor] = useState('#a855f7');
  const [brushSize, setBrushSize] = useState(5);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // --- EFFECT: EXPAND MAIN CONTAINER & LOAD USER PROFILE ---
  useEffect(() => {
    // Hide right sidebar dynamically for the post creator workspace screen ratio fix!
    document.body.classList.add('create-post-view-active');
    
    const userStr = localStorage.getItem('invibeUser');
    const profileImage = localStorage.getItem('invibeProfileImage');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setProfile({
          fullName: u.fullName || 'mushtaaq Shaik',
          username: u.username || 'mushtaaq_12',
          avatar: profileImage || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80'
        });
      } catch (e) {
        console.error(e);
      }
    }

    return () => {
      // Restore layout sidebar when leaving page creation
      document.body.classList.remove('create-post-view-active');
    };
  }, []);

  // Sync initial content to contentEditable editor when it mounts/remounts
  useEffect(() => {
    if (textareaRef.current && textareaRef.current.innerHTML !== content) {
      textareaRef.current.innerHTML = content;
    }
  }, [workspaceMode]);

  // Pre-load default basic music tracks when music modal is opened
  useEffect(() => {
    if (musicModalOpen && musicSearchResults.length === 0) {
      setMusicSearchQuery('Lofi Chill');
      searchMusic('Lofi Chill');
    }
  }, [musicModalOpen]);



  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    addFiles(files);
  };

  const addFiles = (files) => {
    const newMedia = files.map((file, index) => {
      const isVideo = file.type.startsWith('video/');
      return {
        id: Date.now() + index,
        type: isVideo ? 'video' : 'image',
        previewUrl: URL.createObjectURL(file),
        filter: 'Original',
        brightness: 100,
        contrast: 100,
        saturation: 100,
        exposure: 100,
        sharpness: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        cropRatio: 'original',
        cropX: 0,
        cropY: 0,
        cropZoom: 1,
        effect: 'None',
        frame: 'None',
        stickers: [],
        texts: [],
        drawings: []
      };
    });
    setMediaFiles(prev => [...prev, ...newMedia]);
  };

  const removeMedia = (id) => {
    setMediaFiles(prev => prev.filter(m => m.id !== id));
    if (activeMediaIndex >= mediaFiles.length - 1 && activeMediaIndex > 0) {
      setActiveMediaIndex(activeMediaIndex - 1);
    }
  };

  const handlePostSubmit = async () => {
    setIsLoading(true);
    try {
      const musicWidgetHtml = selectedTrack ? `
<div class="feed-post-music-attachment" data-music-url="${selectedTrack.previewUrl}" data-music-title="${selectedTrack.title}" data-music-artist="${selectedTrack.artist}" style="display: flex; align-items: center; gap: 10px; background: rgba(108, 59, 255, 0.12); border: 1px solid rgba(108, 59, 255, 0.25); border-radius: 12px; padding: 8px 12px; margin-top: 10px; cursor: pointer; width: fit-content; user-select: none;">
  <div style="position: relative; width: 28px; height: 28px; border-radius: 50%; overflow: hidden; background: #000; flex-shrink: 0;">
    <img src="${selectedTrack.artwork}" class="music-vinyl-disc" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; animation: spin 4s linear infinite; animation-play-state: paused;" />
  </div>
  <div>
    <div style="font-size: 11px; font-weight: 700; color: #fff; line-height: 1.2;">${selectedTrack.title}</div>
    <div style="font-size: 9px; color: rgba(255,255,255,0.6); line-height: 1.2; margin-top: 2px;">${selectedTrack.artist}</div>
  </div>
  <button class="music-play-feed-btn" style="background: none; border: none; color: #a855f7; cursor: pointer; padding: 0 4px; display: flex; align-items: center; justify-content: center; outline: none; margin-left: auto; pointer-events: none;">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play"><polygon points="6 3 20 12 6 21 6 3"/></svg>
  </button>
</div>
      ` : '';

      const postData = {
        content: content + musicWidgetHtml,
        media: mediaFiles.map(m => m.previewUrl),
        location,
        topics,
        audience,
        taggedPeople,
        isScheduled,
        scheduleTime
      };

      if (isScheduled) {
        await api.schedulePost(postData);
        showToastNotification('Hub scheduled successfully! 📅');
      } else {
        await api.createPost(postData);
        showToastNotification('Hub published successfully! 🎉');
      }

      setTimeout(() => onNavigateBack(), 1200);
    } catch (err) {
      showToastNotification(`Error: ${err.message || 'Failed to submit post'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const showToastNotification = (msg) => {
    const toast = document.getElementById('toast-notif');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('active');
      setTimeout(() => toast.classList.remove('active'), 3000);
    }
  };

  // --- HISTORY STATE HELPERS FOR EDITOR ---
  const pushEditorHistory = (updatedMediaItem) => {
    const historySlice = editorHistory.slice(0, editorHistoryIndex + 1);
    const newHistory = [...historySlice, JSON.parse(JSON.stringify(updatedMediaItem))];
    setEditorHistory(newHistory);
    setEditorHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (editorHistoryIndex > 0) {
      const prevIndex = editorHistoryIndex - 1;
      setEditorHistoryIndex(prevIndex);
      const restored = JSON.parse(JSON.stringify(editorHistory[prevIndex]));
      setMediaFiles(prev => prev.map((m, idx) => idx === activeMediaIndex ? restored : m));
    }
  };

  const handleRedo = () => {
    if (editorHistoryIndex < editorHistory.length - 1) {
      const nextIndex = editorHistoryIndex + 1;
      setEditorHistoryIndex(nextIndex);
      const restored = JSON.parse(JSON.stringify(editorHistory[nextIndex]));
      setMediaFiles(prev => prev.map((m, idx) => idx === activeMediaIndex ? restored : m));
    }
  };

  const updateActiveMedia = (key, value, skipHistory = false) => {
    setMediaFiles(prev => {
      const nextList = prev.map((m, idx) => idx === activeMediaIndex ? { ...m, [key]: value } : m);
      if (!skipHistory) {
        pushEditorHistory(nextList[activeMediaIndex]);
      }
      return nextList;
    });
  };

  // Initialize history when opening Media Studio
  useEffect(() => {
    if (workspaceMode === 'mediastudio' && mediaFiles[activeMediaIndex]) {
      setEditorHistory([JSON.parse(JSON.stringify(mediaFiles[activeMediaIndex]))]);
      setEditorHistoryIndex(0);
    }
  }, [workspaceMode, activeMediaIndex]);

  // --- DRAWING CANVAS LOGIC ---
  useEffect(() => {
    if (editorTab === 'drawing' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Render existing drawings
      const activeImg = mediaFiles[activeMediaIndex];
      if (activeImg && activeImg.drawings && activeImg.drawings.length > 0) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = activeImg.drawings[activeImg.drawings.length - 1];
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [editorTab, activeMediaIndex, brushColor, brushSize]);

  const startDrawing = (e) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
  };

  const draw = (e) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL();
    
    const drawingsList = [...(mediaFiles[activeMediaIndex].drawings || []), dataUrl];
    updateActiveMedia('drawings', drawingsList);
  };

  // Canvas / Stickers / Text Drag Logic
  const handleCanvasMouseDown = (e) => {
    if (editorTab !== 'crop') {
      setSelectedTextId(null);
      return;
    }
    e.preventDefault();
    setIsDragging(true);
    const activeImage = mediaFiles[activeMediaIndex];
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      cropX: activeImage.cropX || 0,
      cropY: activeImage.cropY || 0
    };
  };

  const handleCanvasMouseMove = (e) => {
    const activeImage = mediaFiles[activeMediaIndex];
    if (!activeImage) return;

    if (activeCropHandle && mediaWrapperRef.current) {
      const dx = e.clientX - cropDragStartRef.current.x;
      const dy = e.clientY - cropDragStartRef.current.y;
      const rect = mediaWrapperRef.current.getBoundingClientRect();
      const percentDx = (dx / rect.width) * 100;
      const percentDy = (dy / rect.height) * 100;

      let newTop = cropDragStartRef.current.startTop;
      let newBottom = cropDragStartRef.current.startBottom;
      let newLeft = cropDragStartRef.current.startLeft;
      let newRight = cropDragStartRef.current.startRight;

      if (activeCropHandle.includes('t')) newTop = Math.max(0, Math.min(100 - newBottom - 5, newTop + percentDy));
      if (activeCropHandle.includes('b')) newBottom = Math.max(0, Math.min(100 - newTop - 5, newBottom - percentDy));
      if (activeCropHandle.includes('l')) newLeft = Math.max(0, Math.min(100 - newRight - 5, newLeft + percentDx));
      if (activeCropHandle.includes('r')) newRight = Math.max(0, Math.min(100 - newLeft - 5, newRight - percentDx));

      updateActiveMedia('cropTop', newTop, true);
      updateActiveMedia('cropBottom', newBottom, true);
      updateActiveMedia('cropLeft', newLeft, true);
      updateActiveMedia('cropRight', newRight, true);
    } else if (isDragging && editorTab === 'crop') {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      updateActiveMedia('cropX', dragStartRef.current.cropX + dx, true);
      updateActiveMedia('cropY', dragStartRef.current.cropY + dy, true);
    } else if (activeStickerDragId && mediaWrapperRef.current) {
      const dx = e.clientX - stickerDragStartRef.current.x;
      const dy = e.clientY - stickerDragStartRef.current.y;
      const rect = mediaWrapperRef.current.getBoundingClientRect();
      const percentDx = (dx / rect.width) * 100;
      const percentDy = (dy / rect.height) * 100;
      const list = activeImage.stickers.map(st => {
        if (st.id === activeStickerDragId) {
          return {
            ...st,
            x: stickerDragStartRef.current.startX + percentDx,
            y: stickerDragStartRef.current.startY + percentDy
          };
        }
        return st;
      });
      updateActiveMedia('stickers', list, true);
    } else if (activeTextDragId && mediaWrapperRef.current) {
      const dx = e.clientX - textDragStartRef.current.x;
      const dy = e.clientY - textDragStartRef.current.y;
      const rect = mediaWrapperRef.current.getBoundingClientRect();
      const percentDx = (dx / rect.width) * 100;
      const percentDy = (dy / rect.height) * 100;
      const list = activeImage.texts.map(t => {
        if (t.id === activeTextDragId) {
          return {
            ...t,
            x: textDragStartRef.current.startX + percentDx,
            y: textDragStartRef.current.startY + percentDy
          };
        }
        return t;
      });
      updateActiveMedia('texts', list, true);
    }
  };

  const handleCanvasMouseUp = () => {
    const activeImage = mediaFiles[activeMediaIndex];
    if (isDragging) {
      setIsDragging(false);
      if (activeImage) pushEditorHistory(activeImage);
    }
    if (activeStickerDragId) {
      setActiveStickerDragId(null);
      if (activeImage) pushEditorHistory(activeImage);
    }
    if (activeTextDragId) {
      setActiveTextDragId(null);
      if (activeImage) pushEditorHistory(activeImage);
    }
    if (activeCropHandle) {
      setActiveCropHandle(null);
      if (activeImage) pushEditorHistory(activeImage);
    }
  };

  const handleCanvasTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const activeImage = mediaFiles[activeMediaIndex];
    if (!activeImage) return;

    if (editorTab === 'crop') {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        cropX: activeImage.cropX || 0,
        cropY: activeImage.cropY || 0
      };
    }
  };

  const handleCanvasTouchMove = (e) => {
    if (e.touches.length !== 1) return;
    const activeImage = mediaFiles[activeMediaIndex];
    if (!activeImage) return;

    if (activeCropHandle && mediaWrapperRef.current) {
      const dx = e.touches[0].clientX - cropDragStartRef.current.x;
      const dy = e.touches[0].clientY - cropDragStartRef.current.y;
      const rect = mediaWrapperRef.current.getBoundingClientRect();
      const percentDx = (dx / rect.width) * 100;
      const percentDy = (dy / rect.height) * 100;

      let newTop = cropDragStartRef.current.startTop;
      let newBottom = cropDragStartRef.current.startBottom;
      let newLeft = cropDragStartRef.current.startLeft;
      let newRight = cropDragStartRef.current.startRight;

      if (activeCropHandle.includes('t')) newTop = Math.max(0, Math.min(100 - newBottom - 5, newTop + percentDy));
      if (activeCropHandle.includes('b')) newBottom = Math.max(0, Math.min(100 - newTop - 5, newBottom - percentDy));
      if (activeCropHandle.includes('l')) newLeft = Math.max(0, Math.min(100 - newRight - 5, newLeft + percentDx));
      if (activeCropHandle.includes('r')) newRight = Math.max(0, Math.min(100 - newLeft - 5, newRight - percentDx));

      updateActiveMedia('cropTop', newTop, true);
      updateActiveMedia('cropBottom', newBottom, true);
      updateActiveMedia('cropLeft', newLeft, true);
      updateActiveMedia('cropRight', newRight, true);
    } else if (isDragging && editorTab === 'crop') {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      updateActiveMedia('cropX', dragStartRef.current.cropX + dx, true);
      updateActiveMedia('cropY', dragStartRef.current.cropY + dy, true);
    } else if (activeStickerDragId && mediaWrapperRef.current) {
      const dx = e.touches[0].clientX - stickerDragStartRef.current.x;
      const dy = e.touches[0].clientY - stickerDragStartRef.current.y;
      const rect = mediaWrapperRef.current.getBoundingClientRect();
      const percentDx = (dx / rect.width) * 100;
      const percentDy = (dy / rect.height) * 100;
      const list = activeImage.stickers.map(st => {
        if (st.id === activeStickerDragId) {
          return {
            ...st,
            x: stickerDragStartRef.current.startX + percentDx,
            y: stickerDragStartRef.current.startY + percentDy
          };
        }
        return st;
      });
      updateActiveMedia('stickers', list, true);
    } else if (activeTextDragId && mediaWrapperRef.current) {
      const dx = e.touches[0].clientX - textDragStartRef.current.x;
      const dy = e.touches[0].clientY - textDragStartRef.current.y;
      const rect = mediaWrapperRef.current.getBoundingClientRect();
      const percentDx = (dx / rect.width) * 100;
      const percentDy = (dy / rect.height) * 100;
      const list = activeImage.texts.map(t => {
        if (t.id === activeTextDragId) {
          return {
            ...t,
            x: textDragStartRef.current.startX + percentDx,
            y: textDragStartRef.current.startY + percentDy
          };
        }
        return t;
      });
      updateActiveMedia('texts', list, true);
    }
  };

  const handleStickerMouseDown = (e, stickerId) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveStickerDragId(stickerId);
    const activeImage = mediaFiles[activeMediaIndex];
    const sticker = activeImage.stickers.find(st => st.id === stickerId);
    stickerDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: sticker.x,
      startY: sticker.y
    };
  };

  const handleStickerTouchStart = (e, stickerId) => {
    e.stopPropagation();
    setActiveStickerDragId(stickerId);
    const activeImage = mediaFiles[activeMediaIndex];
    const sticker = activeImage.stickers.find(st => st.id === stickerId);
    stickerDragStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      startX: sticker.x,
      startY: sticker.y
    };
  };

  const handleTextMouseDown = (e, textId) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveTextDragId(textId);
    const activeImage = mediaFiles[activeMediaIndex];
    const txt = activeImage.texts.find(t => t.id === textId);
    textDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: txt.x,
      startY: txt.y
    };
  };

  const handleTextTouchStart = (e, textId) => {
    e.stopPropagation();
    setActiveTextDragId(textId);
    const activeImage = mediaFiles[activeMediaIndex];
    const txt = activeImage.texts.find(t => t.id === textId);
    textDragStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      startX: txt.x,
      startY: txt.y
    };
  };

  const handleCropHandleMouseDown = (e, handlePos) => {
    e.stopPropagation();
    setActiveCropHandle(handlePos);
    const activeImage = mediaFiles[activeMediaIndex];
    cropDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startTop: activeImage.cropTop || 0,
      startBottom: activeImage.cropBottom || 0,
      startLeft: activeImage.cropLeft || 0,
      startRight: activeImage.cropRight || 0
    };
  };

  const handleCropHandleTouchStart = (e, handlePos) => {
    e.stopPropagation();
    setActiveCropHandle(handlePos);
    const activeImage = mediaFiles[activeMediaIndex];
    cropDragStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      startTop: activeImage.cropTop || 0,
      startBottom: activeImage.cropBottom || 0,
      startLeft: activeImage.cropLeft || 0,
      startRight: activeImage.cropRight || 0
    };
  };

  const removeSticker = (stickerId) => {
    const activeImage = mediaFiles[activeMediaIndex];
    const list = activeImage.stickers.filter(st => st.id !== stickerId);
    updateActiveMedia('stickers', list);
  };

  const removeText = (textId) => {
    const activeImage = mediaFiles[activeMediaIndex];
    const list = activeImage.texts.filter(t => t.id !== textId);
    updateActiveMedia('texts', list);
    if (selectedTextId === textId) {
      setSelectedTextId(null);
    }
  };

  const handleTextClick = (e, txt) => {
    e.stopPropagation();
    setSelectedTextId(txt.id);
    setFontText(txt.text);
    setFontFamily(txt.font);
    setFontSize(txt.size);
    setFontColor(txt.color);
    setFontBgMode(txt.bgMode || 'none');
    setIsFontBold(txt.bold || false);
    setIsFontItalic(txt.italic || false);
    setEditorTab('text');
  };

  const updateSelectedText = (key, value) => {
    if (!selectedTextId) return;
    const activeImage = mediaFiles[activeMediaIndex];
    if (!activeImage) return;
    const updated = (activeImage.texts || []).map(t => {
      if (t.id === selectedTextId) {
        return { ...t, [key]: value };
      }
      return t;
    });
    updateActiveMedia('texts', updated, true);
  };

  const addText = () => {
    if (!fontText.trim()) return;
    const activeImage = mediaFiles[activeMediaIndex];
    if (!activeImage) return;
    const newText = {
      id: Date.now().toString(),
      text: fontText,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
      color: fontColor,
      fontFamily: fontFamily,
      fontWeight: '600'
    };
    updateActiveMedia('texts', [...(activeImage.texts || []), newText], true);
    setSelectedTextId(newText.id);
  };

  const applyFormatting = (formatType) => {
    if (!textareaRef.current) return;
    textareaRef.current.focus();

    switch (formatType) {
      case 'bold':
        document.execCommand('bold', false);
        break;
      case 'italic':
        document.execCommand('italic', false);
        break;
      case 'underline':
        document.execCommand('underline', false);
        break;
      case 'list':
        document.execCommand('insertUnorderedList', false);
        break;
      case 'quote':
        document.execCommand('formatBlock', false, 'blockquote');
        break;
      case 'link':
        const url = prompt('Enter link URL:');
        if (url) {
          document.execCommand('createLink', false, url);
        }
        break;
      default:
        return;
    }

    setContent(textareaRef.current.innerHTML);
  };

  const searchMusic = async (query) => {
    if (!query.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=15&media=music`);
      if (res.ok) {
        const data = await res.json();
        const tracks = (data.results || []).map(item => ({
          id: item.trackId,
          title: item.trackName,
          artist: item.artistName,
          previewUrl: item.previewUrl,
          artwork: item.artworkUrl100 || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=150&h=150&q=80'
        }));
        setMusicSearchResults(tracks);
      }
    } catch (err) {
      console.error("Music search error:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const togglePlayPreview = (track) => {
    if (isPlayingPreview === track.previewUrl) {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      setIsPlayingPreview(null);
    } else {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      audioPreviewRef.current = new Audio(track.previewUrl);
      audioPreviewRef.current.play().catch(e => console.warn(e));
      setIsPlayingPreview(track.previewUrl);
      audioPreviewRef.current.onended = () => {
        setIsPlayingPreview(null);
      };
    }
  };

  const closeMusicModal = () => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }
    setIsPlayingPreview(null);
    setMusicModalOpen(false);
  };

  // --- DRAG & DROP HANDLERS ---
  const handleDragStart = (idx) => {
    setDraggedIndex(idx);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
  };

  const handleDrop = (idx) => {
    if (draggedIndex === null || draggedIndex === idx) return;
    const list = [...mediaFiles];
    const draggedItem = list[draggedIndex];
    list.splice(draggedIndex, 1);
    list.splice(idx, 0, draggedItem);
    setMediaFiles(list);
    setDraggedIndex(null);
  };

  // --- RENDER DYNAMIC WORKSPACE ---
  const renderActiveWorkspace = () => {
    switch (workspaceMode) {
      case 'mediastudio': {
        const activeImage = mediaFiles[activeMediaIndex] || {};
        // Styles specific to the Media Studio elements
        const effectFilter = activeImage.effect === 'VHS Blur' ? 'blur(2px) contrast(120%)' :
                             activeImage.effect === 'Warm Glow' ? 'sepia(40%) saturate(150%) brightness(110%)' :
                             activeImage.effect === 'Desaturate' ? 'grayscale(80%) contrast(110%)' : '';

        const filterStyle = (isBeforeActive ? '' : `brightness(${activeImage.brightness || 100}%) contrast(${activeImage.contrast || 100}%) saturate(${activeImage.saturation || 100}%) opacity(${activeImage.exposure || 100}%) ${
          activeImage.filter === 'B&W' ? 'grayscale(100%)' : 
          activeImage.filter === 'Warm' ? 'sepia(30%) hue-rotate(15deg)' : 
          activeImage.filter === 'Cool' ? 'saturate(110%) hue-rotate(-15deg)' : 
          activeImage.filter === 'Sepia' ? 'sepia(80%)' :
          activeImage.filter === 'Vintage' ? 'sepia(50%) contrast(85%) brightness(95%)' :
          activeImage.filter === 'Cyberpunk' ? 'hue-rotate(60deg) saturate(160%)' :
          activeImage.filter === 'Dreamy' ? 'blur(0.5px) saturate(120%) brightness(105%)' : ''
        }`) + ' ' + effectFilter;
        
        const transformStyle = isBeforeActive ? 'none' : `translate(${activeImage.cropX || 0}px, ${activeImage.cropY || 0}px) scale(${activeImage.cropZoom || 1}) rotate(${activeImage.rotation || 0}deg) scaleX(${activeImage.flipH ? -1 : (activeImage.scaleX || 1)}) scaleY(${activeImage.flipV ? -1 : (activeImage.scaleY || 1)})`;

        const objectFitStyle = (activeImage.cropRatio && activeImage.cropRatio !== 'Free' && activeImage.cropRatio !== 'original') ? 'cover' : 'contain';
        
        let wrapperStyle = {};
        if (activeImage.cropRatio === '1:1') {
          wrapperStyle = { aspectRatio: '1 / 1', height: '100%', maxWidth: '100%', maxHeight: '100%' };
        } else if (activeImage.cropRatio === '4:5') {
          wrapperStyle = { aspectRatio: '4 / 5', height: '100%', maxWidth: '100%', maxHeight: '100%' };
        } else if (activeImage.cropRatio === '16:9') {
          wrapperStyle = { aspectRatio: '16 / 9', width: '100%', maxWidth: '100%', maxHeight: '100%' };
        } else if (activeImage.cropRatio === '9:16') {
          wrapperStyle = { aspectRatio: '9 / 16', height: '100%', maxWidth: '100%', maxHeight: '100%' };
        } else {
          wrapperStyle = { width: '100%', height: '100%' };
        }

        let frameStyle = {};
        if (activeImage.frame === 'White Classic') {
          frameStyle = { border: '12px solid #ffffff', boxSizing: 'border-box' };
        } else if (activeImage.frame === 'Polaroid') {
          frameStyle = { border: '10px solid #fefefa', borderBottom: '28px solid #fefefa', boxSizing: 'border-box' };
        } else if (activeImage.frame === 'Film') {
          frameStyle = { border: '12px solid #111111', boxSizing: 'border-box' };
        } else if (activeImage.frame === 'Neon Glow') {
          frameStyle = { border: '4px solid #ff00ff', boxShadow: '0 0 15px #ff00ff, inset 0 0 15px #ff00ff', boxSizing: 'border-box' };
        }

        const hasCustomCrop = activeImage.cropTop > 0 || activeImage.cropBottom > 0 || activeImage.cropLeft > 0 || activeImage.cropRight > 0;
        const wrapperCombinedStyle = {
          ...wrapperStyle,
          ...frameStyle,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: activeImage.frame === 'None' || !activeImage.frame ? '12px' : '0px',
          background: 'transparent',
          transition: 'width 0.2s ease, height 0.2s ease',
          ...((activeImage.cropRatio === 'Custom' || (editorTab !== 'crop' && activeImage.cropRatio === 'Free')) && hasCustomCrop ? {
            clipPath: `inset(${activeImage.cropTop || 0}% ${activeImage.cropRight || 0}% ${activeImage.cropBottom || 0}% ${activeImage.cropLeft || 0}%)`
          } : {})
        };

        return (
          <div className="hubble-sub-workspace">
            {/* Top Bar */}
            <div className="hubble-sub-header">
              <div className="hubble-sub-title-group" style={{ flex: 1 }}>
                <button onClick={() => setWorkspaceMode('editor')} className="hubble-circle-btn" style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
                  <ArrowLeft size={14} />
                </button>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#fff' }}>Media Studio</h3>
              </div>
              <div className="hubble-header-center" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button onClick={() => {
                  updateActiveMedia('brightness', 100);
                  updateActiveMedia('contrast', 100);
                  updateActiveMedia('saturation', 100);
                  updateActiveMedia('exposure', 100);
                  updateActiveMedia('filter', 'Original');
                  updateActiveMedia('cropRatio', 'original');
                  updateActiveMedia('cropX', 0);
                  updateActiveMedia('cropY', 0);
                  updateActiveMedia('cropZoom', 1);
                  updateActiveMedia('effect', 'None');
                  updateActiveMedia('frame', 'None');
                  updateActiveMedia('stickers', []);
                  updateActiveMedia('texts', []);
                }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '12px', cursor: 'pointer', padding: '4px 12px', borderRadius: '12px' }}>Reset</button>
                <button onClick={handleUndo} disabled={editorHistoryIndex <= 0} className="hubble-circle-btn-sm"><Undo2 size={11} /></button>
                <button onClick={handleRedo} disabled={editorHistoryIndex >= editorHistory.length - 1} className="hubble-circle-btn-sm"><Redo2 size={11} /></button>
              </div>
              <div className="hubble-header-actions" style={{ flex: 1, justifyContent: 'flex-end' }}>
                <button onClick={() => setWorkspaceMode('editor')} className="hubble-btn-primary" style={{ background: 'linear-gradient(135deg, #7C3BFF 0%, #5b2cd3 100%)', boxShadow: '0 4px 15px rgba(108, 59, 255, 0.4)', borderRadius: '24px', padding: '8px 24px', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                  Apply
                </button>
              </div>
            </div>

            {/* Main Editing Area - 3 Columns */}
            <div 
              className="hubble-mediastudio-layout" 
              style={{ display: "flex", flexDirection: "row", width: "100%", flex: 1, minHeight: 0, background: "#0a0a0a", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onTouchMove={handleCanvasTouchMove}
              onTouchEnd={handleCanvasMouseUp}
            >
              {/* LEFT: TOOLS */}
              <div className="hubble-mediastudio-tools-left" style={{ width: "80px", minWidth: "80px", background: "#121212", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: "12px", borderRight: "1px solid rgba(255,255,255,0.1)", overflowY: "auto", zIndex: 10 }}>
                <button onClick={() => setEditorTab('crop')} className={`hubble-tool-btn ${editorTab === 'crop' ? 'active' : ''}`}><Bold size={16} /><span>Crop</span></button>
                <button onClick={() => setEditorTab('filters')} className={`hubble-tool-btn ${editorTab === 'filters' ? 'active' : ''}`}><Sparkles size={16} /><span>Filters</span></button>
                <button onClick={() => setEditorTab('adjust')} className={`hubble-tool-btn ${editorTab === 'adjust' ? 'active' : ''}`}><Clock size={16} /><span>Adjust</span></button>
                <button onClick={() => setEditorTab('rotate')} className={`hubble-tool-btn ${editorTab === 'rotate' ? 'active' : ''}`}><RotateCw size={16} /><span>Rotate</span></button>
                <button onClick={() => setEditorTab('effects')} className={`hubble-tool-btn ${editorTab === 'effects' ? 'active' : ''}`}><ImageIcon size={16} /><span>Effects</span></button>
                <button onClick={() => setEditorTab('stickers')} className={`hubble-tool-btn ${editorTab === 'stickers' ? 'active' : ''}`}><Heart size={16} /><span>Stickers</span></button>
                <button onClick={() => setEditorTab('text')} className={`hubble-tool-btn ${editorTab === 'text' ? 'active' : ''}`}><Type size={16} /><span>Text</span></button>
                <button onClick={() => setEditorTab('frames')} className={`hubble-tool-btn ${editorTab === 'frames' ? 'active' : ''}`}><Tablet size={16} /><span>Frames</span></button>
              </div>

              {/* CENTER: CANVAS */}
              <div className="hubble-mediastudio-canvas-wrapper" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#000000", position: "relative", overflow: "hidden", padding: "0px" }}>
                {mediaFiles.length > 0 ? (
                  <div 
                    ref={mediaWrapperRef}
                    style={wrapperCombinedStyle}
                    onMouseDown={handleCanvasMouseDown}
                    onTouchStart={handleCanvasTouchStart}
                  >
                    {activeImage.type === 'video' ? (
                      <video 
                        src={activeImage.previewUrl} 
                        className="hubble-editor-media"
                        style={{ filter: filterStyle, transform: transformStyle, cursor: editorTab === 'crop' ? 'move' : 'default', width: '100%', height: '100%', objectFit: objectFitStyle }}
                        controls autoPlay muted loop playsInline
                      />
                    ) : (
                      <img 
                        src={activeImage.previewUrl} 
                        alt="Active Editor"
                        className="hubble-editor-media"
                        style={{ filter: filterStyle, transform: transformStyle, cursor: editorTab === 'crop' ? 'move' : 'default', width: '100%', height: '100%', objectFit: objectFitStyle }}
                      />
                    )}
                    {/* Vignette Overlay for Vignette Effect */}
                    {activeImage.effect === 'Vignette' && (
                      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 80px rgba(0,0,0,0.75)', pointerEvents: 'none', zIndex: 9 }} />
                    )}
                    {/* Film Frame Sprockets */}
                    {activeImage.frame === 'Film' && (
                      <div style={{ position: 'absolute', left: '2px', top: 0, bottom: 0, width: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', zIndex: 8, pointerEvents: 'none' }}>
                        {[1,2,3,4,5,6].map(i => <div key={i} style={{ width: '100%', height: '12px', background: 'white', borderRadius: '2px' }} />)}
                      </div>
                    )}
                    {/* Stickers */}
                    {(activeImage.stickers || []).map((stk) => (
                      <div key={stk.id} 
                        onMouseDown={(e) => { if (editorTab === 'stickers') handleStickerMouseDown(e, stk.id); }}
                        onTouchStart={(e) => { if (editorTab === 'stickers') handleStickerTouchStart(e, stk.id); }}
                        style={{ position: 'absolute', left: `${stk.x}%`, top: `${stk.y}%`, fontSize: `${stk.scale * 40}px`, transform: `translate(-50%, -50%) rotate(${stk.rotation || 0}deg)`, cursor: editorTab === 'stickers' ? 'move' : 'default', userSelect: 'none', zIndex: 10 }}>
                        {stk.emoji}
                        {editorTab === 'stickers' && (
                          <div style={{ position: 'absolute', right: '-10px', top: '-10px', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '2px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); updateActiveMedia('stickers', (activeImage.stickers || []).filter(s => s.id !== stk.id)); }}>
                            <X size={10} color="#fff" />
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Texts */}
                    {(activeImage.texts || []).map((txt) => (
                      <div key={txt.id} 
                        onMouseDown={(e) => { if (editorTab === 'text') handleTextMouseDown(e, txt.id); }}
                        onTouchStart={(e) => { if (editorTab === 'text') handleTextTouchStart(e, txt.id); }}
                        onClick={(e) => {
                          if (editorTab === 'text') {
                            e.stopPropagation();
                            setSelectedTextId(txt.id);
                            setFontText(txt.text);
                            if (txt.fontFamily) setFontFamily(txt.fontFamily);
                            if (txt.color) setFontColor(txt.color);
                          }
                        }}
                        style={{ 
                          position: 'absolute', 
                          left: `${txt.x}%`, 
                          top: `${txt.y}%`, 
                          fontSize: `${txt.scale * 20}px`, 
                          color: txt.color, 
                          fontFamily: txt.fontFamily, 
                          fontWeight: txt.fontWeight, 
                          transform: `translate(-50%, -50%) rotate(${txt.rotation || 0}deg)`, 
                          cursor: editorTab === 'text' ? 'pointer' : 'default', 
                          userSelect: 'none', 
                          whiteSpace: 'nowrap', 
                          zIndex: 11, 
                          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                          border: editorTab === 'text' && selectedTextId === txt.id ? '1px dashed rgba(255,255,255,0.8)' : 'none',
                          padding: '4px'
                        }}
                      >
                        {txt.text}
                        {editorTab === 'text' && (
                          <div 
                            style={{ 
                              position: 'absolute', 
                              right: '-15px', 
                              top: '-15px', 
                              background: 'rgba(255,59,48,0.9)', 
                              borderRadius: '50%', 
                              padding: '4px', 
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 12
                            }} 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              updateActiveMedia('texts', (activeImage.texts || []).filter(t => t.id !== txt.id), true); 
                              if (selectedTextId === txt.id) setSelectedTextId(null);
                            }}
                          >
                            <X size={12} color="#fff" />
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Crop Overlay */}
                    {editorTab === 'crop' && activeImage.cropRatio === 'Free' && (
                      <div className="hubble-crop-overlay" style={{ position: 'absolute', top: `${activeImage.cropTop || 0}%`, bottom: `${activeImage.cropBottom || 0}%`, left: `${activeImage.cropLeft || 0}%`, right: `${activeImage.cropRight || 0}%`, border: '2px dashed white', zIndex: 20 }}>
                        <div className="hubble-crop-handle hubble-crop-handle-tl" onMouseDown={(e) => handleCropHandleMouseDown(e, 'tl')} onTouchStart={(e) => handleCropHandleTouchStart(e, 'tl')} />
                        <div className="hubble-crop-handle hubble-crop-handle-tc" onMouseDown={(e) => handleCropHandleMouseDown(e, 't')} onTouchStart={(e) => handleCropHandleTouchStart(e, 't')} />
                        <div className="hubble-crop-handle hubble-crop-handle-tr" onMouseDown={(e) => handleCropHandleMouseDown(e, 'tr')} onTouchStart={(e) => handleCropHandleTouchStart(e, 'tr')} />
                        <div className="hubble-crop-handle hubble-crop-handle-ml" onMouseDown={(e) => handleCropHandleMouseDown(e, 'l')} onTouchStart={(e) => handleCropHandleTouchStart(e, 'l')} />
                        <div className="hubble-crop-handle hubble-crop-handle-mr" onMouseDown={(e) => handleCropHandleMouseDown(e, 'r')} onTouchStart={(e) => handleCropHandleTouchStart(e, 'r')} />
                        <div className="hubble-crop-handle hubble-crop-handle-bl" onMouseDown={(e) => handleCropHandleMouseDown(e, 'bl')} onTouchStart={(e) => handleCropHandleTouchStart(e, 'bl')} />
                        <div className="hubble-crop-handle hubble-crop-handle-bc" onMouseDown={(e) => handleCropHandleMouseDown(e, 'b')} onTouchStart={(e) => handleCropHandleTouchStart(e, 'b')} />
                        <div className="hubble-crop-handle hubble-crop-handle-br" onMouseDown={(e) => handleCropHandleMouseDown(e, 'br')} onTouchStart={(e) => handleCropHandleTouchStart(e, 'br')} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: '#fff', fontSize: '14px', opacity: 0.5 }}>No media selected</div>
                )}
              </div>

              {/* RIGHT: PROPERTIES */}
              <div className="hubble-mediastudio-properties-right" style={{ width: "320px", minWidth: "320px", background: "#121212", borderLeft: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", overflowY: "auto", zIndex: 10 }}>
                {editorTab === 'crop' && (
                  <div className="hubble-properties-panel">
                    <h4>Aspect Ratio</h4>
                    <div className="hubble-aspect-pills-row">
                      {['1:1', '4:5', '16:9', '9:16', 'Free'].map((ratio) => {
                        const isActive = activeImage.cropRatio === ratio || (ratio === 'Free' && activeImage.cropRatio === 'Custom');
                        return (
                          <button key={ratio} type="button" onClick={() => updateActiveMedia('cropRatio', ratio)} className={`hubble-aspect-pill ${isActive ? 'active' : ''}`} style={{ background: isActive ? 'rgba(108, 59, 255, 0.25)' : 'rgba(255,255,255,0.03)' }}>
                            {ratio}
                          </button>
                        );
                      })}
                    </div>
                    
                    {activeImage.cropRatio === 'Free' && (
                      <button 
                        className="hubble-btn-primary" 
                        style={{ width: '100%', marginBottom: '16px', padding: '10px' }}
                        onClick={() => updateActiveMedia('cropRatio', 'Custom')}
                      >
                        Done Cropping
                      </button>
                    )}

                    <h4>Flip</h4>
                      <div className="hubble-aspect-pills-row">
                        <button type="button" onClick={() => updateActiveMedia('flipH', !activeImage.flipH)} className={`hubble-aspect-pill ${activeImage.flipH ? 'active' : ''}`}>Flip H</button>
                        <button type="button" onClick={() => updateActiveMedia('flipV', !activeImage.flipV)} className={`hubble-aspect-pill ${activeImage.flipV ? 'active' : ''}`}>Flip V</button>
                      </div>
                    <h4 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Zoom</span>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', fontWeight: '500', textTransform: 'none' }}>
                        {Math.round(((activeImage.cropZoom || 1) - 1) / 2 * 100)}%
                      </span>
                    </h4>
                    <div className="hubble-properties-slider">
                      <input type="range" min="1" max="3" step="0.01" value={activeImage.cropZoom || 1} onChange={(e) => updateActiveMedia('cropZoom', parseFloat(e.target.value))} className="hubble-slider" />
                    </div>
                  </div>
                )}

                {editorTab === 'filters' && (
                  <div className="hubble-properties-panel">
                    <h4>Filters</h4>
                    <div className="hubble-properties-grid">
                      {['Original', 'Warm', 'Cool', 'B&W', 'Sepia', 'Vintage'].map((filt) => (
                        <button key={filt} onClick={() => updateActiveMedia('filter', filt)} className={`hubble-filter-card-btn ${activeImage.filter === filt ? 'active' : ''}`}>
                          <div className="filter-card-preview-circle" style={{ 
                            backgroundImage: `url(${activeImage.previewUrl})`,
                            filter: filt === 'B&W' ? 'grayscale(100%)' : filt === 'Warm' ? 'sepia(30%) hue-rotate(15deg)' : filt === 'Cool' ? 'saturate(110%) hue-rotate(-15deg)' : filt === 'Sepia' ? 'sepia(100%)' : filt === 'Vintage' ? 'sepia(50%) hue-rotate(-30deg) saturate(140%) contrast(120%)' : 'none'
                          }} />
                          <span>{filt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {editorTab === 'adjust' && (
                  <div className="hubble-properties-panel">
                    <h4>Adjustments</h4>
                    <div className="hubble-slider-col">
                      <div className="hubble-slider-labels"><span>Brightness</span><span>{activeImage.brightness || 100}%</span></div>
                      <input type="range" min="50" max="150" value={activeImage.brightness || 100} onChange={(e) => updateActiveMedia('brightness', parseInt(e.target.value))} className="hubble-slider" />
                    </div>
                    <div className="hubble-slider-col">
                      <div className="hubble-slider-labels"><span>Contrast</span><span>{activeImage.contrast || 100}%</span></div>
                      <input type="range" min="50" max="150" value={activeImage.contrast || 100} onChange={(e) => updateActiveMedia('contrast', parseInt(e.target.value))} className="hubble-slider" />
                    </div>
                    <div className="hubble-slider-col">
                      <div className="hubble-slider-labels"><span>Saturation</span><span>{activeImage.saturation || 100}%</span></div>
                      <input type="range" min="0" max="200" value={activeImage.saturation || 100} onChange={(e) => updateActiveMedia('saturation', parseInt(e.target.value))} className="hubble-slider" />
                    </div>
                    <div className="hubble-slider-col">
                      <div className="hubble-slider-labels"><span>Exposure</span><span>{activeImage.exposure || 100}%</span></div>
                      <input type="range" min="50" max="150" value={activeImage.exposure || 100} onChange={(e) => updateActiveMedia('exposure', parseInt(e.target.value))} className="hubble-slider" />
                    </div>
                  </div>
                )}

                {editorTab === 'rotate' && (
                  <div className="hubble-properties-panel">
                    <h4>Rotate</h4>
                    <button onClick={() => updateActiveMedia('rotation', ((activeImage.rotation || 0) + 90) % 360)} className="hubble-btn-secondary" style={{ width: '100%', padding: '12px' }}>
                      <RotateCw size={16} style={{ marginRight: '8px' }} /> Rotate 90°
                    </button>
                  </div>
                )}

                {editorTab === 'effects' && (
                  <div className="hubble-properties-panel">
                    <h4>Effects</h4>
                    <div className="hubble-properties-list">
                      {['None', 'Vignette', 'VHS Blur', 'Warm Glow', 'Desaturate'].map((eff) => (
                        <button key={eff} onClick={() => updateActiveMedia('effect', eff)} className={`hubble-aspect-pill ${activeImage.effect === eff ? 'active' : ''}`} style={{ width: '100%', padding: '10px' }}>
                          {eff}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {editorTab === 'stickers' && (
                  <div className="hubble-properties-panel">
                    <h4>Stickers</h4>
                    <div className="hubble-stickers-presets-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                      {['✨', '🔥', '💖', '🎉', '🌟', '👀', '💯', '🚀', '💡', '🏆', '⭐', '🎈'].map((emoji) => (
                        <button key={emoji} onClick={() => {
                            const list = [...(activeImage.stickers || [])];
                            list.push({ id: Date.now(), emoji, x: 50, y: 50, scale: 1, rotation: 0 });
                            updateActiveMedia('stickers', list);
                          }} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', fontSize: '24px', padding: '10px', cursor: 'pointer' }}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {editorTab === 'text' && (
                  <div className="hubble-properties-panel">
                    <h4>Text Overlay</h4>
                    <input type="text" value={fontText} onChange={(e) => { setFontText(e.target.value); updateSelectedText('text', e.target.value); }} placeholder="Type text overlay..." className="hubble-workspace-input" style={{ width: '100%', padding: '10px', marginBottom: '10px' }} />
                    <button onClick={addText} className="hubble-btn-secondary" style={{ width: '100%', padding: '10px', marginBottom: '10px' }}><Plus size={12} /> Add Text</button>
                    {selectedTextId && (
                      <button onClick={() => removeText(selectedTextId)} className="hubble-btn-secondary" style={{ width: '100%', padding: '10px', marginBottom: '20px', background: 'rgba(255,59,48,0.1)', color: '#ff3b30', borderColor: 'rgba(255,59,48,0.2)' }}><X size={12} /> Delete Selected Text</button>
                    )}
                    
                    <h4>Font</h4>
                    <select value={fontFamily} onChange={(e) => { setFontFamily(e.target.value); updateSelectedText('fontFamily', e.target.value); }} className="hubble-workspace-input" style={{ width: '100%', padding: '10px', marginBottom: '10px', color: '#fff', background: '#1e1b30' }}>
                      <option value="Inter, sans-serif">Inter</option>
                      <option value="Roboto, sans-serif">Roboto</option>
                      <option value="Playfair Display, serif">Playfair Display</option>
                      <option value="Monaco, monospace">Monaco</option>
                    </select>

                    <h4>Color</h4>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {['#ffffff', '#000000', '#ff3b30', '#4cd964', '#007aff', '#ffcc00'].map(color => (
                        <button key={color} onClick={() => { setFontColor(color); updateSelectedText('color', color); }} style={{ width: '24px', height: '24px', borderRadius: '50%', background: color, border: fontColor === color ? '2px solid #6C3BFF' : '2px solid transparent', cursor: 'pointer' }} />
                      ))}
                    </div>
                  </div>
                )}

                {editorTab === 'frames' && (
                  <div className="hubble-properties-panel">
                    <h4>Frames</h4>
                    <div className="hubble-properties-list">
                      {['None', 'White Classic', 'Polaroid', 'Film', 'Neon Glow'].map((frm) => (
                        <button key={frm} onClick={() => updateActiveMedia('frame', frm)} className={`hubble-aspect-pill ${activeImage.frame === frm ? 'active' : ''}`} style={{ width: '100%', padding: '10px' }}>
                          {frm}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Thumbnails Strip */}
            <div className="hubble-mediastudio-bottom-strip">
              <button onClick={() => fileInputRef.current?.click()} className="hubble-add-thumbnail-btn">
                <Plus size={16} />
              </button>
              {mediaFiles.map((media, idx) => (
                <div key={media.id} onClick={() => setActiveMediaIndex(idx)} className={`hubble-thumbnail-item ${idx === activeMediaIndex ? 'active' : ''}`}>
                  {media.type === 'video' ? (
                    <video src={media.previewUrl} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={media.previewUrl} alt="Thumb" />
                  )}
                  <button onClick={(e) => { e.stopPropagation(); removeMedia(media.id); }} className="hubble-thumb-delete"><X size={10} /></button>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'audience':
        return (
          <div className="hubble-sub-workspace">
            <div className="hubble-sub-header hubble-audience-header">
              <div className="hubble-sub-title-group" style={{ alignItems: 'flex-start' }}>
                <button onClick={() => setWorkspaceMode('editor')} className="hubble-circle-btn" style={{ marginTop: '2px' }}>
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h3>Audience</h3>
                  <p>Choose who can see this</p>
                </div>
              </div>
              <button onClick={() => setWorkspaceMode('editor')} className="hubble-btn-primary">Done</button>
            </div>

            <div className="hubble-audience-layout">
              <div className="hubble-audience-list">
                {[
                  { name: 'Public', desc: 'Anyone on or off HiHUBBLE' },
                  { name: 'Friends', desc: 'Only your friends' },
                  { name: 'Close Friends', desc: 'People in your close list' },
                  { name: 'Private', desc: 'Only me' },
                  { name: 'Custom', desc: 'Choose specific people' }
                ].map((opt) => (
                  <button
                    key={opt.name}
                    onClick={() => setAudience(opt.name)}
                    className={`hubble-option-row ${audience === opt.name ? 'active' : ''}`}
                  >
                    <div className="hubble-radio-dot">
                      {audience === opt.name && <div className="hubble-radio-inner" />}
                    </div>
                    <div>
                      <strong>{opt.name}</strong>
                      <p>{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Simulated Globe Illustration */}
              <div className="hubble-globe-visual">
                <div className="hubble-globe-circle">
                  <div className="globe-sphere" />
                  <div className="hubble-avatar-float g1"><img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=80&h=80&q=80" /></div>
                  <div className="hubble-avatar-float g2"><img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=80&h=80&q=80" /></div>
                  <div className="hubble-avatar-float g3"><img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&h=80&q=80" /></div>
                  <div className="hubble-avatar-float g4"><img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=80&h=80&q=80" /></div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'schedule':
        return (
          <div className="hubble-sub-workspace" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 0 }}>
            <div className="hubble-schedule-header">
              <div className="hubble-sub-title-group">
                <button onClick={() => setWorkspaceMode('editor')} className="hubble-circle-btn">
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h3>Schedule Post</h3>
                  <p>Pick date & time to post</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  if (isScheduled && !scheduleTime.includes('Today') && !scheduleTime.includes('Tomorrow')) {
                    setScheduleTime(`Aug ${scheduleDate}, ${scheduleHour}:${scheduleMinute} ${schedulePeriod}`);
                  }
                  setWorkspaceMode('editor');
                }} 
                className="hubble-btn-primary"
              >
                Done
              </button>
            </div>

            <div className="hubble-schedule-layout">
              {/* Options on Left */}
              <div className="hubble-schedule-presets">
                <button onClick={() => { setIsScheduled(false); setWorkspaceMode('editor'); }} className={`hubble-option-row ${!isScheduled ? 'active' : ''}`}>
                  <div>
                    <strong>Post Now</strong>
                    <p>Share now</p>
                  </div>
                </button>
                <button onClick={() => { setIsScheduled(true); setScheduleTime('Later Today, 8:00 PM'); }} className={`hubble-option-row ${isScheduled && scheduleTime.includes('Later Today') ? 'active' : ''}`}>
                  <div>
                    <strong>Later Today</strong>
                    <p>Today, 8:00 PM</p>
                  </div>
                </button>
                <button onClick={() => { setIsScheduled(true); setScheduleTime('Tomorrow, 9:00 AM'); }} className={`hubble-option-row ${isScheduled && scheduleTime.includes('Tomorrow') ? 'active' : ''}`}>
                  <div>
                    <strong>Tomorrow</strong>
                    <p>Tomorrow, 9:00 AM</p>
                  </div>
                </button>
                <button onClick={() => { setIsScheduled(true); setScheduleTime(`Aug ${scheduleDate}, ${scheduleHour}:${scheduleMinute} ${schedulePeriod}`); }} className={`hubble-option-row ${isScheduled && !scheduleTime.includes('Later Today') && !scheduleTime.includes('Tomorrow') ? 'active' : ''}`}>
                  <div>
                    <strong>Custom Date & Time</strong>
                    <p>Pick a date and time</p>
                  </div>
                </button>
              </div>

              {/* Calendar on Right */}
              <div className="hubble-schedule-calendar-col">
                <div className="hubble-calendar-mock" style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px' }}>
                  <div className="hubble-cal-header" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span style={{ cursor: 'pointer' }}>◀</span>
                    <strong style={{ fontSize: '14px' }}>August 2026</strong>
                    <span style={{ cursor: 'pointer' }}>▶</span>
                  </div>
                  <div className="hubble-cal-days">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <span key={d} className="cal-label">{d}</span>)}
                    {[...Array(6)].map((_, i) => <span key={`empty-${i}`} />)}
                    {[...Array(31)].map((_, i) => {
                      const dayNum = i + 1;
                      return (
                        <button 
                          key={i} 
                          onClick={() => { 
                            setIsScheduled(true); 
                            setScheduleDate(dayNum); 
                            setScheduleTime(`Aug ${dayNum}, ${scheduleHour}:${scheduleMinute} ${schedulePeriod}`); 
                          }}
                          className={`cal-day-cell ${scheduleDate === dayNum && isScheduled && !scheduleTime.includes('Today') && !scheduleTime.includes('Tomorrow') ? 'active' : ''}`}
                        >
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="hubble-time-picker" style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
                  <select value={scheduleHour} onChange={e => {
                    setScheduleHour(e.target.value);
                    if (isScheduled && !scheduleTime.includes('Today') && !scheduleTime.includes('Tomorrow')) {
                      setScheduleTime(`Aug ${scheduleDate}, ${e.target.value}:${scheduleMinute} ${schedulePeriod}`);
                    }
                  }} className="hubble-time-select" style={{ background: '#1e1b30', color: '#fff', border: 'none', padding: '8px', borderRadius: '8px' }}>
                    {['01','02','03','04','05','06','07','08','09','10','11','12'].map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <span style={{ alignSelf: 'center', fontWeight: 'bold' }}>:</span>
                  <select value={scheduleMinute} onChange={e => {
                    setScheduleMinute(e.target.value);
                    if (isScheduled && !scheduleTime.includes('Today') && !scheduleTime.includes('Tomorrow')) {
                      setScheduleTime(`Aug ${scheduleDate}, ${scheduleHour}:${e.target.value} ${schedulePeriod}`);
                    }
                  }} className="hubble-time-select" style={{ background: '#1e1b30', color: '#fff', border: 'none', padding: '8px', borderRadius: '8px' }}>
                    {['00','15','30','45'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={schedulePeriod} onChange={e => {
                    setSchedulePeriod(e.target.value);
                    if (isScheduled && !scheduleTime.includes('Today') && !scheduleTime.includes('Tomorrow')) {
                      setScheduleTime(`Aug ${scheduleDate}, ${scheduleHour}:${scheduleMinute} ${e.target.value}`);
                    }
                  }} className="hubble-time-select" style={{ background: '#1e1b30', color: '#fff', border: 'none', padding: '8px', borderRadius: '8px' }}>
                    {['AM','PM'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        );

      case 'location':
        return (
          <div className="hubble-sub-workspace" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="hubble-sub-header">
              <div className="hubble-sub-title-group">
                <button onClick={() => setWorkspaceMode('editor')} className="hubble-circle-btn">
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h3>Location</h3>
                  <p>Add location to your vibe</p>
                </div>
              </div>
              <button onClick={() => setWorkspaceMode('editor')} className="hubble-btn-primary">Done</button>
            </div>

            <div className="hubble-location-content" style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
              {/* Search Input with Spinner */}
              <div style={{ position: 'relative', width: '100%' }}>
                <input 
                  type="text" 
                  placeholder="Search location..." 
                  value={tempLocationSearch}
                  onChange={(e) => setTempLocationSearch(e.target.value)}
                  className="hubble-workspace-input"
                  style={{ width: '100%', paddingRight: '36px', boxSizing: 'border-box' }}
                />
                {locationLoading && (
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                    <RefreshCw size={14} className="hubble-spin" style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                  </div>
                )}
              </div>

              {/* Geocoding Search Results */}
              {locationResults.length > 0 && (
                <div className="hubble-location-search-results" style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '6px', marginTop: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                  {locationResults.map((place, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => {
                        setLocation(place.name);
                        setMapCoords({ lat: place.lat, lon: place.lon });
                        setLocationResults([]);
                        setTempLocationSearch('');
                      }} 
                      className="hubble-location-item"
                      style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '8px', boxSizing: 'border-box' }}
                    >
                      <MapPin size={14} style={{ flexShrink: 0, color: '#7C3BFF' }} />
                      <span style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Map Preview - Live OSM Embed (Premium Dark Filtered) */}
              <div className="hubble-map-preview-wrapper" style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', marginTop: '12px', height: '180px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', width: '100%' }}>
                <iframe 
                  width="100%" 
                  height="100%" 
                  frameBorder="0" 
                  scrolling="no" 
                  marginHeight="0" 
                  marginWidth="0" 
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(mapCoords.lon) - 0.015}%2C${parseFloat(mapCoords.lat) - 0.01}%2C${parseFloat(mapCoords.lon) + 0.015}%2C${parseFloat(mapCoords.lat) + 0.01}&layer=mapnik&marker=${mapCoords.lat}%2C${mapCoords.lon}`}
                  style={{ filter: 'invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)', pointerEvents: 'none', border: 'none' }}
                />
                <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)', padding: '10px 14px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: '10px', boxSizing: 'border-box' }}>
                  <MapPin size={16} style={{ color: '#7C3BFF', flexShrink: 0 }} />
                  <div style={{ overflow: 'hidden' }}>
                    <strong style={{ display: 'block', fontSize: '11px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location}</strong>
                    <p style={{ margin: 0, fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{parseFloat(mapCoords.lat).toFixed(4)}° N, {parseFloat(mapCoords.lon).toFixed(4)}° E</p>
                  </div>
                </div>
              </div>

              {/* Recent Locations List */}
              <div className="hubble-location-recent" style={{ marginTop: '14px' }}>
                <strong style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '6px', display: 'block' }}>Recent</strong>
                <div className="hubble-location-recent-list">
                  {[
                    { name: 'Hyderabad, India', lat: '17.3850', lon: '78.4867' },
                    { name: 'Secunderabad, India', lat: '17.4399', lon: '78.4983' },
                    { name: 'Hitech City, Hyderabad', lat: '17.4483', lon: '78.3741' },
                    { name: 'Banjara Hills, Hyderabad', lat: '17.4156', lon: '78.4418' }
                  ].map(loc => (
                    <button 
                      key={loc.name} 
                      onClick={() => {
                        setLocation(loc.name);
                        setMapCoords({ lat: loc.lat, lon: loc.lon });
                      }} 
                      className={`hubble-location-item ${location === loc.name ? 'active' : ''}`}
                    >
                      <MapPin size={14} style={{ flexShrink: 0 }} />
                      <span>{loc.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'topics':
        const trendingTags = ['#sunset', '#travel', '#photography', '#nature', '#music', '#food', '#gaming', '#art', '#motivation', '#memes', '#adventure'];
        return (
          <div className="hubble-sub-workspace">
            <div className="hubble-sub-header">
              <div className="hubble-sub-title-group">
                <button onClick={() => setWorkspaceMode('editor')} className="hubble-circle-btn">
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h3>Topics</h3>
                  <p>Add topics or hashtags</p>
                </div>
              </div>
              <button onClick={() => setWorkspaceMode('editor')} className="hubble-btn-primary">Done</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {/* Post Preview */}
              {(mediaFiles.length > 0 || content) && (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'flex-start', flexShrink: 0 }}>
                  {mediaFiles.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      {mediaFiles.slice(0, 3).map((m, i) => (
                        <div key={m.id} style={{ width: '64px', height: '64px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                          {m.type === 'video' ? (
                            <video src={m.previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                          ) : (
                            <img src={m.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )}
                        </div>
                      ))}
                      {mediaFiles.length > 3 && (
                        <div style={{ width: '64px', height: '64px', borderRadius: '10px', background: 'rgba(108,59,255,0.15)', border: '1px solid rgba(108,59,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#c084fc', flexShrink: 0 }}>
                          +{mediaFiles.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: '0 0 4px 0' }}>Post Preview</p>
                    {content ? (
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{content.replace(/<[^>]*>/g, '')}</p>
                    ) : (
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', margin: 0, fontStyle: 'italic' }}>No text content yet</p>
                    )}
                    {topics.length > 0 && (
                      <p style={{ fontSize: '10px', color: '#a78bfa', margin: '6px 0 0 0' }}>{topics.join(' ')}</p>
                    )}
                  </div>
                </div>
              )}

              <input 
                type="text" 
                placeholder="Search topics or hashtags..." 
                value={tempTopicSearch}
                onChange={(e) => setTempTopicSearch(e.target.value)}
                className="hubble-workspace-input"
              />

              <strong>Trending Topics</strong>
              <div className="hubble-topics-flex-wrap">
                {trendingTags.map(tag => (
                  <button 
                    key={tag} 
                    onClick={() => {
                      if (topics.includes(tag)) setTopics(prev => prev.filter(t => t !== tag));
                      else setTopics(prev => [...prev, tag]);
                    }}
                    className={`hubble-tag-pill-btn ${topics.includes(tag) ? 'active' : ''}`}
                  >
                    {tag} ×
                  </button>
                ))}
              </div>

              <strong>Selected ({topics.length})</strong>
              <div className="hubble-topics-flex-wrap">
                {topics.map(tag => (
                  <span key={tag} className="hubble-tag-pill active">
                    {tag} <button onClick={() => setTopics(prev => prev.filter(t => t !== tag))}>×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        );

      case 'preview':
        return (
          <div className="hubble-sub-workspace hubble-preview-workspace">
            <div className="hubble-sub-header">
              <div className="hubble-sub-title-group">
                <button onClick={() => setWorkspaceMode('editor')} className="hubble-circle-btn">
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h3>Preview</h3>
                  <p>See how it looks</p>
                </div>
              </div>
              <div className="hubble-device-selector-tabs">
                {['Mobile', 'Desktop', 'Tablet'].map(d => (
                  <button key={d} onClick={() => setPreviewDevice(d)} className={`hubble-device-tab ${previewDevice === d ? 'active' : ''}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="hubble-preview-content-layout">
              {/* Phone simulator */}
              <div className="hubble-preview-shell-container">
                <div className={`hubble-sim-phone ${previewDevice === 'Mobile' ? 'mobile-w' : previewDevice === 'Tablet' ? 'tablet-w' : 'desktop-w'}`}>
                  <div className="hubble-sim-header">
                    <img src={profile.avatar} className="hubble-sim-avatar" alt="Avatar" />
                    <div>
                      <strong>{profile.fullName}</strong>
                      <p>@{profile.username}</p>
                    </div>
                  </div>
                  {/* User requested to remove selected captions in preview */}
                  {/* <p className="hubble-sim-caption" dangerouslySetInnerHTML={{ __html: content }} /> */}
                  {mediaFiles.length > 0 && (
                    <div className="hubble-sim-media" style={{ display: 'grid', gridTemplateColumns: mediaFiles.length > 1 ? '1fr 1fr' : '1fr', gap: '4px' }}>
                      {mediaFiles.map((media) => (
                        media.type === 'video' ? (
                          <video key={media.id} src={media.previewUrl} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <img key={media.id} src={media.previewUrl} alt="Media" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                        )
                      ))}
                    </div>
                  )}
                  <div className="hubble-sim-footer">
                    <span>❤️ 128</span>
                    <span>💬 24</span>
                  </div>
                </div>
              </div>

              {/* Summary table */}
              <div className={`hubble-preview-summary-card ${previewDevice === 'Mobile' ? 'mobile-w' : previewDevice === 'Tablet' ? 'tablet-w' : 'desktop-w'}`}>
                <h4>Post Summary</h4>
                <div className="hubble-summary-rows">
                  <div className="hubble-sum-row"><span>Media</span><strong>{mediaFiles.length} items</strong></div>
                  <div className="hubble-sum-row"><span>Topics</span><strong>{topics.length} topics</strong></div>
                  <div className="hubble-sum-row"><span>Audience</span><strong>{audience}</strong></div>
                  <div className="hubble-sum-row"><span>Schedule</span><strong>{isScheduled ? 'Scheduled' : 'Post Now'}</strong></div>
                  <div className="hubble-sum-row"><span>Location</span><strong>{location}</strong></div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'drafts':
        return (
          <div className="hubble-sub-workspace hubble-drafts-workspace">
            <div className="hubble-sub-header">
              <div className="hubble-sub-title-group">
                <button onClick={() => setWorkspaceMode('editor')} className="hubble-circle-btn">
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h3>Drafts</h3>
                  <p>View your saved drafts</p>
                </div>
              </div>
            </div>
            {draftsList.length === 0 ? (
              <div className="hubble-drafts-empty">
                <FileText size={36} strokeWidth={1.5} className="hubble-empty-icon" />
                <p>No saved drafts yet</p>
              </div>
            ) : (
              <div className="hubble-drafts-list">
                {draftsList.map(d => {
                  const cleanText = d.text ? d.text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ') : '';
                  return (
                    <div key={d.id} className="hubble-draft-row">
                      <div className="hubble-draft-info">
                        <strong className="hubble-draft-title">{d.title}</strong>
                        <p className="hubble-draft-text">{cleanText || 'No content'}</p>
                      </div>
                      <button 
                        onClick={() => { 
                          setContent(d.text); 
                          if (d.media) {
                            setMediaFiles(d.media.map((url, idx) => ({
                              id: Date.now() + idx,
                              type: url.includes('video') || url.endsWith('.mp4') || url.startsWith('blob:video') ? 'video' : 'image',
                              previewUrl: url,
                              filter: 'Original',
                              brightness: 100,
                              contrast: 100,
                              saturation: 100,
                              exposure: 100,
                              sharpness: 0,
                              rotation: 0,
                              scaleX: 1,
                              scaleY: 1,
                              cropRatio: 'original',
                              cropX: 0,
                              cropY: 0,
                              cropZoom: 1,
                              effect: 'None',
                              frame: 'None',
                              stickers: [],
                              texts: [],
                              drawings: []
                            })));
                          } else {
                            setMediaFiles([]);
                          }
                          setWorkspaceMode('editor'); 
                        }} 
                        className="hubble-btn-restore"
                      >
                        Restore
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      default:
        // DEFAULT COMPOSER WORKSPACE (Matches mockup Create a New Vibe)
        return (
          <div className="hubble-composer-workspace">
            {/* Header */}
            <div className="hubble-composer-header">
              <div className="hubble-profile-group">
                <button onClick={onNavigateBack} className="hubble-circle-btn">
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Create a New Vibe ✦
                  </h3>
                  <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0 0' }}>
                    Share your thoughts, moments & vibes with the universe.
                  </p>
                </div>
              </div>

              <div className="hubble-header-right-buttons">
                <button 
                  onClick={async () => {
                    showToastNotification('Draft saved successfully! 💾');
                    const newDraft = {
                      id: Date.now(),
                      title: `Draft: ${content.substring(0, 15)}...`,
                      text: content,
                      media: mediaFiles.map(m => m.previewUrl)
                    };
                    setDraftsList(prev => {
                      const updated = [newDraft, ...prev];
                      localStorage.setItem('hubbleDrafts', JSON.stringify(updated));
                      return updated;
                    });
                  }} 
                  className="hubble-btn-secondary-sm"
                  style={{ borderRadius: '12px' }}
                >
                  Save Draft
                </button>
                <button onClick={handlePostSubmit} className="hubble-publish-btn" style={{ background: '#6C3BFF', border: 'none', borderRadius: '12px', fontSize: '11px', fontWeight: '700', padding: '6px 16px' }}>
                  Post
                </button>
              </div>
            </div>

            {/* Input area */}
            <div
              ref={textareaRef}
              contentEditable
              onInput={() => setContent(textareaRef.current.innerHTML)}
              placeholder="What's on your mind today?"
              className="hubble-composer-textarea"
              style={{ minHeight: '120px', marginTop: '12px', outline: 'none', overflowY: 'auto', textAlign: 'left', whiteSpace: 'pre-wrap' }}
            />

            {/* Large Media Previews inside Composer */}
            {mediaFiles.length > 0 && (
              <div 
                className="hubble-composer-large-previews" 
                style={{ 
                  marginTop: '12px', 
                  marginBottom: '16px',
                  display: 'grid', 
                  gap: '8px', 
                  gridTemplateColumns: mediaFiles.length === 1 ? '1fr' : mediaFiles.length === 2 ? '1fr 1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', 
                  borderRadius: '16px', 
                  overflow: 'hidden' 
                }}
              >
                {mediaFiles.map((media, idx) => (
                  <div 
                    key={media.id} 
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onClick={() => { setActiveMediaIndex(idx); setWorkspaceMode('mediastudio'); }}
                    style={{ position: 'relative', width: '100%', aspectRatio: mediaFiles.length > 1 ? '1' : '16/9', cursor: 'pointer', overflow: 'hidden', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {media.type === 'video' ? (
                      <video src={media.previewUrl} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <img src={media.previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeMedia(media.id); }} 
                      style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Attached Music Track Badge */}
            {selectedTrack && (
              <div 
                className="hubble-composer-music-badge" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px', 
                  background: 'rgba(168, 85, 247, 0.12)', 
                  border: '1px solid rgba(168, 85, 247, 0.25)', 
                  borderRadius: '12px', 
                  padding: '6px 12px', 
                  margin: '8px 0', 
                  width: 'fit-content', 
                  animation: 'fadeIn 0.2s ease-out' 
                }}
              >
                <div style={{ position: 'relative', width: '24px', height: '24px', borderRadius: '50%', overflow: 'hidden', background: '#000', flexShrink: 0 }}>
                  <img 
                    src={selectedTrack.artwork} 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover', 
                      borderRadius: '50%', 
                      animation: 'spin 4s linear infinite'
                    }} 
                    alt="vinyl"
                  />
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#fff', textAlign: 'left' }}>{selectedTrack.title}</div>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.6)', textAlign: 'left', marginTop: '1px' }}>{selectedTrack.artist}</div>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedTrack(null)} 
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: 'rgba(255,255,255,0.5)', 
                    cursor: 'pointer', 
                    fontSize: '11px', 
                    padding: '0 4px', 
                    marginLeft: '8px' 
                  }}
                >
                  ×
                </button>
              </div>
            )}

            {/* Music Picker Modal Popup */}
            {musicModalOpen && (
              <div 
                style={{ 
                  position: 'absolute', 
                  inset: 0, 
                  background: 'rgba(10, 8, 20, 0.95)', 
                  backdropFilter: 'blur(20px)', 
                  zIndex: 200, 
                  borderRadius: '20px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  padding: '20px',
                  animation: 'fadeIn 0.2s ease-out'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🎵 Add Music to Vibe
                  </h4>
                  <button 
                    type="button" 
                    onClick={closeMusicModal} 
                    style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}
                  >
                    ×
                  </button>
                </div>

                {/* Search controls */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  <input 
                    type="text" 
                    value={musicSearchQuery} 
                    onChange={(e) => setMusicSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') searchMusic(musicSearchQuery); }}
                    placeholder="Search songs or artists..." 
                    className="hubble-workspace-input"
                    style={{ flex: 1, padding: '6px 10px', fontSize: '11px' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => searchMusic(musicSearchQuery)} 
                    className="hubble-btn-primary" 
                    style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '10px' }}
                  >
                    Search
                  </button>
                </div>

                {/* Recommendation presets */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {['Lo-Fi', 'Pop', 'Hip Hop', 'Chill out', 'Jazz', 'Synthwave'].map(genre => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => {
                        setMusicSearchQuery(genre);
                        searchMusic(genre);
                      }}
                      style={{ 
                        background: 'rgba(255,255,255,0.05)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '20px', 
                        padding: '3px 8px', 
                        fontSize: '9px', 
                        color: 'rgba(255,255,255,0.7)', 
                        cursor: 'pointer' 
                      }}
                    >
                      #{genre.toLowerCase()}
                    </button>
                  ))}
                </div>

                {/* Search Results / Loading spinner */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                  {searchLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px' }}>
                      <div className="hubble-spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>Searching iTunes library...</span>
                    </div>
                  ) : musicSearchResults.length > 0 ? (
                    musicSearchResults.map(track => {
                      const isPlaying = isPlayingPreview === track.previewUrl;
                      return (
                        <div 
                          key={track.id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '10px', 
                            background: 'rgba(255,255,255,0.03)', 
                            border: '1px solid rgba(255,255,255,0.05)', 
                            borderRadius: '12px', 
                            padding: '6px 10px',
                            transition: 'background 0.2s'
                          }}
                        >
                          <img src={track.artwork} style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} alt="Artwork" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{track.title}</div>
                            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', marginTop: '1px' }}>{track.artist}</div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => togglePlayPreview(track)}
                              style={{ 
                                background: isPlaying ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.06)', 
                                border: 'none', 
                                color: isPlaying ? '#a855f7' : '#fff', 
                                width: '24px', 
                                height: '24px', 
                                borderRadius: '50%', 
                                cursor: 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center' 
                              }}
                            >
                              {isPlaying ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="1" /></svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTrack(track);
                                closeMusicModal();
                              }}
                              className="hubble-btn-primary"
                              style={{ padding: '4px 10px', fontSize: '9px', borderRadius: '8px' }}
                            >
                              Select
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', fontSize: '10px', textAlign: 'center' }}>
                      Search for your favorite tracks or select a tag preset above.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions selector toolbar */}
            <div className="hubble-quick-toolbar" style={{ border: 'none', background: 'rgba(0,0,0,0.15)', padding: '4px', borderRadius: '12px' }}>
              <button onClick={() => fileInputRef.current?.click()} className="hubble-quick-btn"><ImageIcon size={11} /> Photo</button>
              <button onClick={() => fileInputRef.current?.click()} className="hubble-quick-btn"><Video size={11} /> Video</button>
              <button type="button" onClick={() => setMusicModalOpen(true)} className="hubble-quick-btn"><Music size={11} /> Music</button>
              <button onClick={() => setWorkspaceMode('location')} className="hubble-quick-btn"><MapPin size={11} /> Location</button>
              <button onClick={() => setWorkspaceMode('topics')} className="hubble-quick-btn"><Hash size={11} /> Topic</button>
            </div>

            {/* Formatting & Bottom controls row */}
            <div className="hubble-composer-footer" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
              {showEmojiPicker && (
                <div className="hubble-composer-emoji-bar" style={{ display: 'flex', gap: '6px', background: 'rgba(0, 0, 0, 0.25)', padding: '6px', borderRadius: '10px', flexWrap: 'wrap', width: 'fit-content' }}>
                  {['😊', '😂', '😍', '🔥', '🎉', '👍', '❤️', '✨', '🙌', '💀'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        const editor = textareaRef.current;
                        if (editor) {
                          editor.focus();
                          const selection = window.getSelection();
                          if (selection.rangeCount > 0) {
                            const range = selection.getRangeAt(0);
                            range.deleteContents();
                            const node = document.createTextNode(emoji);
                            range.insertNode(node);
                            range.collapse(false);
                            selection.removeAllRanges();
                            selection.addRange(range);
                          } else {
                            editor.innerHTML += emoji;
                          }
                          setContent(editor.innerHTML);
                        } else {
                          setContent(prev => prev + emoji);
                        }
                        setShowEmojiPicker(false);
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px' }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                {/* Rich text formatting shortcuts */}
                <div className="hubble-format-bar">
                  <button type="button" onClick={() => applyFormatting('bold')} className="format-btn"><Bold size={12} /></button>
                  <button type="button" onClick={() => applyFormatting('italic')} className="format-btn"><Italic size={12} /></button>
                  <button type="button" onClick={() => applyFormatting('underline')} className="format-btn"><Underline size={12} /></button>
                  <button type="button" onClick={() => applyFormatting('link')} className="format-btn"><Link size={12} /></button>
                  <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="format-btn" style={{ background: showEmojiPicker ? 'rgba(108,59,255,0.2)' : '' }}><Smile size={12} /></button>
                </div>

              {/* Right Side Char Count & Publish */}
              <div className="hubble-composer-actions">
                <button onClick={() => setWorkspaceMode('audience')} className="hubble-audience-badge">
                  <Globe size={10} />
                  <span>{audience}</span>
                  <span className="down-arrow">▼</span>
                </button>
              </div>
            </div>
          </div>

          </div>
        );
    }
  };

  return (
    <div className="hubble-creative-page-container">
      {/* Scope Style tag for beautiful layout without Tailwind */}
      <style>{`
        /* Global override class injected dynamically when CreatePost mounts */
        body.create-post-view-active #app-sidebar-right {
          display: none !important;
        }
        body.create-post-view-active #app-main-layout {
          grid-template-columns: 280px 1fr !important;
        }

        .hubble-crop-overlay {
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.65);
          pointer-events: auto;
        }

        .hubble-crop-handle {
          position: absolute;
          width: 24px;
          height: 24px;
          background: transparent;
          cursor: pointer;
          z-index: 25;
        }
        .hubble-crop-handle::after {
          content: '';
          position: absolute;
          background: white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }
        .hubble-crop-handle:active::after {
          background: #6C3BFF;
        }

        /* Corners */
        .hubble-crop-handle-tl { top: -12px; left: -12px; cursor: nwse-resize; }
        .hubble-crop-handle-tl::after { top: 10px; left: 10px; width: 14px; height: 14px; border-top: 3px solid white; border-left: 3px solid white; background: transparent; }
        
        .hubble-crop-handle-tr { top: -12px; right: -12px; cursor: nesw-resize; }
        .hubble-crop-handle-tr::after { top: 10px; right: 10px; width: 14px; height: 14px; border-top: 3px solid white; border-right: 3px solid white; background: transparent; }
        
        .hubble-crop-handle-bl { bottom: -12px; left: -12px; cursor: nesw-resize; }
        .hubble-crop-handle-bl::after { bottom: 10px; left: 10px; width: 14px; height: 14px; border-bottom: 3px solid white; border-left: 3px solid white; background: transparent; }
        
        .hubble-crop-handle-br { bottom: -12px; right: -12px; cursor: nwse-resize; }
        .hubble-crop-handle-br::after { bottom: 10px; right: 10px; width: 14px; height: 14px; border-bottom: 3px solid white; border-right: 3px solid white; background: transparent; }

        /* Edges */
        .hubble-crop-handle-tc { top: -12px; left: 50%; transform: translateX(-50%); width: 40px; cursor: ns-resize; }
        .hubble-crop-handle-tc::after { top: 10px; left: 10px; width: 20px; height: 4px; border-radius: 2px; }
        
        .hubble-crop-handle-bc { bottom: -12px; left: 50%; transform: translateX(-50%); width: 40px; cursor: ns-resize; }
        .hubble-crop-handle-bc::after { bottom: 10px; left: 10px; width: 20px; height: 4px; border-radius: 2px; }
        
        .hubble-crop-handle-ml { top: 50%; left: -12px; transform: translateY(-50%); height: 40px; cursor: ew-resize; }
        .hubble-crop-handle-ml::after { top: 10px; left: 10px; width: 4px; height: 20px; border-radius: 2px; }
        
        .hubble-crop-handle-mr { top: 50%; right: -12px; transform: translateY(-50%); height: 40px; cursor: ew-resize; }
        .hubble-crop-handle-mr::after { top: 10px; right: 10px; width: 4px; height: 20px; border-radius: 2px; }

        .hubble-creative-page-container {
          display: flex;
          gap: 24px;
          width: 100%;
          font-family: 'Inter', sans-serif;
          color: #fff;
          box-sizing: border-box;
        }

        .hubble-workspace-column {
          width: 68%;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .hubble-tools-column {
          width: 32%;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* CARD WORKSPACE GLASSMORPHISM */
        .hubble-glass-card {
          background: rgba(18, 15, 36, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 40px rgba(108, 59, 255, 0.1);
          backdrop-filter: blur(20px);
          box-sizing: border-box;
          transition: box-shadow 0.3s ease, border-color 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        .hubble-workspace-card {
          height: 600px;
          min-height: 600px;
          max-height: 600px;
          overflow: hidden;
          padding: 0;
          flex-shrink: 0;
        }

        /* SUB WORKSPACE VIEWS GENERAL */
        .hubble-sub-workspace {
          display: flex;
          flex-direction: column;
          gap: 16px;
          animation: hubble-fade-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          height: 100%;
          justify-content: flex-start;
          overflow-y: auto;
          padding: 24px;
          box-sizing: border-box;
        }

        .hubble-sub-workspace::-webkit-scrollbar { display: none; }
        .hubble-sub-workspace { scrollbar-width: none; }

        .hubble-sub-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding-bottom: 14px;
        }

        .hubble-sub-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .hubble-sub-title-group h3 {
          font-family: 'Outfit', sans-serif;
          font-size: 16px;
          font-weight: 700;
          margin: 0;
          color: #fff;
        }

        .hubble-sub-title-group p {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          margin: 2px 0 0 0;
        }

        /* GENERAL BUTTONS */
        .hubble-circle-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a855f7;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .hubble-circle-btn:hover {
          background: rgba(108, 59, 255, 0.2);
          border-color: rgba(108, 59, 255, 0.5);
          transform: scale(1.05);
        }

        .hubble-circle-btn-sm {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .hubble-circle-btn-sm:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          transform: scale(1.05);
        }

        .hubble-circle-btn-sm:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .hubble-btn-primary {
          background: linear-gradient(90deg, #6C3BFF, #FF4FA3);
          border: none;
          border-radius: 20px;
          color: #fff;
          padding: 8px 20px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 4px 15px rgba(108, 59, 255, 0.3);
        }

        .hubble-btn-primary:hover {
          transform: translateY(-1.5px);
          box-shadow: 0 6px 20px rgba(108, 59, 255, 0.5), 0 0 10px rgba(255, 79, 163, 0.4);
        }

        .hubble-btn-secondary {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          color: rgba(255, 255, 255, 0.7);
          padding: 8px 20px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .hubble-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .hubble-btn-secondary-sm {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          color: rgba(255, 255, 255, 0.8);
          padding: 6px 14px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .hubble-btn-secondary-sm:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        /* COMPOSER WORKSPACE */
        .hubble-composer-workspace {
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-between;
          padding: 24px;
          box-sizing: border-box;
        }

        .hubble-composer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 12px;
        }

        .hubble-profile-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .hubble-header-right-buttons {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hubble-composer-textarea {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: #fff;
          font-family: inherit;
          font-size: 14px;
          resize: none;
          box-sizing: border-box;
          padding: 8px 0;
        }

        .hubble-composer-textarea:empty:before {
          content: attr(placeholder);
          color: rgba(255, 255, 255, 0.4);
          cursor: text;
          display: block;
        }

        .hubble-quick-toolbar {
          display: flex;
          gap: 6px;
          background: rgba(0, 0, 0, 0.15);
          padding: 4px;
          border-radius: 12px;
          flex-wrap: nowrap;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .hubble-quick-toolbar::-webkit-scrollbar {
          display: none;
        }

        .hubble-quick-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .hubble-quick-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }

        .hubble-media-previews-grid {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .hubble-preview-media-card {
          position: relative;
          width: 80px;
          height: 80px;
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: all 0.2s;
        }

        .hubble-preview-media-card:hover {
          transform: scale(1.03);
          border-color: #6C3BFF;
        }

        .hubble-preview-media-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .hubble-remove-preview-btn {
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(0, 0, 0, 0.6);
          border: none;
          color: #fff;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          cursor: pointer;
        }

        .hubble-add-more-media-card {
          width: 80px;
          height: 80px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1.5px dashed rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.4);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 9px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .hubble-add-more-media-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: #6C3BFF;
          color: #fff;
        }

        .hubble-composer-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 10px;
        }

        .hubble-format-bar {
          display: flex;
          gap: 4px;
        }

        .format-btn {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.4);
          width: 24px;
          height: 24px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .format-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }

        .hubble-audience-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.7);
          padding: 5px 10px;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
        }

        .hubble-audience-badge:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }
        /* MEDIA STUDIO LAYOUT */
        .hubble-mediastudio-layout {
          display: flex;
          flex-direction: row;
          width: 100%;
          flex: 1;
          min-height: 0;
          background: #000;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          overflow: hidden;
        }

        .hubble-mediastudio-tools-left {
          width: 72px;
          min-width: 72px;
          background: #111;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 0;
          gap: 12px;
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          overflow-y: auto;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hubble-mediastudio-tools-left::-webkit-scrollbar {
          display: none;
        }

        .hubble-mediastudio-canvas-wrapper {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #090909;
          position: relative;
          overflow: hidden;
          padding: 20px;
        }

        .hubble-mediastudio-properties-right {
          width: 320px;
          min-width: 320px;
          background: #111;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hubble-mediastudio-properties-right::-webkit-scrollbar {
          display: none;
        }

        .hubble-mediastudio-bottom-strip {
          height: 90px;
          flex-shrink: 0;
          background: #0a0a0a;
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 12px;
          border-radius: 8px;
          margin-top: 16px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          overflow-x: auto;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hubble-mediastudio-bottom-strip::-webkit-scrollbar {
          display: none;
        }
        
        .hubble-tool-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          font-size: 10px;
          font-weight: 500;
          width: 56px;
          height: 56px;
          border-radius: 12px;
          transition: all 0.2s ease;
        }
        
        .hubble-tool-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
        }
        
        .hubble-tool-btn.active {
          color: #fff;
          background: rgba(108, 59, 255, 0.15);
          border: 1px solid rgba(108, 59, 255, 0.3);
        }

        .hubble-properties-panel {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .hubble-properties-panel h4 {
          margin: 0;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 10px;
          margin-bottom: 4px;
        }

        .hubble-properties-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .hubble-properties-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        
        .hubble-aspect-pills-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .hubble-aspect-pill {
          padding: 8px 16px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.03);
          transition: all 0.2s ease;
        }

        .hubble-aspect-pill:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .hubble-aspect-pill.active {
          background: rgba(108, 59, 255, 0.25);
          color: #fff;
          border-color: rgba(108, 59, 255, 0.5);
        }

        .hubble-filter-card-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 8px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.6);
          transition: all 0.2s;
        }
        
        .hubble-filter-card-btn:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        
        .hubble-filter-card-btn span {
          font-size: 11px;
          font-weight: 500;
        }
        
        .hubble-filter-card-btn.active {
          border-color: rgba(108, 59, 255, 0.5);
          background: rgba(108, 59, 255, 0.1);
          color: #fff;
        }
        
        .filter-card-preview-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-size: cover;
          background-position: center;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .hubble-slider-col {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .hubble-slider-labels {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }
        
        .hubble-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          outline: none;
        }
        
        .hubble-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #6C3BFF;
          cursor: pointer;
        }

        .hubble-btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          font-weight: 600;
          font-size: 12px;
          border-radius: 12px;
          padding: 8px 16px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hubble-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .hubble-workspace-input {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          padding: 10px;
          font-size: 12px;
          outline: none;
        }

        .hubble-workspace-input:focus {
          border-color: #6C3BFF;
        }

        .hubble-thumbnail-item {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          overflow: hidden;
          position: relative;
          cursor: pointer;
          border: 2px solid transparent;
          flex-shrink: 0;
        }

        .hubble-thumbnail-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .hubble-thumbnail-item.active {
          border-color: #6C3BFF;
        }

        .hubble-thumb-delete {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.6);
          color: #fff;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .hubble-thumbnail-item:hover .hubble-thumb-delete {
          opacity: 1;
        }

        .hubble-add-thumbnail-btn {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px dashed rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }

        .hubble-add-thumbnail-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .hubble-header-center {
          background: rgba(0,0,0,0.2);
          padding: 4px 12px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.05);
        }

        @media (max-width: 1024px) {
          .hubble-mediastudio-layout {
            flex-direction: column;
            height: auto;
          }
          .hubble-mediastudio-tools-left {
            width: 100%;
            height: 72px;
            flex-direction: row;
            overflow-x: auto;
            border-right: none;
            border-bottom: 1px solid rgba(255,255,255,0.1);
          }
          .hubble-mediastudio-properties-right {
            width: 100%;
            height: 250px;
            border-left: none;
            border-top: 1px solid rgba(255,255,255,0.1);
          }
          .hubble-mediastudio-canvas-wrapper {
            height: 400px;
          }
        }



        /* SCHEDULE MODE LAYOUT */

        .hubble-schedule-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 32px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          flex-shrink: 0;
        }

        .hubble-schedule-layout {
          display: grid;
          grid-template-columns: 35% 65%;
          gap: 32px;
          padding: 24px 32px;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }

        .hubble-schedule-layout::-webkit-scrollbar { display: none; }
        .hubble-schedule-layout { scrollbar-width: none; }

        .hubble-schedule-presets {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .hubble-schedule-calendar-col {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        @media (max-width: 1024px) {
          .hubble-schedule-layout {
            grid-template-columns: 40% 60%;
            gap: 24px;
          }
        }

        @media (max-width: 768px) {
          .hubble-schedule-layout {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }

        /* AUDIENCE MODE LAYOUT */
        .hubble-audience-layout {
          display: grid;
          grid-template-columns: 4.5fr 5.5fr;
          align-items: center;
          gap: 32px;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }
        .hubble-audience-layout::-webkit-scrollbar { display: none; }
        .hubble-audience-layout { scrollbar-width: none; }
        .hubble-audience-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .hubble-audience-header {
          align-items: flex-start;
        }
        .hubble-audience-header .hubble-btn-primary {
          margin-top: 2px;
        }

        @media (max-width: 768px) {
          .hubble-audience-layout {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto;
            gap: 32px;
          }
        }

        /* AUDIENCE & SCHEDULE WORKSPACES */
        .hubble-two-col-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          flex: 1;
          overflow: hidden;
        }

        .hubble-list-options {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .hubble-option-row {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.02) !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
          border-radius: 14px !important;
          padding: 8px 12px !important;
          cursor: pointer;
          width: 100%;
          text-align: left;
          color: #fff !important;
          transition: all 0.2s;
        }

        .hubble-option-row:hover {
          background: rgba(255, 255, 255, 0.05) !important;
        }

        .hubble-option-row.active {
          background: rgba(108, 59, 255, 0.1) !important;
          border-color: rgba(108, 59, 255, 0.35) !important;
        }

        .hubble-radio-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hubble-radio-inner {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #6C3BFF;
        }

        .hubble-option-row strong {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #fff !important;
        }

        .hubble-option-row p {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.4) !important;
          margin: 1px 0 0 0;
        }

        /* GLOBE VISUAL */
        .hubble-globe-visual {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          height: 100%;
        }

        .hubble-globe-circle {
          width: 100%;
          max-width: 220px;
          aspect-ratio: 1;
          border-radius: 50%;
          border: 1px solid rgba(168, 85, 247, 0.2);
          background: radial-gradient(circle, rgba(108, 59, 255, 0.1) 0%, transparent 70%);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .hubble-avatar-float {
          position: absolute;
          width: 18%;
          aspect-ratio: 1;
          border-radius: 50%;
          overflow: hidden;
          border: 1.5px solid #a855f7;
        }

        .hubble-avatar-float img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* GLOBE ILLUSTRATION FOR AUDIENCE */
        .globe-sphere {
          width: 55%;
          height: 55%;
          border-radius: 50%;
          background: radial-gradient(circle, #8b5cf6 0%, #1e1b4b 100%);
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.6);
        }

        .hubble-avatar-float.g1 { top: 12%; left: 18%; }
        .hubble-avatar-float.g2 { bottom: 15%; right: 10%; }
        .hubble-avatar-float.g3 { top: 22%; right: 8%; }
        .hubble-avatar-float.g4 { bottom: 10%; left: 22%; }

        /* CALENDAR */
        .hubble-calendar-mock {
          background: rgba(0, 0, 0, 0.15) !important;
          border: 1px solid rgba(255, 255, 255, 0.04) !important;
          border-radius: 20px !important;
          padding: 12px !important;
        }

        .hubble-cal-header {
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .hubble-cal-days {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
          text-align: center;
        }

        .cal-label {
          font-size: 8px;
          color: rgba(255,255,255,0.3);
          font-weight: 700;
          padding-bottom: 2px;
        }

        .cal-day-cell {
          background: transparent !important;
          border: none !important;
          color: rgba(255,255,255,0.7) !important;
          font-size: 8px !important;
          font-weight: 700 !important;
          height: 20px !important;
          border-radius: 5px !important;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .cal-day-cell:hover {
          background: rgba(255,255,255,0.05) !important;
        }

        .cal-day-cell.active {
          background: #6C3BFF !important;
          color: #fff !important;
        }

        .time-select {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          border-radius: 6px;
          padding: 2px 4px;
          font-size: 10px;
          outline: none;
        }

        /* INPUTS */
        .hubble-workspace-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 8px 12px;
          font-size: 11px;
          color: #fff;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s ease;
        }

        .hubble-workspace-input:focus {
          border-color: #6C3BFF;
        }

        /* MAP */
        .hubble-map-mock {
          background: rgba(0,0,0,0.25);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.05);
          height: 140px;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 8px;
          box-sizing: border-box;
          overflow: hidden;
        }

        .hubble-map-mock-full {
          height: 200px;
          width: 100%;
        }

        .hubble-location-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 24px 32px;
          flex: 1;
          overflow-y: auto;
        }

        .hubble-location-content::-webkit-scrollbar { display: none; }
        .hubble-location-content { scrollbar-width: none; }

        .hubble-location-recent {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .hubble-location-recent-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 200px;
          overflow-y: auto;
        }

        .hubble-location-recent-list::-webkit-scrollbar { display: none; }
        .hubble-location-recent-list { scrollbar-width: none; }

        .hubble-location-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.8);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .hubble-location-item:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          color: #fff;
        }

        .hubble-location-item.active {
          background: rgba(108, 59, 255, 0.15);
          border-color: rgba(108, 59, 255, 0.4);
          color: #fff;
        }

        .hubble-map-marker {
          position: absolute;
          top: 35%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .hubble-map-marker .marker-icon {
          color: #ef4444;
          filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.6));
          animation: bounce 2s infinite;
        }

        .hubble-map-details {
          background: rgba(18, 15, 36, 0.85);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 6px 10px;
        }

        .hubble-map-details strong {
          display: block;
          font-size: 9px;
        }

        .hubble-map-details p {
          font-size: 7.5px;
          color: rgba(255,255,255,0.4);
          margin: 1px 0 0 0;
        }

        /* TOPICS */
        .hubble-topics-flex-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .hubble-tag-pill-btn {
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.06) !important;
          border-radius: 12px !important;
          padding: 4px 10px !important;
          font-size: 9.5px !important;
          color: rgba(255, 255, 255, 0.7) !important;
          cursor: pointer;
        }

        .hubble-tag-pill-btn.active {
          background: rgba(108, 59, 255, 0.15) !important;
          border-color: #6c3bff !important;
          color: #d8b4fe !important;
        }

        .hubble-tag-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(108, 59, 255, 0.2);
          border: 1px solid rgba(108, 59, 255, 0.4);
          color: #e9d5ff;
          border-radius: 12px;
          padding: 4px 10px;
          font-size: 9.5px;
        }

        .hubble-tag-pill button {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          font-size: 9px;
        }

        /* PREVIEW WORKSPACE OVERRIDES */
        .hubble-sub-workspace.hubble-preview-workspace {
          overflow-y: hidden;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .hubble-preview-content-layout {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          flex: 1;
          overflow-y: auto;
          width: 100%;
          box-sizing: border-box;
          padding: 12px 4px 28px 4px;
        }

        .hubble-preview-content-layout::-webkit-scrollbar {
          width: 6px;
        }

        .hubble-preview-content-layout::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.01);
          border-radius: 3px;
        }

        .hubble-preview-content-layout::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }

        .hubble-preview-content-layout::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .hubble-preview-workspace .hubble-preview-shell-container {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          flex-shrink: 0;
        }

        .hubble-preview-workspace .hubble-preview-summary-card {
          width: 100%;
          max-width: 320px;
          margin: 0;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          box-sizing: border-box;
          flex-shrink: 0;
        }

        .hubble-sim-phone {
          background: rgba(0, 0, 0, 0.4);
          border: 6px solid rgba(255, 255, 255, 0.08);
          border-radius: 28px;
          padding: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          transition: all 0.3s;
          box-sizing: border-box;
        }

        .mobile-w { width: 280px; }
        .tablet-w { width: 320px; }
        .desktop-w { width: 360px; }

        .hubble-sim-header {
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding-bottom: 8px;
          margin-bottom: 8px;
        }

        .hubble-sim-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
        }

        .hubble-sim-header strong {
          display: block;
          font-size: 11px;
          color: #ffffff;
        }

        .hubble-sim-header p {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.4);
          margin: 0;
        }

        .hubble-sim-caption {
          font-size: 11.5px;
          margin: 8px 0;
          line-height: 1.4;
        }

        .hubble-sim-media {
          width: 100%;
          border-radius: 12px;
          overflow: hidden;
          max-height: 160px;
          margin-top: 8px;
        }

        .hubble-sim-media img, .hubble-sim-media video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .hubble-sim-footer {
          display: flex;
          gap: 12px;
          font-size: 9.5px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 10px;
        }

        .hubble-device-selector-tabs {
          display: flex;
          gap: 4px;
          background: rgba(0, 0, 0, 0.2);
          padding: 3px;
          border-radius: 10px;
        }

        .hubble-device-tab {
          background: transparent;
          border: none;
          padding: 3px 8px;
          font-size: 8.5px;
          color: rgba(255,255,255,0.5);
          font-weight: 700;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .hubble-device-tab.active {
          background: rgba(255,255,255,0.08);
          color: #fff;
        }

        .hubble-preview-summary-card {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 20px;
          padding: 16px 20px;
          width: 100%;
          box-sizing: border-box;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .hubble-preview-summary-card h4 {
          font-size: 13px;
          font-weight: 700;
          margin: 0 0 12px 0;
          color: #ffffff;
        }

        .hubble-summary-rows {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .hubble-sum-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
          padding-bottom: 6px;
        }

        .hubble-sum-row span {
          color: rgba(255,255,255,0.4);
        }

        /* DRAFTS LIST & WORKSPACE OVERRIDES */
        .hubble-sub-workspace.hubble-drafts-workspace {
          overflow-y: hidden;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .hubble-drafts-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          flex: 1;
          overflow-y: auto;
          padding-right: 4px;
        }

        .hubble-drafts-list::-webkit-scrollbar {
          width: 6px;
        }

        .hubble-drafts-list::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.01);
          border-radius: 3px;
        }

        .hubble-drafts-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }

        .hubble-drafts-list::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .hubble-draft-row {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }

        .hubble-draft-row:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(108, 59, 255, 0.45);
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(108, 59, 255, 0.15), 0 0 15px rgba(108, 59, 255, 0.1);
        }

        .hubble-draft-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-align: left;
          flex: 1;
          min-width: 0;
        }

        .hubble-draft-title {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          letter-spacing: 0.3px;
        }

        .hubble-draft-text {
          font-size: 11px;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .hubble-btn-restore {
          background: rgba(108, 59, 255, 0.1);
          border: 1px solid rgba(108, 59, 255, 0.5);
          border-radius: 30px;
          color: #ffffff;
          padding: 8px 18px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 0 10px rgba(108, 59, 255, 0.2);
          white-space: nowrap;
          outline: none;
        }

        .hubble-btn-restore:hover {
          background: linear-gradient(90deg, rgba(108, 59, 255, 0.8), rgba(255, 79, 163, 0.8));
          border-color: transparent;
          box-shadow: 0 0 15px rgba(108, 59, 255, 0.4), 0 0 8px rgba(255, 79, 163, 0.3);
          transform: scale(1.05);
          color: #ffffff;
        }

        .hubble-btn-restore:active {
          transform: scale(0.98);
        }

        .hubble-drafts-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px 20px;
          color: rgba(255, 255, 255, 0.4);
          height: 100%;
          min-height: 200px;
          text-align: center;
        }

        .hubble-empty-icon {
          color: rgba(108, 59, 255, 0.5);
          filter: drop-shadow(0 0 8px rgba(108, 59, 255, 0.25));
          animation: hubble-pulse 2s infinite ease-in-out;
        }

        @keyframes hubble-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }

        .hubble-drafts-empty p {
          font-size: 13px;
          font-weight: 500;
          margin: 0;
          letter-spacing: 0.2px;
        }

        @media (max-width: 576px) {
          .hubble-draft-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
            padding: 14px 16px;
          }
          .hubble-btn-restore {
            align-self: flex-end;
            width: auto;
          }
        }

        /* RIGHT TOOLS ROW BUTTONS */
        .hubble-tool-row-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255,255,255,0.02) !important;
          border: 1px solid rgba(255,255,255,0.05) !important;
          border-radius: 16px !important;
          padding: 10px 14px !important;
          cursor: pointer;
          width: 100%;
          text-align: left;
          color: #fff !important;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .hubble-tool-row-btn:hover {
          background: rgba(255,255,255,0.06) !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(108, 59, 255, 0.1);
        }

        .hubble-tool-row-btn.active {
          background: rgba(108, 59, 255, 0.1) !important;
          border-color: rgba(108, 59, 255, 0.35) !important;
        }

        .hubble-tool-content-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .hubble-tool-icon-box {
          width: 24px;
          height: 24px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .hubble-tool-icon-box.purple { background: rgba(108, 59, 255, 0.25); color: #c084fc; }
        .hubble-tool-icon-box.pink { background: rgba(255, 79, 163, 0.25); color: #f472b6; }
        .hubble-tool-icon-box.orange { background: rgba(249, 115, 22, 0.25); color: #fb923c; }
        .hubble-tool-icon-box.blue { background: rgba(59, 130, 246, 0.25); color: #60a5fa; }
        .hubble-tool-icon-box.green { background: rgba(16, 185, 129, 0.25); color: #34d399; }
        .hubble-tool-icon-box.zinc { background: rgba(113, 113, 122, 0.25); color: #a1a1aa; }

        .hubble-tool-text strong {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #fff !important;
        }

        .hubble-tool-text p {
          font-size: 8px;
          color: rgba(255,255,255,0.4) !important;
          margin: 1px 0 0 0;
        }

        .hubble-tool-row-btn .chevron {
          color: rgba(255,255,255,0.3);
          transition: transform 0.2s ease;
        }

        .hubble-tool-row-btn.active .chevron {
          transform: rotate(90deg);
          color: #fff;
        }

        /* ANIMATIONS */
        @keyframes hubble-fade-in {
          from { opacity: 0; transform: scale(0.98) translateY(2px); filter: blur(2px); }
          to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
        }

        .hubble-divider-v {
          width: 1px;
          height: 24px;
          background: rgba(255,255,255,0.1);
          margin: 0 4px;
        }

        @keyframes hubble-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .hubble-spin {
          animation: hubble-spin 1.5s linear infinite;
        }
      `}</style>

      {/* CENTER WORKSPACE COLUMN - 68% Wide */}
      <div className="hubble-workspace-column">
        <div className="hubble-glass-card hubble-workspace-card">
          <div key={workspaceMode} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {renderActiveWorkspace()}
          </div>
        </div>
      </div>

      {/* RIGHT TOOLS COLUMN - 32% Wide */}
      <div className="hubble-tools-column">
        {/* Hubbing Tools panel */}
        <div className="hubble-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
              Hub Tools <Plus size={12} />
            </h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button 
              onClick={() => setWorkspaceMode(workspaceMode === 'mediastudio' ? 'editor' : 'mediastudio')}
              className={`hubble-tool-row-btn ${workspaceMode === 'mediastudio' ? 'active' : ''}`}
            >
              <div className="hubble-tool-content-group">
                <div className="hubble-tool-icon-box purple"><ImageIcon size={12} /></div>
                <div className="hubble-tool-text">
                  <strong>Media Studio</strong>
                  <p>Edit your photos & videos</p>
                </div>
              </div>
              <ChevronRight size={12} className="chevron" />
            </button>

            <button 
              onClick={() => setWorkspaceMode(workspaceMode === 'audience' ? 'editor' : 'audience')}
              className={`hubble-tool-row-btn ${workspaceMode === 'audience' ? 'active' : ''}`}
            >
              <div className="hubble-tool-content-group">
                <div className="hubble-tool-icon-box pink"><Users size={12} /></div>
                <div className="hubble-tool-text">
                  <strong>Audience</strong>
                  <p>Choose who can see this</p>
                </div>
              </div>
              <ChevronRight size={12} className="chevron" />
            </button>

            <button 
              onClick={() => setWorkspaceMode(workspaceMode === 'schedule' ? 'editor' : 'schedule')}
              className={`hubble-tool-row-btn ${workspaceMode === 'schedule' ? 'active' : ''}`}
            >
              <div className="hubble-tool-content-group">
                <div className="hubble-tool-icon-box orange"><Calendar size={12} /></div>
                <div className="hubble-tool-text">
                  <strong>Schedule</strong>
                  <p>Pick date & time to post</p>
                </div>
              </div>
              <ChevronRight size={12} className="chevron" />
            </button>

            <button 
              onClick={() => setWorkspaceMode(workspaceMode === 'location' ? 'editor' : 'location')}
              className={`hubble-tool-row-btn ${workspaceMode === 'location' ? 'active' : ''}`}
            >
              <div className="hubble-tool-content-group">
                <div className="hubble-tool-icon-box blue"><MapPin size={12} /></div>
                <div className="hubble-tool-text">
                  <strong>Location</strong>
                  <p>Add location to your vibe</p>
                </div>
              </div>
              <ChevronRight size={12} className="chevron" />
            </button>

            <button 
              onClick={() => setWorkspaceMode(workspaceMode === 'topics' ? 'editor' : 'topics')}
              className={`hubble-tool-row-btn ${workspaceMode === 'topics' ? 'active' : ''}`}
            >
              <div className="hubble-tool-content-group">
                <div className="hubble-tool-icon-box green"><Hash size={12} /></div>
                <div className="hubble-tool-text">
                  <strong>Topics</strong>
                  <p>Add topics or hashtags</p>
                </div>
              </div>
              <ChevronRight size={12} className="chevron" />
            </button>



            <button 
              onClick={() => setWorkspaceMode(workspaceMode === 'preview' ? 'editor' : 'preview')}
              className={`hubble-tool-row-btn ${workspaceMode === 'preview' ? 'active' : ''}`}
            >
              <div className="hubble-tool-content-group">
                <div className="hubble-tool-icon-box purple"><Sparkles size={12} /></div>
                <div className="hubble-tool-text">
                  <strong>Preview</strong>
                  <p>See how it looks</p>
                </div>
              </div>
              <ChevronRight size={12} className="chevron" />
            </button>

            <button 
              onClick={() => setWorkspaceMode(workspaceMode === 'drafts' ? 'editor' : 'drafts')}
              className={`hubble-tool-row-btn ${workspaceMode === 'drafts' ? 'active' : ''}`}
            >
              <div className="hubble-tool-content-group">
                <div className="hubble-tool-icon-box zinc"><FileText size={12} /></div>
                <div className="hubble-tool-text">
                  <strong>Drafts</strong>
                  <p>View your saved drafts</p>
                </div>
              </div>
              <ChevronRight size={12} className="chevron" />
            </button>
          </div>
        </div>
      </div>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        multiple 
        accept="image/*,video/*" 
        style={{ display: 'none' }} 
      />
    </div>
  );
};

export default CreatePost;
