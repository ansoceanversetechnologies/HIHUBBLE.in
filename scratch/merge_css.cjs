const fs = require('fs');

const fileA = 'c:/HIHUBBLETest/HIHUBBLE/src/style.css';
const fileB = 'c:/HIHUBBLEStory/HIHUBBLE (1)/HIHUBBLE/src/style.css';

const contentB = fs.readFileSync(fileB, 'utf8');
const blocks = contentB.split(/}\s*/);

const keywords = ['create-hubbs', 'review-hubbs', 'ch-', 'he-canvas', 'hubble', 'sticker', 'filter', 'crop', 'Hubb', 'hubb'];
const shareHubbsBlocks = [];

for (const block of blocks) {
  if (!block.trim()) continue;
  const lowerBlock = block.toLowerCase();
  if (keywords.some(k => lowerBlock.includes(k.toLowerCase()))) {
    shareHubbsBlocks.push(block.trim() + '\n}');
  }
}

let contentA = fs.readFileSync(fileA, 'utf8');
contentA += '\n\n/* --- SHAREHUBBS MIGRATED CSS --- */\n\n';
contentA += shareHubbsBlocks.join('\n\n');

fs.writeFileSync(fileA, contentA, 'utf8');
console.log('Successfully merged ' + shareHubbsBlocks.length + ' CSS blocks for ShareHUBBS.');
