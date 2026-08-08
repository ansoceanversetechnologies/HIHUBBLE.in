// Hi-Hubble Video Editor Controller (Phase 1)
// Implements client-side Canvas video rendering, trimming, splitting, rotation, speed, background music mixing, and exporting.

export function initVideoEditor(API_URL, showToast, loadFeedReels) {
  // --- UI Elements ---
  const exploreCreateModal = document.getElementById('explore-create-modal');
  const exploreCreateBtn = document.getElementById('explore-create-btn');

  // Screen 1 Elements
  const screen1 = document.getElementById('explore-editor-screen-1');
  const canvas = document.getElementById('editor-canvas');
  const ctx = canvas.getContext('2d');
  const playPauseBtn = document.getElementById('editor-play-pause-btn');
  const timeDisplay = document.getElementById('editor-time-display');
  const ratioBadge = document.getElementById('editor-ratio-badge');
  const timelineEmpty = document.getElementById('editor-timeline-empty');
  const timelineContainer = document.getElementById('editor-timeline');
  const clipCountDisplay = document.getElementById('editor-clip-count');

  const trimStartInput = document.getElementById('editor-trim-start');
  const trimEndInput = document.getElementById('editor-trim-end');
  const splitBtn = document.getElementById('editor-split-btn');
  const rotateBtn = document.getElementById('editor-rotate-btn');
  const cropBtn = document.getElementById('editor-crop-btn');
  const cropDrawer = document.getElementById('editor-crop-drawer');
  const cropResetBtn = document.getElementById('editor-crop-reset');
  const cropFitToggleBtn = document.getElementById('editor-crop-fit-toggle');
  const cropLeftInput = document.getElementById('editor-crop-left');
  const cropRightInput = document.getElementById('editor-crop-right');
  const cropTopInput = document.getElementById('editor-crop-top');
  const cropBottomInput = document.getElementById('editor-crop-bottom');
  const cropLeftVal = document.getElementById('crop-left-val');
  const cropRightVal = document.getElementById('crop-right-val');
  const cropTopVal = document.getElementById('crop-top-val');
  const cropBottomVal = document.getElementById('crop-bottom-val');
  const speedSelect = document.getElementById('editor-speed-select');
  const ratioSelect = document.getElementById('editor-ratio-select');
  const tabBasic = document.getElementById('tab-editor-basic');
  const tabAdvanced = document.getElementById('tab-editor-advanced');
  const tabPro = document.getElementById('tab-editor-pro');
  const basicPanel = document.getElementById('editor-basic-panel');
  const advancedPanel = document.getElementById('editor-advanced-panel');
  const proPanel = document.getElementById('editor-pro-panel');

  // Phase 2 Advanced Editing References
  const advFilterSelect = document.getElementById('adv-filter-select');
  const advBrightness = document.getElementById('adv-brightness');
  const advBrightVal = document.getElementById('adv-bright-val');
  const advContrast = document.getElementById('adv-contrast');
  const advContrastVal = document.getElementById('adv-contrast-val');
  const advSaturation = document.getElementById('adv-saturation');
  const advSaturateVal = document.getElementById('adv-saturate-val');
  const advExposure = document.getElementById('adv-exposure');
  const advExposureVal = document.getElementById('adv-exposure-val');

  const advTransitionSelect = document.getElementById('adv-transition-select');
  const advTransitionDuration = document.getElementById('adv-transition-duration');
  const advTransitionDurationVal = document.getElementById('adv-transition-duration-val');

  const advTextInput = document.getElementById('adv-text-input');
  const advTextColor = document.getElementById('adv-text-color');
  const advTextAnim = document.getElementById('adv-text-anim');
  const advTextPosX = document.getElementById('adv-text-pos-x');
  const advTextPosY = document.getElementById('adv-text-pos-y');
  const advAddTextBtn = document.getElementById('adv-add-text-btn');
  const advTextList = document.getElementById('adv-text-list');
  const advTextSize = document.getElementById('adv-text-size');
  const advTextFont = document.getElementById('adv-text-font');
  const advTextBold = document.getElementById('adv-text-bold');
  const advTextItalic = document.getElementById('adv-text-italic');
  const advTextOutline = document.getElementById('adv-text-outline');
  const advTextOutlineColor = document.getElementById('adv-text-outline-color');

  const advEmojiSize = document.getElementById('adv-emoji-size');
  const advEmojiPosY = document.getElementById('adv-emoji-pos-y');
  const advEmojiList = document.getElementById('adv-emoji-list');

  const advPipFileInput = document.getElementById('adv-pip-file-input');
  const advPipUploadBtn = document.getElementById('adv-pip-upload-btn');
  const advPipFilename = document.getElementById('adv-pip-filename');
  const advPipScale = document.getElementById('adv-pip-scale');
  const advPipOpacity = document.getElementById('adv-pip-opacity');
  const advAddPipBtn = document.getElementById('adv-add-pip-btn');
  const advPipList = document.getElementById('adv-pip-list');

  const advMicRecordBtn = document.getElementById('adv-mic-record-btn');
  const advMicStatus = document.getElementById('adv-mic-status');
  const advVoiceoverPreviewContainer = document.getElementById('adv-voiceover-preview-container');
  const advVoiceoverPreview = document.getElementById('adv-voiceover-preview');
  const advVoiceoverInfo = document.getElementById('adv-voiceover-info');
  const advDeleteVoiceBtn = document.getElementById('adv-delete-voice-btn');
  const advSetVoiceoverBtn = document.getElementById('adv-set-voiceover-btn');

  const importMediaBtn = document.getElementById('editor-import-media-btn');
  const fileInput = document.getElementById('editor-file-input');
  const addAudioBtn = document.getElementById('editor-add-audio-btn');
  const audioInput = document.getElementById('editor-audio-input');
  const resolutionSelect = document.getElementById('editor-resolution-select');
  const toScreen2Btn = document.getElementById('editor-to-screen-2-btn');

  const audioStatus = document.getElementById('editor-audio-status');
  const audioNameSpan = document.getElementById('editor-audio-name');
  const removeAudioBtn = document.getElementById('editor-remove-audio');

  const editorVideoVolume = document.getElementById('editor-video-volume');
  const editorVideoVolumeVal = document.getElementById('editor-video-volume-val');
  const editorMusicVolume = document.getElementById('editor-music-volume');
  const editorMusicVolumeVal = document.getElementById('editor-music-volume-val');

  // Screen 2 Elements
  const screen2 = document.getElementById('explore-editor-screen-2');
  const captionInput = document.getElementById('editor-caption');
  const hashtagsInput = document.getElementById('editor-hashtags-input');
  const hashtagsList = document.getElementById('editor-hashtags-list');
  const mentionsInput = document.getElementById('editor-mentions-input');
  const mentionsList = document.getElementById('editor-mentions-list');
  const locationInput = document.getElementById('editor-location');
  const backToScreen1Btn = document.getElementById('editor-back-to-screen-1-btn');
  const toScreen3Btn = document.getElementById('editor-to-screen-3-btn');

  // Screen 3 Elements
  const screen3 = document.getElementById('explore-editor-screen-3');
  const finalVideo = document.getElementById('editor-final-video');
  const renderingOverlay = document.getElementById('editor-rendering-overlay');
  const renderPercentage = document.getElementById('editor-render-percentage');
  const reviewCaption = document.getElementById('editor-review-caption');
  const reviewAudio = document.getElementById('editor-review-audio');
  const reviewLocation = document.getElementById('editor-review-location');
  const reviewResolution = document.getElementById('editor-review-resolution');
  const reviewDuration = document.getElementById('editor-review-duration');
  const backToScreen2Btn = document.getElementById('editor-back-to-screen-2-btn');
  const postBtn = document.getElementById('editor-post-btn');

  // Global Close Buttons
  const closeBtns = document.querySelectorAll('.explore-editor-close-btn');

  // --- Editor State ---
  let clips = []; // Array of clip objects
  let selectedClipIndex = null;
  let bgAudio = null; // Background audio object { file, base64, url, element }
  let isPlaying = false;
  let currentPlaybackTime = 0; // Cumulative time in seconds
  let totalDuration = 0;
  let videoVolume = 1.0;
  let musicVolume = 0.5;
  let animationFrameId = null;
  let targetWidth = 1080;
  let targetHeight = 1920; // Default 9:16
  let pxPerSec = 15;

  let hashtags = [];
  let mentions = [];

  // Interactive Cropping State
  let isCropMode = false;
  let dragHandle = null; // 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right', 'top', 'bottom', or 'move'
  let startX = 0;
  let startY = 0;
  let startCrop = {};

  // Interactive Overlays State (Advanced Panel)
  let isAdvancedMode = false;
  let selectedOverlayType = null; // 'text' or 'sticker'
  let selectedOverlayIndex = null; // null or number index
  let dragOverlayMode = null; // 'move' or 'resize'
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartOverlayPos = {};


  // Web Audio Context for mixing
  let audioCtx = null;
  let audioDest = null;

  // --- Setup Canvas Size ---
  function updateCanvasDimensions() {
    const ratio = ratioSelect.value;
    ratioBadge.innerText = ratio;
    if (ratio === '9:16') {
      canvas.width = 360;
      canvas.height = 640;
      targetWidth = 1080;
      targetHeight = 1920;
    } else if (ratio === '1:1') {
      canvas.width = 500;
      canvas.height = 500;
      targetWidth = 1080;
      targetHeight = 1080;
    } else if (ratio === '16:9') {
      canvas.width = 640;
      canvas.height = 360;
      targetWidth = 1920;
      targetHeight = 1080;
    }
    renderCurrentFrame();
  }

  if (ratioSelect) {
    ratioSelect.addEventListener('change', updateCanvasDimensions);
  }

  // --- Import Media Event Handlers ---
  if (importMediaBtn && fileInput) {
    importMediaBtn.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (!files.length) return;

      for (let file of files) {
        const isVideo = file.type.startsWith('video/');
        const url = URL.createObjectURL(file);

        const clip = {
          id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          file: file,
          type: isVideo ? 'video' : 'image',
          url: url,
          name: file.name,
          duration: isVideo ? 0 : 3.0, // Images default to 3s
          startTrim: 0,
          endTrim: isVideo ? 0 : 3.0,
          speed: 1.0,
          rotation: 0, // 0, 90, 180, 270 degrees
          fitMode: 'cover',
          cropLeft: 0,
          cropRight: 0,
          cropTop: 0,
          cropBottom: 0,
          brightness: 100,
          contrast: 100,
          saturation: 100,
          exposure: 100,
          filterType: 'none',
          transitionType: 'none',
          transitionDuration: 0.5,
          textOverlays: [],
          stickerOverlays: [],
          pipOverlays: [],
          voiceOverUrl: null,
          voiceOverElement: null,
          element: null
        };

        if (isVideo) {
          const videoElement = document.createElement('video');
          videoElement.src = url;
          videoElement.muted = false;
          videoElement.volume = videoVolume; // Set initial volume mix setting
          videoElement.playsInline = true;

          await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
              clip.duration = videoElement.duration;
              clip.endTrim = videoElement.duration;
              clip.element = videoElement;
              resolve();
            };
          });
        } else {
          const imgElement = new Image();
          imgElement.src = url;
          await new Promise((resolve) => {
            imgElement.onload = () => {
              clip.element = imgElement;
              resolve();
            };
          });
        }

        clips.push(clip);
      }

      fileInput.value = '';
      selectClip(clips.length - 1);
      updateTimelineUI();
      recalculateTotalDuration();
      toScreen2Btn.disabled = clips.length === 0;
    });
  }

  // --- Add Background Music ---
  if (addAudioBtn && audioInput) {
    addAudioBtn.addEventListener('click', () => audioInput.click());
  }

  if (audioInput) {
    audioInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const url = URL.createObjectURL(file);
      const audioEl = new Audio(url);
      audioEl.loop = false;
      audioEl.volume = musicVolume; // Apply current volume mix configuration

      const reader = new FileReader();
      reader.onload = (event) => {
        bgAudio = {
          file: file,
          url: url,
          base64: event.target.result,
          element: audioEl,
          startTime: 0
        };

        audioStatus.style.display = 'flex';
        audioNameSpan.innerText = file.name;
        updateTimelineUI(); // Refresh timeline to render BGM track bar
      };
      reader.readAsDataURL(file);
    });
  }

  if (removeAudioBtn) {
    removeAudioBtn.addEventListener('click', () => {
      if (bgAudio && bgAudio.element) {
        bgAudio.element.pause();
        try { URL.revokeObjectURL(bgAudio.url); } catch (e) { }
      }
      bgAudio = null;
      audioStatus.style.display = 'none';
      audioNameSpan.innerText = 'None';
      audioInput.value = '';
      updateTimelineUI(); // Refresh timeline to remove BGM track bar
    });
  }

  // --- Volume Controls ---
  if (editorVideoVolume) {
    editorVideoVolume.addEventListener('input', () => {
      videoVolume = parseInt(editorVideoVolume.value) / 100;
      if (editorVideoVolumeVal) {
        editorVideoVolumeVal.innerText = `${editorVideoVolume.value}%`;
      }
      clips.forEach(clip => {
        if (clip.element && clip.type === 'video') {
          clip.element.volume = videoVolume;
        }
      });
    });
  }

  if (editorMusicVolume) {
    editorMusicVolume.addEventListener('input', () => {
      musicVolume = parseInt(editorMusicVolume.value) / 100;
      if (editorMusicVolumeVal) {
        editorMusicVolumeVal.innerText = `${editorMusicVolume.value}%`;
      }
      if (bgAudio && bgAudio.element) {
        bgAudio.element.volume = musicVolume;
      }
      updateTimelineUI(); // Update volume labels dynamically on track representation
    });
  }

  // --- Timeline UI rendering ---
  function updateTimelineUI() {
    timelineContainer.innerHTML = '';

    if (clips.length === 0) {
      timelineContainer.appendChild(timelineEmpty);
      clipCountDisplay.innerText = '0 clips';
      return;
    }

    clipCountDisplay.innerText = `${clips.length} clip${clips.length > 1 ? 's' : ''}`;

    // Determine scale for horizontal tracks (pixels per second)
    const containerWidth = timelineContainer.clientWidth || 600;
    pxPerSec = Math.max(15, (containerWidth - 24) / (totalDuration || 1));
    const totalWidth = totalDuration * pxPerSec;

    // Create wrapper for the tracks
    const wrapper = document.createElement('div');
    wrapper.id = 'editor-tracks-container';
    wrapper.style.cssText = `position: relative; width: ${totalWidth}px; display: flex; flex-direction: column; gap: 6px; padding: 4px 0; box-sizing: border-box; user-select: none;`;

    // 1. Playhead vertical marker
    const playhead = document.createElement('div');
    playhead.id = 'editor-timeline-playhead';
    playhead.style.cssText = `position: absolute; top: 0; bottom: 0; width: 2px; background: #a855f7; z-index: 10; pointer-events: none; left: 0; transition: left 0.05s linear;`;

    const playheadHandle = document.createElement('div');
    playheadHandle.style.cssText = `position: absolute; top: -2px; left: -5px; width: 12px; height: 12px; background: #a855f7; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5); cursor: grab;`;
    playhead.appendChild(playheadHandle);
    wrapper.appendChild(playhead);

    // 2. Time Ruler Track
    const ruler = document.createElement('div');
    ruler.id = 'editor-track-ruler';
    ruler.style.cssText = `height: 18px; position: relative; border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.01); font-size: 8px; color: rgba(255,255,255,0.4); font-family: monospace; overflow: hidden; cursor: pointer;`;

    const tickInterval = totalDuration > 60 ? 10 : (totalDuration > 30 ? 5 : 2);
    for (let t = 0; t <= totalDuration; t += tickInterval) {
      const mark = document.createElement('div');
      mark.style.cssText = `position: absolute; left: ${t * pxPerSec}px; top: 0; height: 100%; border-left: 1px solid rgba(255,255,255,0.15); padding-left: 3px; display: flex; align-items: flex-end; padding-bottom: 2px;`;
      mark.innerText = `${t}s`;
      ruler.appendChild(mark);
    }

    const syncSeek = (globalTime) => {
      let cumulativeTime = 0;
      clips.forEach(c => {
        const duration = (c.endTrim - c.startTrim) / c.speed;
        if (globalTime >= cumulativeTime && globalTime <= cumulativeTime + duration) {
          const localOffset = c.startTrim + (globalTime - cumulativeTime) * c.speed;
          if (c.type === 'video' && c.element) {
            c.element.currentTime = localOffset;
          }
        } else {
          if (c.type === 'video' && c.element) {
            if (globalTime < cumulativeTime) {
              c.element.currentTime = c.startTrim;
            } else {
              c.element.currentTime = c.endTrim;
            }
          }
        }
        cumulativeTime += duration;
      });

      if (bgAudio && bgAudio.element) {
        const start = bgAudio.startTime || 0;
        const localTime = globalTime - start;
        if (localTime >= 0 && localTime < bgAudio.element.duration) {
          bgAudio.element.currentTime = localTime;
        } else {
          bgAudio.element.currentTime = 0;
        }
      }
    };

    const handleScrub = (e) => {
      const rect = wrapper.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const scrubTime = (clickX / totalWidth) * totalDuration;
      currentPlaybackTime = Math.max(0, Math.min(totalDuration, scrubTime));
      syncSeek(currentPlaybackTime);
      updateTimeDisplay();
      renderCurrentFrame();
    };

    ruler.addEventListener('mousedown', (e) => {
      handleScrub(e);
      const onMouseMove = (moveEvent) => {
        handleScrub(moveEvent);
      };
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
    wrapper.appendChild(ruler);

    // 3. Video track
    const videoTrack = document.createElement('div');
    videoTrack.id = 'editor-track-video';
    videoTrack.style.cssText = `height: 44px; display: flex; position: relative; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; overflow: hidden;`;

    let currentX = 0;
    clips.forEach((clip, index) => {
      const duration = (clip.endTrim - clip.startTrim) / clip.speed;
      const width = duration * pxPerSec;

      const item = document.createElement('div');
      item.className = `timeline-clip-item ${selectedClipIndex === index ? 'selected' : ''}`;
      // Increased padding to 24px to separate inner contents (like delete button) from the drag handles
      item.style.cssText = `position: absolute; left: ${currentX}px; width: ${width}px; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; border-right: 1px solid rgba(255,255,255,0.08); cursor: pointer; font-size: 10px; color: white; box-sizing: border-box; overflow: hidden;`;

      // Thumbnail
      const thumb = document.createElement(clip.type === 'video' ? 'video' : 'img');
      thumb.src = clip.url;
      thumb.style.cssText = `width: 32px; height: 32px; object-fit: cover; border-radius: 4px; background: #000; border: 1px solid rgba(255,255,255,0.15); user-select: none; pointer-events: none;`;
      if (clip.type === 'video') {
        thumb.currentTime = clip.startTrim;
      }
      item.appendChild(thumb);

      const label = document.createElement('span');
      label.innerText = `${index + 1}: ${clip.name.substring(0, 12)}`;
      label.style.cssText = `font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin: 0 8px; text-align: left; user-select: none; pointer-events: none;`;
      item.appendChild(label);

      const rightRow = document.createElement('div');
      rightRow.style.cssText = `display: flex; align-items: center; gap: 6px; z-index: 6;`;

      const durationLabel = document.createElement('span');
      durationLabel.className = 'timeline-clip-duration';
      durationLabel.innerText = `${duration.toFixed(1)}s`;
      durationLabel.style.cssText = `color: var(--text-muted); font-size: 9px; user-select: none; pointer-events: none;`;
      rightRow.appendChild(durationLabel);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'clip-delete-btn';
      deleteBtn.innerHTML = '×';
      deleteBtn.style.cssText = `background: rgba(239, 68, 68, 0.2); border: none; color: #f87171; font-size: 12px; border-radius: 4px; width: 18px; height: 18px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; line-height: 1; padding: 0;`;
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeClip(index);
      });
      rightRow.appendChild(deleteBtn);

      item.appendChild(rightRow);

      // Drag handles for video trimming - increased width to 16px and styled with premium double vertical grip indicators
      const leftHandle = document.createElement('div');
      leftHandle.className = 'clip-trim-handle-left';
      leftHandle.style.cssText = `position: absolute; left: 0; top: 0; bottom: 0; width: 16px; background: rgba(168, 85, 247, 0.4); border-right: 1px solid rgba(255, 255, 255, 0.3); cursor: ew-resize; z-index: 5; display: flex; align-items: center; justify-content: center; transition: background 0.15s;`;
      leftHandle.innerHTML = `<div style="display: flex; gap: 2px; align-items: center; pointer-events: none;"><div style="width: 2px; height: 14px; background: rgba(255,255,255,0.8); border-radius: 1px;"></div><div style="width: 2px; height: 14px; background: rgba(255,255,255,0.8); border-radius: 1px;"></div></div>`;
      leftHandle.addEventListener('mouseenter', () => { leftHandle.style.background = 'rgba(168, 85, 247, 0.9)'; });
      leftHandle.addEventListener('mouseleave', () => { leftHandle.style.background = 'rgba(168, 85, 247, 0.4)'; });

      const rightHandle = document.createElement('div');
      rightHandle.className = 'clip-trim-handle-right';
      rightHandle.style.cssText = `position: absolute; right: 0; top: 0; bottom: 0; width: 16px; background: rgba(168, 85, 247, 0.4); border-left: 1px solid rgba(255, 255, 255, 0.3); cursor: ew-resize; z-index: 5; display: flex; align-items: center; justify-content: center; transition: background 0.15s;`;
      rightHandle.innerHTML = `<div style="display: flex; gap: 2px; align-items: center; pointer-events: none;"><div style="width: 2px; height: 14px; background: rgba(255,255,255,0.8); border-radius: 1px;"></div><div style="width: 2px; height: 14px; background: rgba(255,255,255,0.8); border-radius: 1px;"></div></div>`;
      rightHandle.addEventListener('mouseenter', () => { rightHandle.style.background = 'rgba(168, 85, 247, 0.9)'; });
      rightHandle.addEventListener('mouseleave', () => { rightHandle.style.background = 'rgba(168, 85, 247, 0.4)'; });

      item.appendChild(leftHandle);
      item.appendChild(rightHandle);

      // Event listener for left trim handle
      leftHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        selectClip(index);

        const startClientX = e.clientX;
        const origStartTrim = clip.startTrim;
        const origEndTrim = clip.endTrim;

        const onMouseMove = (moveEvent) => {
          const deltaX = moveEvent.clientX - startClientX;
          const deltaTime = deltaX / pxPerSec;

          let newStartTrim = origStartTrim + deltaTime * clip.speed;
          newStartTrim = Math.max(0, Math.min(origEndTrim - 0.1, newStartTrim));

          clip.startTrim = newStartTrim;

          if (trimStartInput) {
            trimStartInput.value = newStartTrim.toFixed(1);
            trimStartInput.max = (clip.endTrim - 0.1).toFixed(1);
          }

          recalculateTotalDuration();
          seekTimelineToClipFrame(index, newStartTrim);
          updateTimelineDOMWidths(pxPerSec);
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          updateTimelineUI();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });

      // Event listener for right trim handle
      rightHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        selectClip(index);

        const startClientX = e.clientX;
        const origStartTrim = clip.startTrim;
        const origEndTrim = clip.endTrim;

        const onMouseMove = (moveEvent) => {
          const deltaX = moveEvent.clientX - startClientX;
          const deltaTime = deltaX / pxPerSec;

          let newEndTrim = origEndTrim + deltaTime * clip.speed;
          newEndTrim = Math.max(origStartTrim + 0.1, Math.min(clip.duration, newEndTrim));

          clip.endTrim = newEndTrim;

          if (trimEndInput) {
            trimEndInput.value = newEndTrim.toFixed(1);
            trimStartInput.max = (newEndTrim - 0.1).toFixed(1);
          }

          recalculateTotalDuration();
          seekTimelineToClipFrame(index, newEndTrim);
          updateTimelineDOMWidths(pxPerSec);
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          updateTimelineUI();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });

      item.addEventListener('click', (e) => {
        if (e.target !== deleteBtn && e.target !== leftHandle && e.target !== rightHandle) {
          selectClip(index);
        }
      });
      videoTrack.appendChild(item);

      currentX += width;
    });
    wrapper.appendChild(videoTrack);

    // 4. Background music track
    if (bgAudio) {
      const audioTrackContainer = document.createElement('div');
      audioTrackContainer.id = 'editor-track-audio-container';
      audioTrackContainer.style.cssText = `height: 24px; width: 100%; position: relative; background: rgba(0,0,0,0.15); border-radius: 4px; border: 1px dashed rgba(16, 185, 129, 0.2); overflow: hidden;`;

      const audioTrack = document.createElement('div');
      audioTrack.id = 'editor-track-audio';

      const audioDuration = bgAudio.element ? bgAudio.element.duration || 10 : 10;
      const audioWidth = audioDuration * pxPerSec;

      audioTrack.style.cssText = `height: 100%; position: absolute; left: ${(bgAudio.startTime || 0) * pxPerSec}px; width: ${audioWidth}px; border-radius: 4px; background: rgba(16, 185, 129, 0.25); border: 1px solid rgba(16, 185, 129, 0.6); font-size: 9px; color: #10b981; display: flex; align-items: center; padding: 0 8px; box-sizing: border-box; cursor: grab; overflow: hidden;`;

      const audioText = document.createElement('span');
      audioText.className = 'bgm-text';
      audioText.style.cssText = `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; user-select: none; pointer-events: none;`;
      audioText.innerHTML = `<span style="font-weight:bold; margin-right:4px;">🎵 BGM:</span> ${bgAudio.file.name.substring(0, 20)} (${(bgAudio.startTime || 0).toFixed(1)}s - ${((bgAudio.startTime || 0) + audioDuration).toFixed(1)}s)`;
      audioTrack.appendChild(audioText);

      const volLabel = document.createElement('span');
      volLabel.style.cssText = `margin-left: auto; font-weight: 600; background: rgba(16, 185, 129, 0.2); padding: 1px 4px; border-radius: 3px; user-select: none; pointer-events: none;`;
      volLabel.innerText = `Vol: ${Math.round(musicVolume * 100)}%`;
      audioTrack.appendChild(volLabel);

      // Dragging event listener for BGM
      audioTrack.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        audioTrack.style.cursor = 'grabbing';

        const startX = e.clientX;
        const origStartTime = bgAudio.startTime || 0;

        const onMouseMove = (moveEvent) => {
          const deltaX = moveEvent.clientX - startX;
          const deltaTime = deltaX / pxPerSec;
          let newStartTime = origStartTime + deltaTime;
          newStartTime = Math.max(0, Math.min(totalDuration - 0.2, newStartTime));

          bgAudio.startTime = newStartTime;
          audioTrack.style.left = `${newStartTime * pxPerSec}px`;

          audioText.innerHTML = `<span style="font-weight:bold; margin-right:4px;">🎵 BGM:</span> ${bgAudio.file.name.substring(0, 20)} (${newStartTime.toFixed(1)}s - ${(newStartTime + audioDuration).toFixed(1)}s)`;
        };

        const onMouseUp = () => {
          audioTrack.style.cursor = 'grab';
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          updateTimelineUI();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });

      audioTrackContainer.appendChild(audioTrack);
      wrapper.appendChild(audioTrackContainer);
    }

    // 5. Voiceover track
    let hasVoiceover = false;
    clips.forEach(c => { if (c.voiceOverUrl) hasVoiceover = true; });

    if (hasVoiceover) {
      const voiceTrack = document.createElement('div');
      voiceTrack.id = 'editor-track-voiceover';
      voiceTrack.style.cssText = `height: 24px; display: flex; position: relative; border-radius: 4px; background: rgba(248, 113, 113, 0.15); border: 1px solid rgba(248, 113, 113, 0.3); font-size: 9px; color: #f87171; align-items: center; padding: 0 8px; box-sizing: border-box; overflow: hidden;`;

      let vX = 0;
      clips.forEach((c, idx) => {
        const duration = (c.endTrim - c.startTrim) / c.speed;
        if (c.voiceOverUrl) {
          const vBar = document.createElement('div');
          vBar.style.cssText = `position: absolute; left: ${vX}px; width: ${duration * pxPerSec}px; height: 100%; display: flex; align-items: center; background: rgba(248, 113, 113, 0.2); border-right: 1px solid rgba(248, 113, 113, 0.3); padding: 0 6px; box-sizing: border-box;`;
          vBar.innerText = `🎙️ Voiceover [Clip ${idx + 1}]`;
          voiceTrack.appendChild(vBar);
        }
        vX += duration * pxPerSec;
      });
      voiceTrack.style.width = `${vX}px`;
      wrapper.appendChild(voiceTrack);
    }

    timelineContainer.appendChild(wrapper);
    updateTimeDisplay();
  }

  function seekTimelineToClipFrame(index, frameTime) {
    let cumulativeTime = 0;
    for (let i = 0; i < index; i++) {
      cumulativeTime += (clips[i].endTrim - clips[i].startTrim) / clips[i].speed;
    }

    const clip = clips[index];
    const offset = (frameTime - clip.startTrim) / clip.speed;
    currentPlaybackTime = cumulativeTime + offset;

    if (clip && clip.element) {
      if (clip.type === 'video') {
        clip.element.currentTime = frameTime;
      }
    }

    updateTimeDisplay();
    renderCurrentFrame();
  }

  function updateTimelineDOMWidths(pxPerSec) {
    const wrapper = document.getElementById('editor-tracks-container');
    if (!wrapper) return;

    const totalWidth = totalDuration * pxPerSec;
    wrapper.style.width = `${totalWidth}px`;

    const ruler = document.getElementById('editor-track-ruler');
    if (ruler) {
      ruler.innerHTML = '';
      const tickInterval = totalDuration > 60 ? 10 : (totalDuration > 30 ? 5 : 2);
      for (let t = 0; t <= totalDuration; t += tickInterval) {
        const mark = document.createElement('div');
        mark.style.cssText = `position: absolute; left: ${t * pxPerSec}px; top: 0; height: 100%; border-left: 1px solid rgba(255,255,255,0.15); padding-left: 3px; display: flex; align-items: flex-end; padding-bottom: 2px;`;
        mark.innerText = `${t}s`;
        ruler.appendChild(mark);
      }
    }

    const clipItems = wrapper.querySelectorAll('.timeline-clip-item');
    let currentX = 0;
    clips.forEach((clip, index) => {
      const duration = (clip.endTrim - clip.startTrim) / clip.speed;
      const width = duration * pxPerSec;

      const item = clipItems[index];
      if (item) {
        item.style.left = `${currentX}px`;
        item.style.width = `${width}px`;

        const label = item.querySelector('.timeline-clip-duration');
        if (label) {
          label.innerText = `${duration.toFixed(1)}s`;
        }
      }
      currentX += width;
    });

    if (bgAudio) {
      const audioTrack = document.getElementById('editor-track-audio');
      if (audioTrack) {
        const audioDuration = bgAudio.element ? bgAudio.element.duration || 10 : 10;
        audioTrack.style.left = `${(bgAudio.startTime || 0) * pxPerSec}px`;
        audioTrack.style.width = `${audioDuration * pxPerSec}px`;
      }
    }

    const voiceTrack = document.getElementById('editor-track-voiceover');
    if (voiceTrack) {
      let vX = 0;
      const vBars = voiceTrack.children;
      let barIdx = 0;
      clips.forEach((c, idx) => {
        const duration = (c.endTrim - c.startTrim) / c.speed;
        if (c.voiceOverUrl && barIdx < vBars.length) {
          const vBar = vBars[barIdx++];
          vBar.style.left = `${vX}px`;
          vBar.style.width = `${duration * pxPerSec}px`;
        }
        vX += duration * pxPerSec;
      });
      voiceTrack.style.width = `${vX}px`;
    }

    updateTimeDisplay();
  }

  function syncBGMusicPlayback() {
    if (!bgAudio || !bgAudio.element) return;
    const audio = bgAudio.element;
    const audioDur = audio.duration || 0;
    const start = bgAudio.startTime || 0;

    if (isPlaying) {
      const localTime = currentPlaybackTime - start;
      if (localTime >= 0 && localTime < audioDur) {
        if (audio.paused) {
          audio.play().catch(e => console.warn(e));
        }
        if (Math.abs(audio.currentTime - localTime) > 0.3) {
          audio.currentTime = localTime;
        }
      } else {
        if (!audio.paused) {
          audio.pause();
        }
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }

  function selectClip(index) {
    if (index >= clips.length) {
      selectedClipIndex = clips.length > 0 ? clips.length - 1 : null;
    } else {
      selectedClipIndex = index;
    }

    updateTimelineUI();

    if (selectedClipIndex === null) {
      trimStartInput.disabled = true;
      trimEndInput.disabled = true;
      splitBtn.disabled = true;
      rotateBtn.disabled = true;
      if (cropBtn) cropBtn.disabled = true;
      speedSelect.disabled = true;

      if (advTextList) advTextList.innerHTML = '';
      if (advEmojiList) advEmojiList.innerHTML = '';
      if (advPipList) advPipList.innerHTML = '';
      if (advVoiceoverInfo) advVoiceoverInfo.style.display = 'none';
      return;
    }

    const clip = clips[selectedClipIndex];

    trimStartInput.disabled = false;
    trimEndInput.disabled = false;
    splitBtn.disabled = false;
    rotateBtn.disabled = false;
    if (cropBtn) {
      cropBtn.disabled = false;
      cropBtn.innerHTML = '<i data-lucide="crop" style="width:12px; height:12px;"></i> Crop';
      if (window.debouncedCreateIcons) window.debouncedCreateIcons();
    }
    if (cropLeftInput) {
      cropLeftInput.value = clip.cropLeft || 0;
      cropLeftVal.innerText = `${clip.cropLeft || 0}%`;
    }
    if (cropRightInput) {
      cropRightInput.value = clip.cropRight || 0;
      cropRightVal.innerText = `${clip.cropRight || 0}%`;
    }
    if (cropTopInput) {
      cropTopInput.value = clip.cropTop || 0;
      cropTopVal.innerText = `${clip.cropTop || 0}%`;
    }
    if (cropBottomInput) {
      cropBottomInput.value = clip.cropBottom || 0;
      cropBottomVal.innerText = `${clip.cropBottom || 0}%`;
    }
    if (cropFitToggleBtn) {
      cropFitToggleBtn.innerText = clip.fitMode === 'cover' ? 'Mode: Fill' : 'Mode: Fit';
    }
    speedSelect.disabled = false;

    trimStartInput.value = clip.startTrim.toFixed(1);
    trimStartInput.max = (clip.endTrim - 0.1).toFixed(1);
    trimEndInput.value = clip.endTrim.toFixed(1);
    trimEndInput.max = clip.duration.toFixed(1);

    speedSelect.value = clip.speed.toString();

    // Update Advanced Editor Sliders & Selects
    if (advFilterSelect) advFilterSelect.value = clip.filterType || 'none';
    if (advBrightness) {
      advBrightness.value = clip.brightness || 100;
      advBrightVal.innerText = `${clip.brightness || 100}%`;
    }
    if (advContrast) {
      advContrast.value = clip.contrast || 100;
      advContrastVal.innerText = `${clip.contrast || 100}%`;
    }
    if (advSaturation) {
      advSaturation.value = clip.saturation || 100;
      advSaturateVal.innerText = `${clip.saturation || 100}%`;
    }
    if (advExposure) {
      advExposure.value = clip.exposure || 100;
      advExposureVal.innerText = `${clip.exposure || 100}%`;
    }

    if (advTransitionSelect) advTransitionSelect.value = clip.transitionType || 'none';
    if (advTransitionDuration) {
      advTransitionDuration.value = Math.round((clip.transitionDuration || 0.5) * 10);
      advTransitionDurationVal.innerText = `${(clip.transitionDuration || 0.5).toFixed(1)}s`;
    }

    // Refresh overlay displays
    updateTextOverlaysList();
    updateStickerOverlaysList();
    updatePipOverlaysList();
    updateVoiceoverUI();

    // seek to clip start frame in preview
    seekTimelineToClip(selectedClipIndex);
  }

  function removeClip(index) {
    const clip = clips[index];
    try { URL.revokeObjectURL(clip.url); } catch (e) { }

    clips.splice(index, 1);
    if (selectedClipIndex === index) {
      selectedClipIndex = clips.length > 0 ? 0 : null;
    } else if (selectedClipIndex > index) {
      selectedClipIndex--;
    }

    selectClip(selectedClipIndex);
    updateTimelineUI();
    recalculateTotalDuration();
    toScreen2Btn.disabled = clips.length === 0;
  }

  function recalculateTotalDuration() {
    totalDuration = clips.reduce((sum, clip) => {
      return sum + ((clip.endTrim - clip.startTrim) / clip.speed);
    }, 0);
    updateTimeDisplay();
  }

  function updateTimeDisplay() {
    const pad = (num) => String(Math.floor(num)).padStart(2, '0');
    const curMin = pad(currentPlaybackTime / 60);
    const curSec = pad(currentPlaybackTime % 60);
    const totMin = pad(totalDuration / 60);
    const totSec = pad(totalDuration % 60);
    timeDisplay.innerText = `${curMin}:${curSec} / ${totMin}:${totSec}`;

    // Update playhead position on timeline
    const playhead = document.getElementById('editor-timeline-playhead');
    if (playhead && totalDuration > 0) {
      const container = document.getElementById('editor-tracks-container');
      if (container) {
        const pxPerSec = container.clientWidth / totalDuration;
        playhead.style.left = `${currentPlaybackTime * pxPerSec}px`;
      }
    }
  }

  // --- Seek Playback Position ---
  function seekTimelineToClip(index) {
    let cumulativeTime = 0;
    for (let i = 0; i < index; i++) {
      cumulativeTime += (clips[i].endTrim - clips[i].startTrim) / clips[i].speed;
    }
    currentPlaybackTime = cumulativeTime;

    const clip = clips[index];
    if (clip && clip.type === 'video' && clip.element) {
      clip.element.currentTime = clip.startTrim;
    }

    updateTimeDisplay();
    renderCurrentFrame();
    syncBGMusicPlayback();
  }

  // --- Trim Controls ---
  if (trimStartInput) {
    trimStartInput.addEventListener('change', () => {
      if (selectedClipIndex === null) return;
      const clip = clips[selectedClipIndex];
      let val = parseFloat(trimStartInput.value);
      if (isNaN(val) || val < 0) val = 0;
      if (val >= clip.endTrim) val = clip.endTrim - 0.1;

      clip.startTrim = val;
      trimStartInput.value = val.toFixed(1);
      recalculateTotalDuration();
      updateTimelineUI();
      seekTimelineToClip(selectedClipIndex);
    });
  }

  if (trimEndInput) {
    trimEndInput.addEventListener('change', () => {
      if (selectedClipIndex === null) return;
      const clip = clips[selectedClipIndex];
      let val = parseFloat(trimEndInput.value);
      if (isNaN(val) || val > clip.duration) val = clip.duration;
      if (val <= clip.startTrim) val = clip.startTrim + 0.1;

      clip.endTrim = val;
      trimEndInput.value = val.toFixed(1);
      recalculateTotalDuration();
      updateTimelineUI();
      seekTimelineToClip(selectedClipIndex);
    });
  }

  // --- Clip Split ---
  if (splitBtn) {
    splitBtn.addEventListener('click', () => {
      if (selectedClipIndex === null) return;
      const clip = clips[selectedClipIndex];

      // Calculate split point relative to clip's local timeline
      let relativePlayhead = clip.startTrim + 1.0; // split after 1s from start by default
      if (relativePlayhead >= clip.endTrim) {
        showToast('Clip too short to split! ✂️');
        return;
      }

      const secondHalfUrl = clip.url; // Reuse same Blob URL

      // Create cloned element for video split
      let clonedElement = null;
      if (clip.type === 'video') {
        clonedElement = document.createElement('video');
        clonedElement.src = clip.url;
        clonedElement.muted = false;
        clonedElement.playsInline = true;
      } else {
        clonedElement = new Image();
        clonedElement.src = clip.url;
      }

      const splitClip = {
        id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        file: clip.file,
        type: clip.type,
        url: secondHalfUrl,
        name: clip.name + ' (Split)',
        duration: clip.duration,
        startTrim: relativePlayhead,
        endTrim: clip.endTrim,
        speed: clip.speed,
        rotation: clip.rotation,
        fitMode: clip.fitMode || 'cover',
        cropLeft: clip.cropLeft || 0,
        cropRight: clip.cropRight || 0,
        cropTop: clip.cropTop || 0,
        cropBottom: clip.cropBottom || 0,
        brightness: clip.brightness || 100,
        contrast: clip.contrast || 100,
        saturation: clip.saturation || 100,
        exposure: clip.exposure || 100,
        filterType: clip.filterType || 'none',
        transitionType: clip.transitionType || 'none',
        transitionDuration: clip.transitionDuration || 0.5,
        textOverlays: JSON.parse(JSON.stringify(clip.textOverlays || [])),
        stickerOverlays: JSON.parse(JSON.stringify(clip.stickerOverlays || [])),
        pipOverlays: JSON.parse(JSON.stringify(clip.pipOverlays || [])),
        voiceOverUrl: clip.voiceOverUrl || null,
        voiceOverElement: clip.voiceOverUrl ? new Audio(clip.voiceOverUrl) : null,
        element: clonedElement
      };

      // Shrink original clip end boundary
      clip.endTrim = relativePlayhead;

      // Insert new split clip right after selected index
      clips.splice(selectedClipIndex + 1, 0, splitClip);

      selectClip(selectedClipIndex);
      updateTimelineUI();
      recalculateTotalDuration();
      showToast('Clip split successfully! ✂️');
    });
  }

  // --- Clip Rotate ---
  if (rotateBtn) {
    rotateBtn.addEventListener('click', () => {
      if (selectedClipIndex === null) return;
      const clip = clips[selectedClipIndex];
      clip.rotation = (clip.rotation + 90) % 360;
      renderCurrentFrame();
      showToast(`Rotated clip ${clip.rotation}° 🔄`);
    });
  }

  // --- Clip Crop/Fit Toggle ---
  // --- Clip Crop Panel Toggle & Sliders ---
  if (cropBtn) {
    cropBtn.addEventListener('click', () => {
      if (selectedClipIndex === null) return;
      if (cropDrawer) {
        const isHidden = cropDrawer.style.display === 'none' || !cropDrawer.style.display;
        cropDrawer.style.display = isHidden ? 'flex' : 'none';
        isCropMode = isHidden;
        if (isHidden) {
          cropBtn.classList.add('active');
        } else {
          cropBtn.classList.remove('active');
          canvas.style.cursor = 'default';
        }
        renderCurrentFrame();
      }
    });
  }

  function handleCropChange(direction, value) {
    if (selectedClipIndex === null) return;
    const clip = clips[selectedClipIndex];
    const val = parseInt(value) || 0;

    if (direction === 'left') {
      clip.cropLeft = val;
      if (cropLeftVal) cropLeftVal.innerText = `${val}%`;
    } else if (direction === 'right') {
      clip.cropRight = val;
      if (cropRightVal) cropRightVal.innerText = `${val}%`;
    } else if (direction === 'top') {
      clip.cropTop = val;
      if (cropTopVal) cropTopVal.innerText = `${val}%`;
    } else if (direction === 'bottom') {
      clip.cropBottom = val;
      if (cropBottomVal) cropBottomVal.innerText = `${val}%`;
    }
    renderCurrentFrame();
  }

  if (cropLeftInput) {
    cropLeftInput.addEventListener('input', (e) => handleCropChange('left', e.target.value));
  }
  if (cropRightInput) {
    cropRightInput.addEventListener('input', (e) => handleCropChange('right', e.target.value));
  }
  if (cropTopInput) {
    cropTopInput.addEventListener('input', (e) => handleCropChange('top', e.target.value));
  }
  if (cropBottomInput) {
    cropBottomInput.addEventListener('input', (e) => handleCropChange('bottom', e.target.value));
  }

  // --- Canvas Mouse Crop Interactions ---
  function getMouseLocalPos(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Scale to internal canvas coordinates
    const cx = mx * (canvas.width / rect.width);
    const cy = my * (canvas.height / rect.height);

    if (selectedClipIndex === null) return { cx, cy };
    const clip = clips[selectedClipIndex];

    // Local coordinates: reverse translation & rotation
    const tx = cx - canvas.width / 2;
    const ty = cy - canvas.height / 2;
    const rad = -(clip.rotation * Math.PI) / 180;
    const lx = tx * Math.cos(rad) - ty * Math.sin(rad);
    const ly = tx * Math.sin(rad) + ty * Math.cos(rad);

    return { cx, cy, lx, ly };
  }

  function getCropDimensions(clip) {
    const media = clip.element;
    if (!media) return { dw: 0, dh: 0 };

    let sw, sh;
    if (clip.type === 'video') {
      sw = media.videoWidth || 640;
      sh = media.videoHeight || 360;
    } else {
      sw = media.naturalWidth || 500;
      sh = media.naturalHeight || 500;
    }

    const isRotated90or270 = clip.rotation === 90 || clip.rotation === 270;
    const cw = isRotated90or270 ? canvas.height : canvas.width;
    const ch = isRotated90or270 ? canvas.width : canvas.height;

    const fitMode = clip.fitMode || 'cover';
    const scale = fitMode === 'cover'
      ? Math.max(cw / sw, ch / sh)
      : Math.min(cw / sw, ch / sh);

    return {
      sw, sh,
      dw: sw * scale,
      dh: sh * scale
    };
  }

  function getVisibleOverlays(clip) {
    const state = getPlaybackRenderState(currentPlaybackTime);
    const localOffset = state ? (state.isTransitioning ? state.localOffsetA : state.localOffset) : clip.startTrim;
    const clipLocalTime = localOffset - clip.startTrim;

    const visibleTexts = [];
    (clip.textOverlays || []).forEach((overlay, idx) => {
      if (clipLocalTime >= overlay.startTime && clipLocalTime <= overlay.endTime) {
        visibleTexts.push({ overlay, type: 'text', index: idx });
      }
    });

    const visibleStickers = [];
    (clip.stickerOverlays || []).forEach((sticker, idx) => {
      if (clipLocalTime >= sticker.startTime && clipLocalTime <= sticker.endTime) {
        visibleStickers.push({ overlay: sticker, type: 'sticker', index: idx });
      }
    });

    const visiblePips = [];
    (clip.pipOverlays || []).forEach((pip, idx) => {
      if (clipLocalTime >= pip.startTime && clipLocalTime <= pip.endTime) {
        visiblePips.push({ overlay: pip, type: 'pip', index: idx });
      }
    });

    return [...visiblePips, ...visibleTexts, ...visibleStickers];
  }

  if (canvas) {
    canvas.addEventListener('mousedown', (e) => {
      if (isCropMode) {
        if (selectedClipIndex === null) return;
        const clip = clips[selectedClipIndex];
        const { lx, ly } = getMouseLocalPos(e);
        const { dw, dh } = getCropDimensions(clip);
        if (!dw || !dh) return;

        const lx1 = -dw / 2 + dw * ((clip.cropLeft || 0) / 100);
        const ly1 = -dh / 2 + dh * ((clip.cropTop || 0) / 100);
        const lx2 = -dw / 2 + dw * (1 - (clip.cropRight || 0) / 100);
        const ly2 = -dh / 2 + dh * (1 - (clip.cropBottom || 0) / 100);

        const clickThreshold = 12; // Tolerance for clicking handles in pixels

        const near = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2) <= clickThreshold;
        const nearLine = (val, target) => Math.abs(val - target) <= clickThreshold;

        // Check corners
        if (near(lx, ly, lx1, ly1)) dragHandle = 'top-left';
        else if (near(lx, ly, lx2, ly1)) dragHandle = 'top-right';
        else if (near(lx, ly, lx1, ly2)) dragHandle = 'bottom-left';
        else if (near(lx, ly, lx2, ly2)) dragHandle = 'bottom-right';
        // Check edges
        else if (nearLine(ly, ly1) && lx > lx1 && lx < lx2) dragHandle = 'top';
        else if (nearLine(ly, ly2) && lx > lx1 && lx < lx2) dragHandle = 'bottom';
        else if (nearLine(lx, lx1) && ly > ly1 && ly < ly2) dragHandle = 'left';
        else if (nearLine(lx, lx2) && ly > ly1 && ly < ly2) dragHandle = 'right';
        // Check interior for move
        else if (lx > lx1 && lx < lx2 && ly > ly1 && ly < ly2) dragHandle = 'move';

        if (dragHandle) {
          startX = lx;
          startY = ly;
          startCrop = {
            left: clip.cropLeft || 0,
            right: clip.cropRight || 0,
            top: clip.cropTop || 0,
            bottom: clip.cropBottom || 0
          };
          e.preventDefault();
        }
      } else if (isAdvancedMode && selectedClipIndex !== null) {
        const clip = clips[selectedClipIndex];
        const rect = canvas.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const cy = (e.clientY - rect.top) * (canvas.height / rect.height);

        const visibleOverlays = getVisibleOverlays(clip);

        // 1. Check if we clicked on the resize handle of the currently selected overlay
        if (selectedOverlayType !== null && selectedOverlayIndex !== null) {
          let activeOverlay = null;
          if (selectedOverlayType === 'text') activeOverlay = clip.textOverlays[selectedOverlayIndex];
          else if (selectedOverlayType === 'sticker') activeOverlay = clip.stickerOverlays[selectedOverlayIndex];
          else if (selectedOverlayType === 'pip') activeOverlay = clip.pipOverlays[selectedOverlayIndex];

          if (activeOverlay) {
            const bounds = getOverlayBounds(activeOverlay, selectedOverlayType, canvas);
            const hx = bounds.x2;
            const hy = bounds.y2;
            if (Math.hypot(cx - hx, cy - hy) <= 12) {
              dragOverlayMode = 'resize';
              dragStartX = cx;
              dragStartY = cy;
              dragStartOverlayPos = {
                size: (selectedOverlayType === 'pip') ? activeOverlay.scale : (activeOverlay.size || (selectedOverlayType === 'text' ? 28 : 40))
              };
              e.preventDefault();
              return;
            }
          }
        }

        // 2. Check if we clicked inside any visible overlay
        let hit = false;
        for (let i = visibleOverlays.length - 1; i >= 0; i--) {
          const { overlay, type, index } = visibleOverlays[i];
          const bounds = getOverlayBounds(overlay, type, canvas);

          if (cx >= bounds.x1 && cx <= bounds.x2 && cy >= bounds.y1 && cy <= bounds.y2) {
            selectedOverlayType = type;
            selectedOverlayIndex = index;
            dragOverlayMode = 'move';
            dragStartX = cx;
            dragStartY = cy;
            dragStartOverlayPos = {
              x: overlay.x || 30,
              y: overlay.y || 30
            };

            if (type === 'text') {
              selectTextOverlay(index);
            } else if (type === 'sticker') {
              selectStickerOverlay(index);
            } else if (type === 'pip') {
              selectPipOverlay(index);
            }
            hit = true;
            e.preventDefault();
            break;
          }
        }

        if (!hit) {
          selectedOverlayType = null;
          selectedOverlayIndex = null;
          updateTextOverlaysList();
          updateStickerOverlaysList();
          updatePipOverlaysList();
          renderCurrentFrame();
        }
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (isCropMode) {
        if (selectedClipIndex === null) return;
        const clip = clips[selectedClipIndex];
        const { lx, ly } = getMouseLocalPos(e);
        const { dw, dh } = getCropDimensions(clip);
        if (!dw || !dh) return;

        const lx1 = -dw / 2 + dw * ((clip.cropLeft || 0) / 100);
        const ly1 = -dh / 2 + dh * ((clip.cropTop || 0) / 100);
        const lx2 = -dw / 2 + dw * (1 - (clip.cropRight || 0) / 100);
        const ly2 = -dh / 2 + dh * (1 - (clip.cropBottom || 0) / 100);

        const clickThreshold = 12;
        const near = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2) <= clickThreshold;
        const nearLine = (val, target) => Math.abs(val - target) <= clickThreshold;

        if (!dragHandle) {
          // Update cursor style based on hover
          if (near(lx, ly, lx1, ly1) || near(lx, ly, lx2, ly2)) {
            canvas.style.cursor = 'nwse-resize';
          } else if (near(lx, ly, lx2, ly1) || near(lx, ly, lx1, ly2)) {
            canvas.style.cursor = 'nesw-resize';
          } else if (nearLine(ly, ly1) && lx > lx1 && lx < lx2) {
            canvas.style.cursor = 'ns-resize';
          } else if (nearLine(ly, ly2) && lx > lx1 && lx < lx2) {
            canvas.style.cursor = 'ns-resize';
          } else if (nearLine(lx, lx1) && ly > ly1 && ly < ly2) {
            canvas.style.cursor = 'ew-resize';
          } else if (nearLine(lx, lx2) && ly > ly1 && ly < ly2) {
            canvas.style.cursor = 'ew-resize';
          } else if (lx > lx1 && lx < lx2 && ly > ly1 && ly < ly2) {
            canvas.style.cursor = 'move';
          } else {
            canvas.style.cursor = 'default';
          }
          return;
        }

        // Currently dragging
        const dx = lx - startX;
        const dy = ly - startY;

        // Convert pixel delta to percentage of dw, dh
        const pctX = (dx / dw) * 100;
        const pctY = (dy / dh) * 100;

        let newLeft = clip.cropLeft || 0;
        let newRight = clip.cropRight || 0;
        let newTop = clip.cropTop || 0;
        let newBottom = clip.cropBottom || 0;

        const maxCrop = 45; // Max 45% crop to prevent collapsing

        if (dragHandle === 'left') {
          newLeft = Math.max(0, Math.min(maxCrop, startCrop.left + pctX));
        } else if (dragHandle === 'right') {
          newRight = Math.max(0, Math.min(maxCrop, startCrop.right - pctX));
        } else if (dragHandle === 'top') {
          newTop = Math.max(0, Math.min(maxCrop, startCrop.top + pctY));
        } else if (dragHandle === 'bottom') {
          newBottom = Math.max(0, Math.min(maxCrop, startCrop.bottom - pctY));
        } else if (dragHandle === 'top-left') {
          newLeft = Math.max(0, Math.min(maxCrop, startCrop.left + pctX));
          newTop = Math.max(0, Math.min(maxCrop, startCrop.top + pctY));
        } else if (dragHandle === 'top-right') {
          newRight = Math.max(0, Math.min(maxCrop, startCrop.right - pctX));
          newTop = Math.max(0, Math.min(maxCrop, startCrop.top + pctY));
        } else if (dragHandle === 'bottom-left') {
          newLeft = Math.max(0, Math.min(maxCrop, startCrop.left + pctX));
          newBottom = Math.max(0, Math.min(maxCrop, startCrop.bottom - pctY));
        } else if (dragHandle === 'bottom-right') {
          newRight = Math.max(0, Math.min(maxCrop, startCrop.right - pctX));
          newBottom = Math.max(0, Math.min(maxCrop, startCrop.bottom - pctY));
        } else if (dragHandle === 'move') {
          const boxW = 100 - startCrop.left - startCrop.right;
          const boxH = 100 - startCrop.top - startCrop.bottom;

          newLeft = Math.max(0, Math.min(100 - boxW, startCrop.left + pctX));
          newRight = 100 - boxW - newLeft;
          newTop = Math.max(0, Math.min(100 - boxH, startCrop.top + pctY));
          newBottom = 100 - boxH - newTop;

          newLeft = Math.max(0, newLeft);
          newRight = Math.max(0, newRight);
          newTop = Math.max(0, newTop);
          newBottom = Math.max(0, newBottom);
        }

        // Apply values
        clip.cropLeft = Math.round(newLeft);
        clip.cropRight = Math.round(newRight);
        clip.cropTop = Math.round(newTop);
        clip.cropBottom = Math.round(newBottom);

        // Update UI elements in the drawer
        if (cropLeftInput) {
          cropLeftInput.value = clip.cropLeft;
          cropLeftVal.innerText = `${clip.cropLeft}%`;
        }
        if (cropRightInput) {
          cropRightInput.value = clip.cropRight;
          cropRightVal.innerText = `${clip.cropRight}%`;
        }
        if (cropTopInput) {
          cropTopInput.value = clip.cropTop;
          cropTopVal.innerText = `${clip.cropTop}%`;
        }
        if (cropBottomInput) {
          cropBottomInput.value = clip.cropBottom;
          cropBottomVal.innerText = `${clip.cropBottom}%`;
        }

        renderCurrentFrame();
      } else if (isAdvancedMode && selectedClipIndex !== null) {
        const clip = clips[selectedClipIndex];
        const rect = canvas.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const cy = (e.clientY - rect.top) * (canvas.height / rect.height);

        if (dragOverlayMode) {
          let activeOverlay = null;
          if (selectedOverlayType === 'text') activeOverlay = clip.textOverlays[selectedOverlayIndex];
          else if (selectedOverlayType === 'sticker') activeOverlay = clip.stickerOverlays[selectedOverlayIndex];
          else if (selectedOverlayType === 'pip') activeOverlay = clip.pipOverlays[selectedOverlayIndex];

          if (activeOverlay) {
            const dx = cx - dragStartX;
            const dy = cy - dragStartY;

            if (dragOverlayMode === 'move') {
              const pctX = (dx / canvas.width) * 100;
              const pctY = (dy / canvas.height) * 100;

              activeOverlay.x = Math.max(5, Math.min(95, Math.round(dragStartOverlayPos.x + pctX)));
              activeOverlay.y = Math.max(5, Math.min(95, Math.round(dragStartOverlayPos.y + pctY)));

              if (selectedOverlayType === 'text') {
                if (advTextPosX) advTextPosX.value = activeOverlay.x;
                if (advTextPosY) advTextPosY.value = activeOverlay.y;
              } else if (selectedOverlayType === 'sticker') {
                if (advEmojiPosY) advEmojiPosY.value = activeOverlay.y;
              }
            } else if (dragOverlayMode === 'resize') {
              if (selectedOverlayType === 'pip') {
                const sizeChange = Math.round(dx / 5);
                activeOverlay.scale = Math.max(15, Math.min(80, dragStartOverlayPos.size + sizeChange));
                if (advPipScale) advPipScale.value = activeOverlay.scale;
              } else {
                const sizeChange = Math.round(dx);
                const minSize = selectedOverlayType === 'text' ? 12 : 20;
                const maxSize = selectedOverlayType === 'text' ? 72 : 80;
                activeOverlay.size = Math.max(minSize, Math.min(maxSize, dragStartOverlayPos.size + sizeChange));

                if (selectedOverlayType === 'text') {
                  if (advTextSize) advTextSize.value = activeOverlay.size;
                } else {
                  if (advEmojiSize) advEmojiSize.value = activeOverlay.size;
                }
              }
            }

            renderCurrentFrame();
          }
        } else {
          const visibleOverlays = getVisibleOverlays(clip);
          let cursorSet = false;

          if (selectedOverlayType !== null && selectedOverlayIndex !== null) {
            let activeOverlay = null;
            if (selectedOverlayType === 'text') activeOverlay = clip.textOverlays[selectedOverlayIndex];
            else if (selectedOverlayType === 'sticker') activeOverlay = clip.stickerOverlays[selectedOverlayIndex];
            else if (selectedOverlayType === 'pip') activeOverlay = clip.pipOverlays[selectedOverlayIndex];

            if (activeOverlay) {
              const bounds = getOverlayBounds(activeOverlay, selectedOverlayType, canvas);
              if (Math.hypot(cx - bounds.x2, cy - bounds.y2) <= 12) {
                canvas.style.cursor = 'nwse-resize';
                cursorSet = true;
              }
            }
          }

          if (!cursorSet) {
            for (let i = visibleOverlays.length - 1; i >= 0; i--) {
              const { overlay, type } = visibleOverlays[i];
              const bounds = getOverlayBounds(overlay, type, canvas);
              if (cx >= bounds.x1 && cx <= bounds.x2 && cy >= bounds.y1 && cy <= bounds.y2) {
                canvas.style.cursor = 'move';
                cursorSet = true;
                break;
              }
            }
          }

          if (!cursorSet) {
            canvas.style.cursor = 'default';
          }
        }
      }
    });
  }

  window.addEventListener('mouseup', () => {
    dragHandle = null;
    dragOverlayMode = null;
  });

  if (cropFitToggleBtn) {
    cropFitToggleBtn.addEventListener('click', () => {
      if (selectedClipIndex === null) return;
      const clip = clips[selectedClipIndex];
      clip.fitMode = (clip.fitMode === 'cover') ? 'contain' : 'cover';

      if (clip.fitMode === 'cover') {
        cropFitToggleBtn.innerText = 'Mode: Fill';
        showToast('Set to Fill (Cover) ✂️');
      } else {
        cropFitToggleBtn.innerText = 'Mode: Fit';
        showToast('Set to Fit (Letterbox) 📺');
      }
      renderCurrentFrame();
    });
  }

  if (cropResetBtn) {
    cropResetBtn.addEventListener('click', () => {
      if (selectedClipIndex === null) return;
      const clip = clips[selectedClipIndex];
      clip.cropLeft = 0;
      clip.cropRight = 0;
      clip.cropTop = 0;
      clip.cropBottom = 0;
      clip.fitMode = 'cover';

      if (cropLeftInput) {
        cropLeftInput.value = 0;
        cropLeftVal.innerText = '0%';
      }
      if (cropRightInput) {
        cropRightInput.value = 0;
        cropRightVal.innerText = '0%';
      }
      if (cropTopInput) {
        cropTopInput.value = 0;
        cropTopVal.innerText = '0%';
      }
      if (cropBottomInput) {
        cropBottomInput.value = 0;
        cropBottomVal.innerText = '0%';
      }
      if (cropFitToggleBtn) {
        cropFitToggleBtn.innerText = 'Mode: Fit';
      }
      showToast('Crop settings reset! 🔄');
      renderCurrentFrame();
    });
  }

  // --- Clip Speed ---
  if (speedSelect) {
    speedSelect.addEventListener('change', () => {
      if (selectedClipIndex === null) return;
      const clip = clips[selectedClipIndex];
      clip.speed = parseFloat(speedSelect.value);
      recalculateTotalDuration();
      updateTimelineUI();
    });
  }

  // --- Canvas Rendering Loop ---
  // --- Canvas Rendering Loop ---
  function getPlaybackRenderState(time) {
    let cumulative = 0;
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const clipDur = (clip.endTrim - clip.startTrim) / clip.speed;

      const transitionType = clip.transitionType || 'none';
      const transitionDuration = clip.transitionDuration || 0.5;

      // Check if we are in a transition to the next clip
      if (i < clips.length - 1 && transitionType !== 'none') {
        const transStart = (cumulative + clipDur) - transitionDuration;
        const transEnd = cumulative + clipDur;

        if (time >= transStart && time < transEnd) {
          const nextClip = clips[i + 1];
          const progress = (time - transStart) / transitionDuration;

          const localOffsetA = (time - cumulative) * clip.speed;
          const localOffsetB = (time - transEnd) * nextClip.speed;

          return {
            isTransitioning: true,
            clipA: clip,
            clipB: nextClip,
            localOffsetA: clip.startTrim + localOffsetA,
            localOffsetB: nextClip.startTrim + localOffsetB,
            progress: progress,
            transitionType: transitionType,
            activeClipIndex: i
          };
        }
      }

      if (time >= cumulative && time < cumulative + clipDur) {
        return {
          isTransitioning: false,
          clip: clip,
          localOffset: clip.startTrim + (time - cumulative) * clip.speed,
          activeClipIndex: i
        };
      }
      cumulative += clipDur;
    }
    return null;
  }

  function getClipAtGlobalTime(time) {
    const state = getPlaybackRenderState(time);
    if (!state) return null;
    if (state.isTransitioning) {
      return { clip: state.clipA, index: state.activeClipIndex, localOffset: state.localOffsetA - state.clipA.startTrim };
    }
    return { clip: state.clip, index: state.activeClipIndex, localOffset: state.localOffset - state.clip.startTrim };
  }

  function drawClipFrame(clip, localOffset, ctxTarget, canvasTarget, opacity = 1.0, offsetX = 0, offsetY = 0, scaleFactor = 1.0) {
    const media = clip.element;
    if (!media) return;

    ctxTarget.save();
    ctxTarget.globalAlpha = opacity;

    // Move to canvas center + offset to apply translation & rotation
    ctxTarget.translate(canvasTarget.width / 2 + offsetX, canvasTarget.height / 2 + offsetY);
    ctxTarget.rotate((clip.rotation * Math.PI) / 180);
    ctxTarget.scale(scaleFactor, scaleFactor);

    // Calculate source dimensions
    let sw, sh;
    if (clip.type === 'video') {
      sw = media.videoWidth || 640;
      sh = media.videoHeight || 360;
    } else {
      sw = media.naturalWidth || 500;
      sh = media.naturalHeight || 500;
    }

    const isRotated90or270 = clip.rotation === 90 || clip.rotation === 270;
    const cw = isRotated90or270 ? canvasTarget.height : canvasTarget.width;
    const ch = isRotated90or270 ? canvasTarget.width : canvasTarget.height;

    // Crop calculations
    const cropLeft = clip.cropLeft || 0;
    const cropRight = clip.cropRight || 0;
    const cropTop = clip.cropTop || 0;
    const cropBottom = clip.cropBottom || 0;

    const sx = sw * (cropLeft / 100);
    const sy = sh * (cropTop / 100);
    let sWidth = sw * (1 - (cropLeft + cropRight) / 100);
    let sHeight = sh * (1 - (cropTop + cropBottom) / 100);

    if (sWidth <= 0) sWidth = sw;
    if (sHeight <= 0) sHeight = sh;

    const fitMode = clip.fitMode || 'contain';
    const scale = fitMode === 'cover'
      ? Math.max(cw / sWidth, ch / sHeight)
      : Math.min(cw / sWidth, ch / sHeight);

    const dw = sWidth * scale;
    const dh = sHeight * scale;

    // Apply color filters & adjustments
    let filterString = `brightness(${clip.brightness || 100}%) contrast(${clip.contrast || 100}%) saturate(${clip.saturation || 100}%)`;
    if (clip.exposure !== 100) {
      filterString += ` brightness(${clip.exposure || 100}%)`;
    }
    if (clip.filterType === 'grayscale') {
      filterString += ' grayscale(100%)';
    } else if (clip.filterType === 'sepia') {
      filterString += ' sepia(100%)';
    } else if (clip.filterType === 'vintage') {
      filterString += ' sepia(50%) hue-rotate(-30deg) saturate(140%)';
    } else if (clip.filterType === 'cool') {
      filterString += ' hue-rotate(30deg) saturate(90%)';
    } else if (clip.filterType === 'warm') {
      filterString += ' hue-rotate(-20deg) saturate(110%)';
    }
    ctxTarget.filter = filterString;

    try {
      ctxTarget.drawImage(media, sx, sy, sWidth, sHeight, -dw / 2, -dh / 2, dw, dh);
    } catch (e) {
      console.warn("Frame draw skip:", e.message);
    }

    ctxTarget.restore();
  }

  function drawCropModeFrame(clip, localOffset, ctxTarget, canvasTarget) {
    const media = clip.element;
    if (!media) return;

    ctxTarget.save();

    // Move to canvas center to apply translation & rotation
    ctxTarget.translate(canvasTarget.width / 2, canvasTarget.height / 2);
    ctxTarget.rotate((clip.rotation * Math.PI) / 180);

    // Calculate source dimensions
    let sw, sh;
    if (clip.type === 'video') {
      sw = media.videoWidth || 640;
      sh = media.videoHeight || 360;
    } else {
      sw = media.naturalWidth || 500;
      sh = media.naturalHeight || 500;
    }

    const isRotated90or270 = clip.rotation === 90 || clip.rotation === 270;
    const cw = isRotated90or270 ? canvasTarget.height : canvasTarget.width;
    const ch = isRotated90or270 ? canvasTarget.width : canvasTarget.height;

    // Full video scaling (in crop mode, we fit the entire video to canvas)
    const fitMode = clip.fitMode || 'cover';
    const scale = fitMode === 'cover'
      ? Math.max(cw / sw, ch / sh)
      : Math.min(cw / sw, ch / sh);

    const dw = sw * scale;
    const dh = sh * scale;

    // Apply color filters & adjustments
    let filterString = `brightness(${clip.brightness || 100}%) contrast(${clip.contrast || 100}%) saturate(${clip.saturation || 100}%)`;
    if (clip.exposure !== 100) {
      filterString += ` brightness(${clip.exposure || 100}%)`;
    }
    if (clip.filterType === 'grayscale') {
      filterString += ' grayscale(100%)';
    } else if (clip.filterType === 'sepia') {
      filterString += ' sepia(100%)';
    } else if (clip.filterType === 'vintage') {
      filterString += ' sepia(50%) hue-rotate(-30deg) saturate(140%)';
    } else if (clip.filterType === 'cool') {
      filterString += ' hue-rotate(30deg) saturate(90%)';
    } else if (clip.filterType === 'warm') {
      filterString += ' hue-rotate(-20deg) saturate(110%)';
    }
    ctxTarget.filter = filterString;

    // Draw the full video frame
    try {
      ctxTarget.drawImage(media, 0, 0, sw, sh, -dw / 2, -dh / 2, dw, dh);
    } catch (e) {
      console.warn("Crop preview frame draw skip:", e.message);
    }

    // Now, let's calculate the crop box coordinates in local space
    const cropLeft = clip.cropLeft || 0;
    const cropRight = clip.cropRight || 0;
    const cropTop = clip.cropTop || 0;
    const cropBottom = clip.cropBottom || 0;

    const lx1 = -dw / 2 + dw * (cropLeft / 100);
    const ly1 = -dh / 2 + dh * (cropTop / 100);
    const lx2 = -dw / 2 + dw * (1 - cropRight / 100);
    const ly2 = -dh / 2 + dh * (1 - cropBottom / 100);

    const boxW = lx2 - lx1;
    const boxH = ly2 - ly1;

    // Reset filter for overlays
    ctxTarget.filter = 'none';

    // Draw the dimmed overlay outside the crop box
    ctxTarget.fillStyle = 'rgba(0, 0, 0, 0.6)';

    // Top overlay
    ctxTarget.fillRect(-dw / 2, -dh / 2, dw, ly1 - (-dh / 2));
    // Bottom overlay
    ctxTarget.fillRect(-dw / 2, ly2, dw, dh / 2 - ly2);
    // Left overlay
    ctxTarget.fillRect(-dw / 2, ly1, lx1 - (-dw / 2), boxH);
    // Right overlay
    ctxTarget.fillRect(lx2, ly1, dw / 2 - lx2, boxH);

    // Draw crop box border (dashed violet and solid white)
    ctxTarget.strokeStyle = '#a855f7'; // violet
    ctxTarget.lineWidth = 2;
    ctxTarget.setLineDash([6, 4]);
    ctxTarget.strokeRect(lx1, ly1, boxW, boxH);
    ctxTarget.setLineDash([]); // Reset line dash

    ctxTarget.strokeStyle = '#ffffff';
    ctxTarget.lineWidth = 1;
    ctxTarget.strokeRect(lx1, ly1, boxW, boxH);

    // Draw handles
    ctxTarget.fillStyle = '#ffffff';
    ctxTarget.strokeStyle = '#a855f7';
    ctxTarget.lineWidth = 2;

    const handleRadius = 6;

    // Corners (circles)
    const corners = [
      { x: lx1, y: ly1 }, // Top-Left
      { x: lx2, y: ly1 }, // Top-Right
      { x: lx1, y: ly2 }, // Bottom-Left
      { x: lx2, y: ly2 }  // Bottom-Right
    ];

    corners.forEach(c => {
      ctxTarget.beginPath();
      ctxTarget.arc(c.x, c.y, handleRadius, 0, Math.PI * 2);
      ctxTarget.fill();
      ctxTarget.stroke();
    });

    // Edges (squares)
    const edges = [
      { x: lx1 + boxW / 2, y: ly1 }, // Top
      { x: lx1 + boxW / 2, y: ly2 }, // Bottom
      { x: lx1, y: ly1 + boxH / 2 }, // Left
      { x: lx2, y: ly1 + boxH / 2 }  // Right
    ];

    edges.forEach(e => {
      ctxTarget.beginPath();
      ctxTarget.rect(e.x - 4, e.y - 4, 8, 8);
      ctxTarget.fill();
      ctxTarget.stroke();
    });

    ctxTarget.restore();
  }

  function exitCropMode() {
    isCropMode = false;
    if (cropDrawer) cropDrawer.style.display = 'none';
    if (cropBtn) cropBtn.classList.remove('active');
    canvas.style.cursor = 'default';
  }

  function getOverlayBounds(overlay, type, canvasTarget) {
    const tx = canvasTarget.width * (overlay.x / 100);
    const ty = canvasTarget.height * (overlay.y / 100);

    let boxW, boxH;
    if (type === 'text') {
      const boldStr = overlay.bold ? 'bold ' : '';
      const italicStr = overlay.italic ? 'italic ' : '';
      const fontSize = overlay.size || 28;
      const fontFam = overlay.font || 'Outfit';

      ctx.save();
      ctx.font = `${boldStr}${italicStr}${fontSize}px ${fontFam}, sans-serif`;
      const metrics = ctx.measureText(overlay.text);
      boxW = metrics.width + 16;
      boxH = fontSize + 16;
      ctx.restore();
    } else if (type === 'pip') {
      boxW = canvasTarget.width * ((overlay.scale || 30) / 100);
      let aspect = 1.0;
      if (overlay.element) {
        const ew = overlay.element.videoWidth || overlay.element.naturalWidth || overlay.element.width || 1;
        const eh = overlay.element.videoHeight || overlay.element.naturalHeight || overlay.element.height || 1;
        aspect = ew / eh;
      }
      boxH = boxW / aspect;
    } else {
      const size = overlay.size || 40;
      boxW = size + 16;
      boxH = size + 16;
    }

    return {
      x1: tx - boxW / 2,
      y1: ty - boxH / 2,
      x2: tx + boxW / 2,
      y2: ty + boxH / 2,
      w: boxW,
      h: boxH,
      cx: tx,
      cy: ty
    };
  }

  function drawOverlaySelectionBox(overlay, type, ctxTarget, canvasTarget) {
    ctxTarget.save();

    const bounds = getOverlayBounds(overlay, type, canvasTarget);

    // Draw dashed selection border
    ctxTarget.strokeStyle = '#a855f7'; // purple accent
    ctxTarget.lineWidth = 1.5;
    ctxTarget.setLineDash([4, 3]);
    ctxTarget.strokeRect(bounds.x1, bounds.y1, bounds.w, bounds.h);
    ctxTarget.setLineDash([]);

    // Draw solid inner border
    ctxTarget.strokeStyle = '#ffffff';
    ctxTarget.lineWidth = 0.8;
    ctxTarget.strokeRect(bounds.x1, bounds.y1, bounds.w, bounds.h);

    // Draw resize handle at bottom-right corner
    const hr = 5; // handle radius
    const hx = bounds.x2;
    const hy = bounds.y2;

    ctxTarget.fillStyle = '#ffffff';
    ctxTarget.strokeStyle = '#a855f7';
    ctxTarget.lineWidth = 1.5;
    ctxTarget.beginPath();
    ctxTarget.arc(hx, hy, hr, 0, Math.PI * 2);
    ctxTarget.fill();
    ctxTarget.stroke();

    ctxTarget.restore();
  }

  function drawOverlays(clip, localOffset, ctxTarget, canvasTarget) {
    const localTime = localOffset / clip.speed;

    // 1. Draw PIP overlays
    (clip.pipOverlays || []).forEach(pip => {
      if (localTime >= pip.startTime && localTime <= pip.endTime && pip.element) {
        ctxTarget.save();

        // Apply transparency/opacity
        const opacity = (pip.opacity !== undefined ? pip.opacity : 100) / 100;
        ctxTarget.globalAlpha = opacity;

        const bounds = getOverlayBounds(pip, 'pip', canvasTarget);

        try {
          ctxTarget.drawImage(pip.element, bounds.x1, bounds.y1, bounds.w, bounds.h);
        } catch (err) { }
        ctxTarget.restore();
      }
    });

    // 2. Draw Text overlays
    (clip.textOverlays || []).forEach(overlay => {
      if (localTime >= overlay.startTime && localTime <= overlay.endTime) {
        ctxTarget.save();

        const progress = localTime - overlay.startTime;
        let opacity = 1.0;
        let scale = 1.0;
        let offsetY = 0;

        if (overlay.animation === 'fade' && progress < 0.5) {
          opacity = progress / 0.5;
        } else if (overlay.animation === 'slide' && progress < 0.5) {
          offsetY = (1 - (progress / 0.5)) * 30;
        } else if (overlay.animation === 'zoom' && progress < 0.5) {
          scale = progress / 0.5;
        }

        ctxTarget.globalAlpha = opacity;
        ctxTarget.fillStyle = overlay.color || '#ffffff';

        // Font styles
        const boldStr = overlay.bold ? 'bold ' : '';
        const italicStr = overlay.italic ? 'italic ' : '';
        const fontSize = overlay.size || 28;
        const fontFam = overlay.font || 'Outfit';
        ctxTarget.font = `${boldStr}${italicStr}${fontSize}px ${fontFam}, sans-serif`;

        ctxTarget.textAlign = 'center';
        ctxTarget.textBaseline = 'middle';

        const targetX = canvasTarget.width * (overlay.x / 100);
        const targetY = canvasTarget.height * (overlay.y / 100) + offsetY;

        ctxTarget.translate(targetX, targetY);
        ctxTarget.scale(scale, scale);

        ctxTarget.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctxTarget.shadowBlur = 4;
        ctxTarget.shadowOffsetX = 2;
        ctxTarget.shadowOffsetY = 2;

        // Render text outline if enabled
        if (overlay.outline) {
          ctxTarget.strokeStyle = overlay.outlineColor || '#000000';
          ctxTarget.lineWidth = Math.max(1, fontSize / 8);
          ctxTarget.strokeText(overlay.text, 0, 0);
        }

        ctxTarget.fillText(overlay.text, 0, 0);
        ctxTarget.restore();
      }
    });

    // 3. Draw Stickers
    (clip.stickerOverlays || []).forEach(sticker => {
      if (localTime >= sticker.startTime && localTime <= sticker.endTime) {
        ctxTarget.save();

        ctxTarget.font = `${sticker.size || 40}px sans-serif`;
        ctxTarget.textAlign = 'center';
        ctxTarget.textBaseline = 'middle';

        const targetX = canvasTarget.width * (sticker.x / 100);
        const targetY = canvasTarget.height * (sticker.y / 100);

        ctxTarget.fillText(sticker.emoji, targetX, targetY);
        ctxTarget.restore();
      }
    });

    // 4. Draw selection outlines for the currently selected overlay when in Advanced Editor
    if (isAdvancedMode && selectedOverlayIndex !== null) {
      if (selectedOverlayType === 'text') {
        const overlay = clip.textOverlays[selectedOverlayIndex];
        if (overlay && localTime >= overlay.startTime && localTime <= overlay.endTime) {
          drawOverlaySelectionBox(overlay, 'text', ctxTarget, canvasTarget);
        }
      } else if (selectedOverlayType === 'sticker') {
        const sticker = clip.stickerOverlays[selectedOverlayIndex];
        if (sticker && localTime >= sticker.startTime && localTime <= sticker.endTime) {
          drawOverlaySelectionBox(sticker, 'sticker', ctxTarget, canvasTarget);
        }
      } else if (selectedOverlayType === 'pip') {
        const pip = clip.pipOverlays[selectedOverlayIndex];
        if (pip && localTime >= pip.startTime && localTime <= pip.endTime) {
          drawOverlaySelectionBox(pip, 'pip', ctxTarget, canvasTarget);
        }
      }
    }
  }

  function renderCurrentFrame() {
    if (clips.length === 0) {
      ctx.fillStyle = '#110826';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.font = '14px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText('Import videos or photos to edit', canvas.width / 2, canvas.height / 2);
      return;
    }

    const state = getPlaybackRenderState(currentPlaybackTime);
    if (!state) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (state.isTransitioning) {
      const { clipA, clipB, localOffsetA, localOffsetB, progress, transitionType } = state;

      if (transitionType === 'fade') {
        drawClipFrame(clipA, localOffsetA, ctx, canvas, 1 - progress);
        drawClipFrame(clipB, localOffsetB, ctx, canvas, progress);
      } else if (transitionType === 'slide') {
        drawClipFrame(clipA, localOffsetA, ctx, canvas, 1.0, -progress * canvas.width, 0);
        drawClipFrame(clipB, localOffsetB, ctx, canvas, 1.0, (1 - progress) * canvas.width, 0);
      } else if (transitionType === 'zoom') {
        drawClipFrame(clipA, localOffsetA, ctx, canvas, 1 - progress, 0, 0, 1.0 + progress * 0.5);
        drawClipFrame(clipB, localOffsetB, ctx, canvas, progress, 0, 0, 0.5 + progress * 0.5);
      }

      drawOverlays(clipA, localOffsetA - clipA.startTrim, ctx, canvas);
    } else {
      const { clip, localOffset } = state;
      if (isCropMode && selectedClipIndex === state.activeClipIndex) {
        drawCropModeFrame(clip, localOffset, ctx, canvas);
      } else {
        drawClipFrame(clip, localOffset, ctx, canvas, 1.0, 0, 0, 1.0);
        drawOverlays(clip, localOffset - clip.startTrim, ctx, canvas);
      }
    }
  }

  function startPlayback() {
    if (clips.length === 0) return;
    isPlaying = true;
    playPauseBtn.innerHTML = '<i data-lucide="pause" style="width: 14px; height: 14px;"></i>';
    if (window.debouncedCreateIcons) window.debouncedCreateIcons();

    // Start background audio if selected
    syncBGMusicPlayback();

    let lastTimestamp = performance.now();

    function loop(now) {
      if (!isPlaying) return;

      const delta = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      currentPlaybackTime += delta;
      syncBGMusicPlayback();

      if (currentPlaybackTime >= totalDuration) {
        currentPlaybackTime = 0;
        pausePlayback();
        seekTimelineToClip(0);
        return;
      }

      // Advance video playback elements in real-time
      const state = getClipAtGlobalTime(currentPlaybackTime);
      if (state) {
        const { clip, localOffset, index } = state;
        if (selectedClipIndex !== index) {
          selectedClipIndex = index;
          updateTimelineUI();
        }

        if (clip.type === 'video' && clip.element) {
          const video = clip.element;
          const targetTime = clip.startTrim + localOffset;

          if (video.paused) {
            video.playbackRate = clip.speed;
            video.play().catch(() => { });
          }

          // Force synchrony if timeline drift detected
          if (Math.abs(video.currentTime - targetTime) > 0.3) {
            video.currentTime = targetTime;
          }
        }

        // Voiceover sync
        if (clip.voiceOverElement) {
          const voiceover = clip.voiceOverElement;
          const targetVoiceTime = localOffset / clip.speed;
          if (voiceover.paused) {
            voiceover.play().catch(() => { });
          }
          if (Math.abs(voiceover.currentTime - targetVoiceTime) > 0.3) {
            voiceover.currentTime = targetVoiceTime;
          }
        }
      }

      // Pause non-active video and voiceover elements
      clips.forEach((c, idx) => {
        if (state && idx !== state.index) {
          if (c.type === 'video' && c.element && !c.element.paused) {
            c.element.pause();
          }
          if (c.voiceOverElement && !c.voiceOverElement.paused) {
            c.voiceOverElement.pause();
          }
        }
      });

      updateTimeDisplay();
      renderCurrentFrame();

      animationFrameId = requestAnimationFrame(loop);
    }

    animationFrameId = requestAnimationFrame(loop);
  }

  function pausePlayback() {
    isPlaying = false;
    playPauseBtn.innerHTML = '<i data-lucide="play" style="width: 14px; height: 14px;"></i>';
    if (window.debouncedCreateIcons) window.debouncedCreateIcons();

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }

    // Pause all media elements
    clips.forEach(c => {
      if (c.type === 'video' && c.element) {
        c.element.pause();
      }
      if (c.voiceOverElement) {
        c.voiceOverElement.pause();
      }
    });

    if (bgAudio && bgAudio.element) {
      bgAudio.element.pause();
    }
  }

  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      if (isPlaying) {
        pausePlayback();
      } else {
        startPlayback();
      }
    });
  }

  // --- Screen 1 -> Screen 2 Transition ---
  if (toScreen2Btn) {
    toScreen2Btn.addEventListener('click', () => {
      pausePlayback();
      screen1.style.display = 'none';
      screen2.style.display = 'block';
    });
  }

  // --- Screen 2 Details & Chips Handling ---
  if (backToScreen1Btn) {
    backToScreen1Btn.addEventListener('click', () => {
      screen2.style.display = 'none';
      screen1.style.display = 'block';
    });
  }

  // Hashtags chip inputs
  function renderHashtags() {
    hashtagsList.innerHTML = '';
    hashtags.forEach((tag, idx) => {
      const chip = document.createElement('span');
      chip.className = 'hashtag-chip';
      chip.innerHTML = `#${tag} <button data-idx="${idx}">×</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        hashtags.splice(idx, 1);
        renderHashtags();
      });
      hashtagsList.appendChild(chip);
    });
  }

  if (hashtagsInput) {
    hashtagsInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = hashtagsInput.value.trim().replace('#', '');
        if (value && !hashtags.includes(value)) {
          hashtags.push(value);
          renderHashtags();
        }
        hashtagsInput.value = '';
      }
    });
  }

  // Mentions tag inputs
  function renderMentions() {
    mentionsList.innerHTML = '';
    mentions.forEach((mention, idx) => {
      const chip = document.createElement('span');
      chip.className = 'mention-chip';
      chip.innerHTML = `@${mention} <button data-idx="${idx}">×</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        mentions.splice(idx, 1);
        renderMentions();
      });
      mentionsList.appendChild(chip);
    });
  }

  if (mentionsInput) {
    mentionsInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = mentionsInput.value.trim().replace('@', '');
        if (value && !mentions.includes(value)) {
          mentions.push(value);
          renderMentions();
        }
        mentionsInput.value = '';
      }
    });
  }

  // Screen 2 -> Screen 3 (Render Review & Compile Preview Video)
  if (toScreen3Btn) {
    toScreen3Btn.addEventListener('click', async () => {
      screen2.style.display = 'none';
      screen3.style.display = 'block';

      // Update Summary Fields
      reviewCaption.innerText = captionInput.value.trim() || 'No caption written.';
      reviewAudio.innerText = bgAudio ? bgAudio.file.name : 'Original Audio';
      reviewLocation.innerText = locationInput.value.trim() || 'None';
      reviewResolution.innerText = resolutionSelect.value === '720p' ? '720p (HD)' : '1080p (Full HD)';
      reviewDuration.innerText = totalDuration.toFixed(1) + 's';

      // Compile current preview to trigger playback overview
      await renderFinalExportPreview();
    });
  }

  if (backToScreen2Btn) {
    backToScreen2Btn.addEventListener('click', () => {
      // Pause final preview
      if (finalVideo) finalVideo.pause();
      screen3.style.display = 'none';
      screen2.style.display = 'block';
    });
  }

  // --- Real-time Video Compiler Engine (Canvas recorder) ---
  async function renderFinalExportPreview() {
    // Generate a temporary compilation blob for the user review screen
    renderingOverlay.style.display = 'flex';
    renderPercentage.innerText = 'Processing Video: Preparing...';

    const renderCanvas = document.createElement('canvas');
    const isPortrait = ratioSelect.value === '9:16';
    const isSquare = ratioSelect.value === '1:1';

    // Choose size based on selected resolution
    const isFullHD = resolutionSelect.value === '1080p';
    if (isPortrait) {
      renderCanvas.width = isFullHD ? 1080 : 720;
      renderCanvas.height = isFullHD ? 1920 : 1280;
    } else if (isSquare) {
      renderCanvas.width = isFullHD ? 1080 : 720;
      renderCanvas.height = isFullHD ? 1080 : 720;
    } else {
      renderCanvas.width = isFullHD ? 1920 : 1280;
      renderCanvas.height = isFullHD ? 1080 : 720;
    }

    const rctx = renderCanvas.getContext('2d');
    const stream = renderCanvas.captureStream(30); // 30 FPS export

    // Audio node capture setup
    let destNode = null;
    let originalAudioNode = null;
    let bgMusicNode = null;

    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      destNode = audioCtx.createMediaStreamDestination();

      if (bgAudio && bgAudio.element) {
        bgAudio.element.pause();
        bgAudio.element.currentTime = 0;
        bgMusicNode = audioCtx.createMediaElementSource(bgAudio.element);
        bgMusicNode.connect(destNode);
        bgMusicNode.connect(audioCtx.destination);
      }

      // Mix in individual video and voice-over tracks
      clips.forEach(c => {
        if (c.type === 'video' && c.element) {
          c.element.pause();
          c.element.currentTime = c.startTrim;
          const node = audioCtx.createMediaElementSource(c.element);
          node.connect(destNode);
          node.connect(audioCtx.destination);
        }
        if (c.voiceOverElement) {
          c.voiceOverElement.pause();
          c.voiceOverElement.currentTime = 0;
          const voNode = audioCtx.createMediaElementSource(c.voiceOverElement);
          voNode.connect(destNode);
          voNode.connect(audioCtx.destination);
        }
      });

      const audioTrack = destNode.stream.getAudioTracks()[0];
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    } catch (ae) {
      console.warn("Web Audio Routing bypass:", ae.message);
    }

    // Media Recorder initialization
    const options = { mimeType: 'video/webm;codecs=vp8,opus' };
    let recorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch (e) {
      recorder = new MediaRecorder(stream); // Fallback standard format
    }

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    let compileCompleted = false;

    recorder.onstop = () => {
      const finalBlob = new Blob(chunks, { type: 'video/mp4' });
      const finalUrl = URL.createObjectURL(finalBlob);
      finalVideo.src = finalUrl;
      renderingOverlay.style.display = 'none';
      compileCompleted = true;
    };

    recorder.start();

    // Start background music elements if defined
    if (bgAudio && bgAudio.element) {
      // Pause initially; interval loop will trigger playback at the offset
      bgAudio.element.pause();
      bgAudio.element.currentTime = 0;
    }

    // Play through the timeline frame-by-frame on the offscreen canvas
    let exportPlayhead = 0;
    const interval = 1000 / 30; // 30 frames per second loop

    return new Promise((resolve) => {
      const intervalId = setInterval(() => {
        if (exportPlayhead >= totalDuration) {
          clearInterval(intervalId);
          recorder.stop();
          clips.forEach(c => {
            if (c.type === 'video' && c.element) c.element.pause();
          });
          if (bgAudio && bgAudio.element) bgAudio.element.pause();
          resolve();
          return;
        }

        if (bgAudio && bgAudio.element) {
          const audio = bgAudio.element;
          const start = bgAudio.startTime || 0;
          const localTime = exportPlayhead - start;
          const audioDur = audio.duration || 0;

          if (localTime >= 0 && localTime < audioDur) {
            if (audio.paused) {
              audio.play().catch(() => { });
            }
            if (Math.abs(audio.currentTime - localTime) > 0.3) {
              audio.currentTime = localTime;
            }
          } else {
            if (!audio.paused) {
              audio.pause();
            }
          }
        }

        const rstate = getPlaybackRenderState(exportPlayhead);
        if (rstate) {
          if (rstate.isTransitioning) {
            const { clipA, clipB, localOffsetA, localOffsetB, progress, transitionType } = rstate;

            if (clipA.type === 'video' && clipA.element) {
              clipA.element.currentTime = localOffsetA;
              if (clipA.element.paused) {
                clipA.element.playbackRate = clipA.speed;
                clipA.element.play().catch(() => { });
              }
            }
            if (clipB.type === 'video' && clipB.element) {
              clipB.element.currentTime = localOffsetB;
              if (clipB.element.paused) {
                clipB.element.playbackRate = clipB.speed;
                clipB.element.play().catch(() => { });
              }
            }

            if (clipA.voiceOverElement) {
              clipA.voiceOverElement.currentTime = (localOffsetA - clipA.startTrim) / clipA.speed;
              if (clipA.voiceOverElement.paused) clipA.voiceOverElement.play().catch(() => { });
            }
            if (clipB.voiceOverElement) {
              clipB.voiceOverElement.currentTime = (localOffsetB - clipB.startTrim) / clipB.speed;
              if (clipB.voiceOverElement.paused) clipB.voiceOverElement.play().catch(() => { });
            }

            if (transitionType === 'fade') {
              drawClipFrame(clipA, localOffsetA, rctx, renderCanvas, 1 - progress);
              drawClipFrame(clipB, localOffsetB, rctx, renderCanvas, progress);
            } else if (transitionType === 'slide') {
              drawClipFrame(clipA, localOffsetA, rctx, renderCanvas, 1.0, -progress * renderCanvas.width, 0);
              drawClipFrame(clipB, localOffsetB, rctx, renderCanvas, 1.0, (1 - progress) * renderCanvas.width, 0);
            } else if (transitionType === 'zoom') {
              drawClipFrame(clipA, localOffsetA, rctx, renderCanvas, 1 - progress, 0, 0, 1.0 + progress * 0.5);
              drawClipFrame(clipB, localOffsetB, rctx, renderCanvas, progress, 0, 0, 0.5 + progress * 0.5);
            }

            drawOverlays(clipA, localOffsetA - clipA.startTrim, rctx, renderCanvas);
          } else {
            const { clip, localOffset } = rstate;
            if (clip.type === 'video' && clip.element) {
              clip.element.currentTime = localOffset;
              if (clip.element.paused) {
                clip.element.playbackRate = clip.speed;
                clip.element.play().catch(() => { });
              }
            }

            if (clip.voiceOverElement) {
              clip.voiceOverElement.currentTime = (localOffset - clip.startTrim) / clip.speed;
              if (clip.voiceOverElement.paused) clip.voiceOverElement.play().catch(() => { });
            }

            drawClipFrame(clip, localOffset, rctx, renderCanvas, 1.0, 0, 0, 1.0);
            drawOverlays(clip, localOffset - clip.startTrim, rctx, renderCanvas);
          }

          clips.forEach((c, idx) => {
            if (idx !== rstate.activeClipIndex && (!rstate.isTransitioning || idx !== rstate.activeClipIndex + 1)) {
              if (c.voiceOverElement && !c.voiceOverElement.paused) c.voiceOverElement.pause();
              if (c.type === 'video' && c.element && !c.element.paused) c.element.pause();
            }
          });
        }

        exportPlayhead += (interval / 1000);
        const percent = Math.min(Math.floor((exportPlayhead / totalDuration) * 100), 100);
        renderPercentage.innerText = `Processing Video: ${percent}%`;
      }, interval);
    });
  }

  // --- Final Publish Post ---
  if (postBtn) {
    postBtn.addEventListener('click', async () => {
      const token = localStorage.getItem('invibe_jwt_token');
      if (!token) {
        showToast('Please log in to publish a Reel! 🔐');
        return;
      }

      if (!finalVideo.src) {
        showToast('Video not rendered correctly yet! ⚠️');
        return;
      }

      postBtn.disabled = true;
      postBtn.innerHTML = '<i data-lucide="loader" class="animate-spin"></i> Posting...';
      if (window.debouncedCreateIcons) window.debouncedCreateIcons();

      try {
        // Fetch compiled blob
        const response = await fetch(finalVideo.src);
        const blob = await response.blob();

        // Convert blob to base64 for API delivery
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Data = reader.result;

          const tagsText = hashtags.map(t => `#${t}`).join(' ');
          const mentionsText = mentions.map(m => `@${m}`).join(' ');
          const combinedCaption = `${captionInput.value.trim()} ${tagsText} ${mentionsText}`.trim();

          const apiRes = await fetch(`${API_URL}/api/reels`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              caption: combinedCaption,
              videoUrl: base64Data
            })
          });

          if (apiRes.ok) {
            showToast('New Reel posted successfully! 🎥✨');
            // Refresh reels feed
            if (typeof loadFeedReels === 'function') loadFeedReels();

            // Close modal & reset editor
            exploreCreateModal.classList.remove('active');
            resetFullEditor();
          } else {
            const err = await apiRes.json();
            throw new Error(err.error || 'Failed to publish');
          }
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error(err);
        showToast('Publishing failed: ' + err.message);
        postBtn.disabled = false;
        postBtn.innerHTML = '<i data-lucide="upload-cloud"></i> Post a Reel';
        if (window.debouncedCreateIcons) window.debouncedCreateIcons();
      }
    });
  }

  // --- Reset Entire Workspace State ---
  function resetFullEditor() {
    exitCropMode();
    isAdvancedMode = false;
    selectedOverlayType = null;
    selectedOverlayIndex = null;
    dragOverlayMode = null;
    try { resetAdvancedPanelMenu(); } catch (e) { }

    // Clean up temporary voiceover preview state
    tempVoiceoverBlob = null;
    if (tempVoiceoverUrl) {
      try { URL.revokeObjectURL(tempVoiceoverUrl); } catch (e) { }
      tempVoiceoverUrl = null;
    }
    if (advVoiceoverPreview) advVoiceoverPreview.src = '';

    pausePlayback();

    // Clear blob URLs to prevent memory leaks
    clips.forEach(clip => {
      try { URL.revokeObjectURL(clip.url); } catch (e) { }
    });
    if (bgAudio) {
      try { URL.revokeObjectURL(bgAudio.url); } catch (e) { }
    }

    clips = [];
    selectedClipIndex = null;
    bgAudio = null;
    isPlaying = false;
    currentPlaybackTime = 0;
    totalDuration = 0;

    hashtags = [];
    mentions = [];
    captionInput.value = '';
    hashtagsInput.value = '';
    mentionsInput.value = '';
    locationInput.value = '';
    hashtagsList.innerHTML = '';
    mentionsList.innerHTML = '';

    audioStatus.style.display = 'none';
    audioNameSpan.innerText = 'None';
    audioInput.value = '';

    toScreen2Btn.disabled = true;
    postBtn.disabled = false;
    postBtn.innerHTML = '<i data-lucide="upload-cloud"></i> Post a Reel';

    updateTimelineUI();
    recalculateTotalDuration();
    updateCanvasDimensions();

    screen2.style.display = 'none';
    screen3.style.display = 'none';
    screen1.style.display = 'block';
    switchEditorTab('basic');
  }

  // Global triggers and close actions
  if (exploreCreateBtn) {
    exploreCreateBtn.addEventListener('click', () => {
      let token = localStorage.getItem('invibe_jwt_token');
      if (!token && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        token = 'dummy-dev-token';
        localStorage.setItem('invibe_jwt_token', token);
      }
      if (!token) {
        showToast('Please log in to edit videos! 🔐');
        return;
      }
      resetFullEditor();
      exploreCreateModal.classList.add('active');
    });
  }

  closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      exploreCreateModal.classList.remove('active');
      resetFullEditor();
    });
  });

  // --- Editor Tab Switching Logic ---
  function switchEditorTab(activeTabId) {
    isAdvancedMode = (activeTabId === 'advanced');
    selectedOverlayType = null;
    selectedOverlayIndex = null;
    dragOverlayMode = null;
    if (activeTabId !== 'basic') {
      exitCropMode();
    }
    // Reset active classes and inline backgrounds on tabs
    [tabBasic, tabAdvanced, tabPro].forEach(tab => {
      if (tab) {
        tab.classList.remove('active');
        tab.style.background = 'transparent';
        tab.style.color = 'var(--text-muted, #94a3b8)';
      }
    });

    // Toggle active-panel class
    if (basicPanel) basicPanel.classList.remove('active-panel');
    if (advancedPanel) advancedPanel.classList.remove('active-panel');
    if (proPanel) proPanel.classList.remove('active-panel');

    // Set active tab and panel
    if (activeTabId === 'basic') {
      if (tabBasic) {
        tabBasic.classList.add('active');
        tabBasic.style.background = 'var(--primary, #a855f7)';
        tabBasic.style.color = 'white';
      }
      if (basicPanel) basicPanel.classList.add('active-panel');
    } else if (activeTabId === 'advanced') {
      if (tabAdvanced) {
        tabAdvanced.classList.add('active');
        tabAdvanced.style.background = 'var(--primary, #a855f7)';
        tabAdvanced.style.color = 'white';
      }
      if (advancedPanel) advancedPanel.classList.add('active-panel');
      try { resetAdvancedPanelMenu(); } catch (e) { }
    } else if (activeTabId === 'pro') {
      if (tabPro) {
        tabPro.classList.add('active');
        tabPro.style.background = 'var(--primary, #a855f7)';
        tabPro.style.color = 'white';
      }
      if (proPanel) proPanel.classList.add('active-panel');
    }

    if (window.debouncedCreateIcons) window.debouncedCreateIcons();
  }

  // --- Phase 2 Advanced Editing Event Listeners & Helpers ---

  // 1. Accordion Toggle for Advanced Panel (Transition-Based Menu View)
  function resetAdvancedPanelMenu() {
    document.querySelectorAll('#editor-advanced-panel .adv-section').forEach(section => {
      section.style.display = 'flex';
      const content = section.querySelector('.adv-content');
      if (content) content.style.display = 'none';

      const header = section.querySelector('.adv-header');
      if (header) {
        header.style.background = 'rgba(255,255,255,0.02)';
        header.style.borderBottom = 'none';
        header.style.cursor = 'pointer';
        header.style.pointerEvents = 'auto';
      }

      const chevron = section.querySelector('.chevron');
      if (chevron) {
        chevron.style.display = 'block';
        chevron.style.transform = 'rotate(-90deg)';
      }
    });
  }

  document.querySelectorAll('#editor-advanced-panel .adv-header').forEach(header => {
    header.addEventListener('click', () => {
      const parent = header.parentElement;
      const content = parent.querySelector('.adv-content');

      // Hide all other sections entirely
      document.querySelectorAll('#editor-advanced-panel .adv-section').forEach(section => {
        if (section !== parent) {
          section.style.display = 'none';
        }
      });

      // Expand current section's content
      if (content) {
        content.style.display = 'flex';
      }

      // Style active header to show active title and disable further header clicks
      const chevron = parent.querySelector('.chevron');
      if (chevron) chevron.style.display = 'none';

      header.style.background = 'rgba(168, 85, 247, 0.15)';
      header.style.borderBottom = '1px solid rgba(168, 85, 247, 0.3)';
      header.style.cursor = 'default';
      header.style.pointerEvents = 'none';
    });
  });

  // Bind Set buttons to return back to main list
  document.querySelectorAll('#editor-advanced-panel .adv-set-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent re-triggering header click if event bubbles
      resetAdvancedPanelMenu();

      // Deselect text/emoji overlays on exit
      selectedOverlayType = null;
      selectedOverlayIndex = null;
      updateTextOverlaysList();
      updateStickerOverlaysList();
      renderCurrentFrame();
    });
  });

  // 2. Filters & Color Adjustments
  if (advFilterSelect) {
    advFilterSelect.addEventListener('change', () => {
      if (selectedClipIndex === null) return;
      clips[selectedClipIndex].filterType = advFilterSelect.value;
      renderCurrentFrame();
    });
  }

  function registerAdvSlider(slider, valSpan, propertyName) {
    if (slider) {
      slider.addEventListener('input', (e) => {
        if (selectedClipIndex === null) return;
        const val = parseInt(e.target.value) || 0;
        clips[selectedClipIndex][propertyName] = val;
        if (valSpan) valSpan.innerText = `${val}%`;
        renderCurrentFrame();
      });
    }
  }

  registerAdvSlider(advBrightness, advBrightVal, 'brightness');
  registerAdvSlider(advContrast, advContrastVal, 'contrast');
  registerAdvSlider(advSaturation, advSaturateVal, 'saturation');
  registerAdvSlider(advExposure, advExposureVal, 'exposure');

  // 3. Transitions
  if (advTransitionSelect) {
    advTransitionSelect.addEventListener('change', () => {
      if (selectedClipIndex === null) return;
      clips[selectedClipIndex].transitionType = advTransitionSelect.value;
      renderCurrentFrame();
    });
  }

  if (advTransitionDuration) {
    advTransitionDuration.addEventListener('input', (e) => {
      if (selectedClipIndex === null) return;
      const dur = parseFloat(e.target.value) / 10;
      clips[selectedClipIndex].transitionDuration = dur;
      if (advTransitionDurationVal) advTransitionDurationVal.innerText = `${dur.toFixed(1)}s`;
      renderCurrentFrame();
    });
  }

  // 4. Text Overlays
  // 4. Text Overlays
  function selectTextOverlay(index) {
    selectedOverlayType = 'text';
    selectedOverlayIndex = index;

    const clip = clips[selectedClipIndex];
    if (!clip) return;
    const overlay = clip.textOverlays[index];
    if (!overlay) return;

    if (advTextInput) advTextInput.value = overlay.text;
    if (advTextColor) advTextColor.value = overlay.color || '#ffffff';
    if (advTextAnim) advTextAnim.value = overlay.animation || 'none';
    if (advTextPosX) advTextPosX.value = overlay.x || 50;
    if (advTextPosY) advTextPosY.value = overlay.y || 50;

    if (advTextSize) advTextSize.value = overlay.size || 28;
    if (advTextFont) advTextFont.value = overlay.font || 'Outfit';

    if (advTextBold) {
      if (overlay.bold) {
        advTextBold.classList.add('active');
        advTextBold.style.background = 'var(--primary, #a855f7)';
      } else {
        advTextBold.classList.remove('active');
        advTextBold.style.background = 'rgba(0,0,0,0.3)';
      }
    }
    if (advTextItalic) {
      if (overlay.italic) {
        advTextItalic.classList.add('active');
        advTextItalic.style.background = 'var(--primary, #a855f7)';
      } else {
        advTextItalic.classList.remove('active');
        advTextItalic.style.background = 'rgba(0,0,0,0.3)';
      }
    }
    if (advTextOutline) advTextOutline.checked = !!overlay.outline;
    if (advTextOutlineColor) advTextOutlineColor.value = overlay.outlineColor || '#000000';

    updateTextOverlaysList();
    renderCurrentFrame();
  }

  function ensureTextOverlayCreated(clip) {
    if (selectedOverlayType === 'text' && selectedOverlayIndex !== null) {
      const overlay = clip.textOverlays[selectedOverlayIndex];
      if (overlay) return overlay;
    }

    const textVal = advTextInput.value || 'New Text';
    if (!advTextInput.value) {
      advTextInput.value = textVal;
    }
    const duration = (clip.endTrim - clip.startTrim) / clip.speed;
    clip.textOverlays = clip.textOverlays || [];

    const newOverlay = {
      text: textVal,
      color: advTextColor ? advTextColor.value : '#ffffff',
      animation: advTextAnim ? advTextAnim.value : 'none',
      x: advTextPosX ? parseInt(advTextPosX.value) : 50,
      y: advTextPosY ? parseInt(advTextPosY.value) : 50,
      size: advTextSize ? parseInt(advTextSize.value) : 28,
      font: advTextFont ? advTextFont.value : 'Outfit',
      bold: advTextBold ? advTextBold.classList.contains('active') : true,
      italic: advTextItalic ? advTextItalic.classList.contains('active') : false,
      outline: advTextOutline ? advTextOutline.checked : false,
      outlineColor: advTextOutlineColor ? advTextOutlineColor.value : '#000000',
      startTime: 0,
      endTime: duration
    };

    clip.textOverlays.push(newOverlay);
    selectedOverlayType = 'text';
    selectedOverlayIndex = clip.textOverlays.length - 1;
    updateTextOverlaysList();
    return newOverlay;
  }

  function syncUItoSelectedTextOverlay() {
    if (selectedClipIndex === null) return;
    const clip = clips[selectedClipIndex];
    const overlay = ensureTextOverlayCreated(clip);
    if (!overlay) return;

    if (advTextInput) overlay.text = advTextInput.value;
    if (advTextColor) overlay.color = advTextColor.value;
    if (advTextAnim) overlay.animation = advTextAnim.value;
    if (advTextPosX) overlay.x = parseInt(advTextPosX.value) || 50;
    if (advTextPosY) overlay.y = parseInt(advTextPosY.value) || 50;
    if (advTextSize) overlay.size = parseInt(advTextSize.value) || 28;
    if (advTextFont) overlay.font = advTextFont.value;
    if (advTextOutline) overlay.outline = advTextOutline.checked;
    if (advTextOutlineColor) overlay.outlineColor = advTextOutlineColor.value;

    renderCurrentFrame();
  }

  if (advTextBold) {
    advTextBold.addEventListener('click', () => {
      if (selectedClipIndex === null) return;
      const clip = clips[selectedClipIndex];
      const overlay = ensureTextOverlayCreated(clip);
      if (overlay) {
        overlay.bold = !overlay.bold;
        if (overlay.bold) {
          advTextBold.classList.add('active');
          advTextBold.style.background = 'var(--primary, #a855f7)';
        } else {
          advTextBold.classList.remove('active');
          advTextBold.style.background = 'rgba(0,0,0,0.3)';
        }
        renderCurrentFrame();
      }
    });
  }

  if (advTextItalic) {
    advTextItalic.addEventListener('click', () => {
      if (selectedClipIndex === null) return;
      const clip = clips[selectedClipIndex];
      const overlay = ensureTextOverlayCreated(clip);
      if (overlay) {
        overlay.italic = !overlay.italic;
        if (overlay.italic) {
          advTextItalic.classList.add('active');
          advTextItalic.style.background = 'var(--primary, #a855f7)';
        } else {
          advTextItalic.classList.remove('active');
          advTextItalic.style.background = 'rgba(0,0,0,0.3)';
        }
        renderCurrentFrame();
      }
    });
  }

  [advTextInput, advTextColor, advTextAnim, advTextPosX, advTextPosY, advTextSize, advTextFont, advTextOutline, advTextOutlineColor].forEach(elem => {
    if (elem) {
      const eventName = (elem.tagName === 'SELECT' || elem.type === 'checkbox') ? 'change' : 'input';
      elem.addEventListener(eventName, () => {
        syncUItoSelectedTextOverlay();
        if (elem === advTextInput) {
          updateTextOverlaysList();
        }
      });
    }
  });

  function updateTextOverlaysList() {
    if (!advTextList) return;
    advTextList.innerHTML = '';
    if (selectedClipIndex === null) return;
    const clip = clips[selectedClipIndex];

    (clip.textOverlays || []).forEach((overlay, index) => {
      const row = document.createElement('div');
      const isSelected = (selectedOverlayType === 'text' && selectedOverlayIndex === index);
      row.style.cssText = `display: flex; justify-content: space-between; align-items: center; background: ${isSelected ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${isSelected ? '#a855f7' : 'transparent'}; padding: 4px 8px; border-radius: 4px; font-size: 10px; color: white; margin-bottom: 4px; cursor: pointer;`;

      const txtSpan = document.createElement('span');
      txtSpan.innerText = `"${overlay.text.substring(0, 12)}${overlay.text.length > 12 ? '...' : ''}" (${overlay.animation})`;

      const delBtn = document.createElement('button');
      delBtn.innerText = 'Delete';
      delBtn.style.cssText = 'background:none; border:none; color:#f87171; cursor:pointer; font-size:9px; font-weight:600;';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clip.textOverlays.splice(index, 1);
        if (selectedOverlayType === 'text' && selectedOverlayIndex === index) {
          selectedOverlayType = null;
          selectedOverlayIndex = null;
        } else if (selectedOverlayType === 'text' && selectedOverlayIndex > index) {
          selectedOverlayIndex--;
        }
        updateTextOverlaysList();
        renderCurrentFrame();
      });

      row.addEventListener('click', () => {
        selectTextOverlay(index);
      });

      row.appendChild(txtSpan);
      row.appendChild(delBtn);
      advTextList.appendChild(row);
    });
  }

  if (advAddTextBtn) {
    advAddTextBtn.addEventListener('click', () => {
      if (selectedClipIndex === null) {
        showToast('Select a clip first! 📺');
        return;
      }

      // Since typing already created/updated the overlay,
      // clicking "Add Text Overlay" commits/deselects it so the user can type a fresh new one.
      advTextInput.value = '';
      selectedOverlayType = null;
      selectedOverlayIndex = null;
      updateTextOverlaysList();
      renderCurrentFrame();
      showToast('Text overlay finalized! Type again to add another one. 📝');
    });
  }

  // 5. Stickers & Emojis
  function selectStickerOverlay(index) {
    selectedOverlayType = 'sticker';
    selectedOverlayIndex = index;

    const clip = clips[selectedClipIndex];
    if (!clip) return;
    const sticker = clip.stickerOverlays[index];
    if (!sticker) return;

    if (advEmojiSize) advEmojiSize.value = sticker.size || 40;
    if (advEmojiPosY) advEmojiPosY.value = sticker.y || 30;

    updateStickerOverlaysList();
    renderCurrentFrame();
  }

  function syncUItoSelectedStickerOverlay() {
    if (selectedClipIndex === null || selectedOverlayType !== 'sticker' || selectedOverlayIndex === null) return;
    const clip = clips[selectedClipIndex];
    const sticker = clip.stickerOverlays[selectedOverlayIndex];
    if (!sticker) return;

    if (advEmojiSize) sticker.size = parseInt(advEmojiSize.value) || 40;
    if (advEmojiPosY) sticker.y = parseInt(advEmojiPosY.value) || 30;

    renderCurrentFrame();
  }

  [advEmojiSize, advEmojiPosY].forEach(elem => {
    if (elem) {
      elem.addEventListener('input', () => {
        syncUItoSelectedStickerOverlay();
      });
    }
  });

  function updateStickerOverlaysList() {
    if (!advEmojiList) return;
    advEmojiList.innerHTML = '';
    if (selectedClipIndex === null) return;
    const clip = clips[selectedClipIndex];

    (clip.stickerOverlays || []).forEach((sticker, index) => {
      const row = document.createElement('div');
      const isSelected = (selectedOverlayType === 'sticker' && selectedOverlayIndex === index);
      row.style.cssText = `display: flex; justify-content: space-between; align-items: center; background: ${isSelected ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${isSelected ? '#a855f7' : 'transparent'}; padding: 4px 8px; border-radius: 4px; font-size: 10px; color: white; margin-bottom: 4px; cursor: pointer;`;

      const txtSpan = document.createElement('span');
      txtSpan.innerText = `Emoji: ${sticker.emoji} (Size: ${sticker.size}px)`;

      const delBtn = document.createElement('button');
      delBtn.innerText = 'Delete';
      delBtn.style.cssText = 'background:none; border:none; color:#f87171; cursor:pointer; font-size:9px; font-weight:600;';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clip.stickerOverlays.splice(index, 1);
        if (selectedOverlayType === 'sticker' && selectedOverlayIndex === index) {
          selectedOverlayType = null;
          selectedOverlayIndex = null;
        } else if (selectedOverlayType === 'sticker' && selectedOverlayIndex > index) {
          selectedOverlayIndex--;
        }
        updateStickerOverlaysList();
        renderCurrentFrame();
      });

      row.addEventListener('click', () => {
        selectStickerOverlay(index);
      });

      row.appendChild(txtSpan);
      row.appendChild(delBtn);
      advEmojiList.appendChild(row);
    });
  }

  document.querySelectorAll('#editor-advanced-panel .emoji-picker-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (selectedClipIndex === null) {
        showToast('Select a clip first! 📺');
        return;
      }
      const emoji = btn.getAttribute('data-emoji');
      const clip = clips[selectedClipIndex];
      const duration = (clip.endTrim - clip.startTrim) / clip.speed;

      clip.stickerOverlays = clip.stickerOverlays || [];
      const newSticker = {
        emoji: emoji,
        size: advEmojiSize ? parseInt(advEmojiSize.value) : 40,
        y: advEmojiPosY ? parseInt(advEmojiPosY.value) : 30,
        x: 50,
        startTime: 0,
        endTime: duration
      };

      clip.stickerOverlays.push(newSticker);
      const newIndex = clip.stickerOverlays.length - 1;

      selectStickerOverlay(newIndex);
      showToast('Sticker emoji added! 😎');
    });
  });

  // 6. Picture-in-Picture
  // 6. Picture-in-Picture (PIP)
  let tempPipFile = null;
  let tempPipElement = null; // Image or Video element loaded

  if (advPipUploadBtn && advPipFileInput) {
    advPipUploadBtn.addEventListener('click', () => {
      advPipFileInput.click();
    });

    advPipFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      tempPipFile = file;
      if (advPipFilename) advPipFilename.innerText = file.name;

      // Load the media element
      const url = URL.createObjectURL(file);
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.src = url;
        img.onload = () => {
          tempPipElement = img;
          showToast('Overlay image loaded successfully! 📸');
        };
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = url;
        video.muted = true;
        video.playsInline = true;
        video.load();
        video.onloadeddata = () => {
          tempPipElement = video;
          showToast('Overlay video loaded successfully! 🎥');
        };
      }
    });
  }

  function selectPipOverlay(index) {
    selectedOverlayType = 'pip';
    selectedOverlayIndex = index;

    const clip = clips[selectedClipIndex];
    if (!clip) return;
    const pip = clip.pipOverlays[index];
    if (!pip) return;

    if (advPipScale) advPipScale.value = pip.scale || 30;
    if (advPipOpacity) advPipOpacity.value = pip.opacity || 100;

    updatePipOverlaysList();
    renderCurrentFrame();
  }

  function syncUItoSelectedPipOverlay() {
    if (selectedClipIndex === null || selectedOverlayType !== 'pip' || selectedOverlayIndex === null) return;
    const clip = clips[selectedClipIndex];
    const pip = clip.pipOverlays[selectedOverlayIndex];
    if (!pip) return;

    if (advPipScale) pip.scale = parseInt(advPipScale.value) || 30;
    if (advPipOpacity) pip.opacity = parseInt(advPipOpacity.value) || 100;

    renderCurrentFrame();
  }

  [advPipScale, advPipOpacity].forEach(elem => {
    if (elem) {
      elem.addEventListener('input', () => {
        syncUItoSelectedPipOverlay();
      });
    }
  });

  function updatePipOverlaysList() {
    if (!advPipList) return;
    advPipList.innerHTML = '';
    if (selectedClipIndex === null) return;
    const clip = clips[selectedClipIndex];

    (clip.pipOverlays || []).forEach((pip, index) => {
      const row = document.createElement('div');
      const isSelected = (selectedOverlayType === 'pip' && selectedOverlayIndex === index);
      row.style.cssText = `display: flex; justify-content: space-between; align-items: center; background: ${isSelected ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${isSelected ? '#a855f7' : 'transparent'}; padding: 4px 8px; border-radius: 4px; font-size: 10px; color: white; margin-bottom: 4px; cursor: pointer;`;

      const txtSpan = document.createElement('span');
      txtSpan.innerText = `PIP: ${pip.name.substring(0, 16)} (Scale: ${pip.scale}%)`;

      const delBtn = document.createElement('button');
      delBtn.innerText = 'Delete';
      delBtn.style.cssText = 'background:none; border:none; color:#f87171; cursor:pointer; font-size:9px; font-weight:600;';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clip.pipOverlays.splice(index, 1);
        if (selectedOverlayType === 'pip' && selectedOverlayIndex === index) {
          selectedOverlayType = null;
          selectedOverlayIndex = null;
        } else if (selectedOverlayType === 'pip' && selectedOverlayIndex > index) {
          selectedOverlayIndex--;
        }
        updatePipOverlaysList();
        renderCurrentFrame();
      });

      row.addEventListener('click', () => {
        selectPipOverlay(index);
      });

      row.appendChild(txtSpan);
      row.appendChild(delBtn);
      advPipList.appendChild(row);
    });
  }

  if (advAddPipBtn) {
    advAddPipBtn.addEventListener('click', () => {
      if (selectedClipIndex === null) {
        showToast('Select a clip first! 📺');
        return;
      }
      if (!tempPipFile || !tempPipElement) {
        showToast('Please upload overlay media first! 🎞️');
        return;
      }

      const clip = clips[selectedClipIndex];
      const duration = (clip.endTrim - clip.startTrim) / clip.speed;

      clip.pipOverlays = clip.pipOverlays || [];
      const newPip = {
        name: tempPipFile.name,
        element: tempPipElement,
        scale: advPipScale ? parseInt(advPipScale.value) : 30,
        opacity: advPipOpacity ? parseInt(advPipOpacity.value) : 100,
        x: 30,
        y: 30,
        startTime: 0,
        endTime: duration
      };

      clip.pipOverlays.push(newPip);
      const newIndex = clip.pipOverlays.length - 1;

      tempPipFile = null;
      tempPipElement = null;
      if (advPipFilename) advPipFilename.innerText = 'No file selected';
      if (advPipFileInput) advPipFileInput.value = '';

      selectPipOverlay(newIndex);
      showToast('Picture-in-Picture overlay added! 🖼️');
    });
  }

  // 7. Voice Recording (MediaRecorder API)
  let mediaRecorder = null;
  let audioChunks = [];
  let tempVoiceoverBlob = null;
  let tempVoiceoverUrl = null;

  function updateVoiceoverUI() {
    if (!advVoiceoverInfo) return;
    if (selectedClipIndex === null) {
      advVoiceoverInfo.style.display = 'none';
      if (advVoiceoverPreviewContainer) advVoiceoverPreviewContainer.style.display = 'none';
      return;
    }
    const clip = clips[selectedClipIndex];
    if (clip.voiceOverUrl) {
      advVoiceoverInfo.style.display = 'flex';
      if (advVoiceoverPreviewContainer) advVoiceoverPreviewContainer.style.display = 'none';
      if (advMicStatus) advMicStatus.innerText = 'Recorded 🎙️';
    } else {
      advVoiceoverInfo.style.display = 'none';
      if (tempVoiceoverUrl) {
        if (advVoiceoverPreviewContainer) advVoiceoverPreviewContainer.style.display = 'flex';
        if (advMicStatus) advMicStatus.innerText = 'Preview ready 🎧';
      } else {
        if (advVoiceoverPreviewContainer) advVoiceoverPreviewContainer.style.display = 'none';
        if (advMicStatus) advMicStatus.innerText = 'Idle';
      }
    }
  }

  if (advMicRecordBtn) {
    advMicRecordBtn.addEventListener('click', async () => {
      if (selectedClipIndex === null) {
        showToast('Select a clip first! 📺');
        return;
      }

      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        advMicRecordBtn.innerHTML = '<i data-lucide="mic" style="width:14px; height:14px;"></i> Start Recording';
        advMicRecordBtn.style.background = 'rgba(239, 68, 68, 0.2)';
        advMicRecordBtn.style.color = '#f87171';
        if (advMicStatus) advMicStatus.innerText = 'Processing...';
        if (window.debouncedCreateIcons) window.debouncedCreateIcons();
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioChunks = [];

          mediaRecorder = new MediaRecorder(stream);
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
          };

          mediaRecorder.onstop = () => {
            tempVoiceoverBlob = new Blob(audioChunks, { type: 'audio/webm' });

            if (tempVoiceoverUrl) {
              try { URL.revokeObjectURL(tempVoiceoverUrl); } catch (err) { }
            }

            tempVoiceoverUrl = URL.createObjectURL(tempVoiceoverBlob);
            if (advVoiceoverPreview) {
              advVoiceoverPreview.src = tempVoiceoverUrl;
              advVoiceoverPreview.load();
            }

            updateVoiceoverUI();
            showToast('Recording complete! Play preview below, then click Set to add it. 🎧');

            stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorder.start();
          advMicRecordBtn.innerHTML = '<i data-lucide="square" style="width:14px; height:14px;"></i> Stop Recording';
          advMicRecordBtn.style.background = 'rgba(239, 68, 68, 0.8)';
          advMicRecordBtn.style.color = 'white';
          if (advMicStatus) advMicStatus.innerText = 'Recording...';
          if (window.debouncedCreateIcons) window.debouncedCreateIcons();
        } catch (err) {
          showToast('Failed to access microphone! 🎙️❌');
          console.error(err);
        }
      }
    });
  }

  // Bind custom voiceover set button to commit recording to video clip
  if (advSetVoiceoverBtn) {
    advSetVoiceoverBtn.addEventListener('click', (e) => {
      e.stopPropagation();

      if (selectedClipIndex === null) {
        resetAdvancedPanelMenu();
        return;
      }

      const clip = clips[selectedClipIndex];
      if (tempVoiceoverUrl) {
        if (clip.voiceOverUrl) {
          try { URL.revokeObjectURL(clip.voiceOverUrl); } catch (err) { }
        }

        clip.voiceOverUrl = tempVoiceoverUrl;
        clip.voiceOverElement = new Audio(tempVoiceoverUrl);

        tempVoiceoverBlob = null;
        tempVoiceoverUrl = null;
        if (advVoiceoverPreview) advVoiceoverPreview.src = '';

        showToast('Voice-over committed and added to video! 🎙️✅');
      }

      resetAdvancedPanelMenu();
      updateVoiceoverUI();
    });
  }

  if (advDeleteVoiceBtn) {
    advDeleteVoiceBtn.addEventListener('click', () => {
      if (selectedClipIndex === null) return;
      const clip = clips[selectedClipIndex];
      if (clip.voiceOverUrl) {
        try { URL.revokeObjectURL(clip.voiceOverUrl); } catch (err) { }
        clip.voiceOverUrl = null;
        clip.voiceOverElement = null;
      }

      tempVoiceoverBlob = null;
      if (tempVoiceoverUrl) {
        try { URL.revokeObjectURL(tempVoiceoverUrl); } catch (err) { }
        tempVoiceoverUrl = null;
      }
      if (advVoiceoverPreview) advVoiceoverPreview.src = '';

      if (advMicStatus) advMicStatus.innerText = 'Idle';
      updateVoiceoverUI();
      showToast('Voice-over deleted! 🗑️');
    });
  }

  // Hook dropdown updates to import media and selection transitions
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      setTimeout(updateTimelineUI, 100);
    });
  }

  if (tabBasic) tabBasic.addEventListener('click', () => switchEditorTab('basic'));
  if (tabAdvanced) tabAdvanced.addEventListener('click', () => switchEditorTab('advanced'));
  if (tabPro) tabPro.addEventListener('click', () => switchEditorTab('pro'));

  // Default to Basic tab initially
  switchEditorTab('basic');

  // Seek preview to 0 on initial loading
  updateCanvasDimensions();

  window.addEventListener('resize', () => {
    updateCanvasDimensions();
    updateTimelineUI();
  });
}
