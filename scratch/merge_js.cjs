const fs = require('fs');

const fileA = 'c:/HIHUBBLETest/HIHUBBLE/src/main.js';
const fileB = 'c:/HIHUBBLEStory/HIHUBBLE (1)/HIHUBBLE/src/main.js';

let contentA = fs.readFileSync(fileA, 'utf8');
const contentB = fs.readFileSync(fileB, 'utf8');

// 1. Update switchView top
const switchViewTopSearch = `  function switchView(viewName, userId) {\r\n    if (!viewName) return;`;
const switchViewTopReplace = `  function switchView(viewName, userId) {\n    if (!viewName) return;\n\n    if (state.activeView === 'create-hubbs' && viewName !== 'create-hubbs' && window.chUploads && window.chUploads.length > 0) {\n      window._silentDraftSave = true;\n      if (window.saveCurrentDraft) window.saveCurrentDraft();\n    }`;
if (contentA.includes(switchViewTopSearch)) {
    contentA = contentA.replace(switchViewTopSearch, switchViewTopReplace);
} else {
    // try without \r
    const switchViewTopSearch2 = `  function switchView(viewName, userId) {\n    if (!viewName) return;`;
    contentA = contentA.replace(switchViewTopSearch2, switchViewTopReplace);
}

// 2. Update switchView body classes
const switchViewClassesSearch = `    document.querySelectorAll('.view-panel').forEach(panel => {`;
const switchViewClassesReplace = `    if (viewName === 'create-hubbs') {\n      document.body.classList.add('create-hubbs-view-active');\n    } else {\n      document.body.classList.remove('create-hubbs-view-active');\n    }\n    if (viewName === 'review-hubbs') {\n      document.body.classList.add('review-hubbs-view-active');\n    } else {\n      document.body.classList.remove('review-hubbs-view-active');\n    }\n\n    document.querySelectorAll('.view-panel').forEach(panel => {`;
contentA = contentA.replace(switchViewClassesSearch, switchViewClassesReplace);

// 3. Update addStoryBtn
const addStoryBtnSearch = `  if (addStoryBtn) {\n    addStoryBtn.addEventListener('click', (e) => {\n      e.stopPropagation();\n      if (storyFileInput) storyFileInput.click();\n    });\n  }`;
const addStoryBtnReplace = `  if (addStoryBtn) {\n    addStoryBtn.addEventListener('click', (e) => {\n      e.stopPropagation();\n      switchView('create-hubbs');\n    });\n  }`;
const addStoryBtnSearchR = `  if (addStoryBtn) {\r\n    addStoryBtn.addEventListener('click', (e) => {\r\n      e.stopPropagation();\r\n      if (storyFileInput) storyFileInput.click();\r\n    });\r\n  }`;
if (contentA.includes(addStoryBtnSearchR)) {
    contentA = contentA.replace(addStoryBtnSearchR, addStoryBtnReplace);
} else {
    contentA = contentA.replace(addStoryBtnSearch, addStoryBtnReplace);
}

// 4. Extract ShareHUBBS code from Project B
const splitString = '// ==========================================\r\n// BEFORE / AFTER SLIDER LOGIC';
const splitString2 = '// ==========================================\n// BEFORE / AFTER SLIDER LOGIC';

let shareHubbsCode = '';
if (contentB.includes(splitString)) {
    shareHubbsCode = contentB.substring(contentB.indexOf(splitString));
} else if (contentB.includes(splitString2)) {
    shareHubbsCode = contentB.substring(contentB.indexOf(splitString2));
}

if (shareHubbsCode) {
    const customPublish = `
window.publishHubb = async function() {
  if (!window.chUploads || window.chUploads.length === 0) return;
  const media = window.chUploads[0];
  
  const pubBtn = document.getElementById('review-publish-btn');
  if (pubBtn) {
    pubBtn.disabled = true;
    pubBtn.innerHTML = '<i data-lucide="loader" class="animate-spin"></i> Processing...';
    if (window.lucide) window.lucide.createIcons();
  }

  try {
    // Create an offscreen canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Load image
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = media.thumbUrl || URL.createObjectURL(media.file);
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Apply CSS filters if present
    const state = media.editorState || {};
    const cssFilter = window.HubbleEditor && window.HubbleEditor.buildCSSFilterString ? window.HubbleEditor.buildCSSFilterString(state.filter || 'original', state.adjustments || {}) : 'none';
    ctx.filter = cssFilter !== 'none' ? cssFilter : 'none';
    
    // Draw base image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Reset filter for drawing text/stickers
    ctx.filter = 'none';
    
    // Render layers (Text & Stickers)
    if (state.layers && state.layers.length > 0) {
      state.layers.forEach(layer => {
         if (layer.type === 'text') {
            ctx.font = \`\${layer.fontSize}px \${layer.fontFamily}\`;
            ctx.fillStyle = layer.color;
            const x = (parseFloat(layer.x) / 100) * canvas.width || 0;
            const y = (parseFloat(layer.y) / 100) * canvas.height || 0;
            ctx.fillText(layer.text, x, y);
         } else if (layer.type === 'sticker') {
            const emojiFont = '100px Arial'; 
            ctx.font = emojiFont;
            const x = (parseFloat(layer.x) / 100) * canvas.width || 0;
            const y = (parseFloat(layer.y) / 100) * canvas.height || 0;
            ctx.fillText(layer.emoji, x, y);
         }
      });
    }

    const base64Image = canvas.toDataURL('image/jpeg', 0.9);
    
    // Link to Project A's upload logic
    currentStoryImageBase64 = base64Image;
    if (typeof submitStory === 'function') {
       await submitStory(false);
    } else {
       console.error("submitStory function not found!");
       showToast('Error: submitStory not found');
    }
  } catch (e) {
    console.error("Rasterization Error:", e);
    if (window.showToast) window.showToast('Failed to process image', 'error');
  } finally {
    if (pubBtn) {
      pubBtn.disabled = false;
      pubBtn.innerHTML = 'Publish Hubb <i data-lucide="upload-cloud"></i>';
      if (window.lucide) window.lucide.createIcons();
    }
  }
};
`;
    const publishHubbRegex = /window\.publishHubb\s*=\s*async\s*function\(\)\s*\{[\s\S]*?\n\};/m;
    shareHubbsCode = shareHubbsCode.replace(publishHubbRegex, customPublish);
    
    contentA += '\n\n' + shareHubbsCode;
} else {
    console.log("Could not find ShareHUBBS logic at the end of B");
    process.exit(1);
}

// 5. Ensure IndexedDB Drafts is also copied if it exists in B but not A
const draftsDBStr = '// --- INDEXEDDB DRAFTS WRAPPER ---';
if (contentB.includes(draftsDBStr) && !contentA.includes(draftsDBStr)) {
    const startIdx = contentB.indexOf(draftsDBStr);
    const endIdx = contentB.indexOf('// --- TOAST HELPER ---');
    if (startIdx !== -1 && endIdx !== -1) {
        const draftsCode = contentB.substring(startIdx, endIdx);
        // Insert right after imports in A
        const importEnd = contentA.indexOf('\n', contentA.indexOf('import ')) + 1;
        contentA = contentA.substring(0, importEnd) + '\n' + draftsCode + contentA.substring(importEnd);
    }
}

fs.writeFileSync(fileA, contentA, 'utf8');
console.log("Successfully merged JS logic with Canvas rasterization.");
