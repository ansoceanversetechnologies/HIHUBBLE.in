const fs = require('fs');

const fileA = 'c:/HIHUBBLETest/HIHUBBLE/index.html';
const fileB = 'c:/HIHUBBLEStory/HIHUBBLE (1)/HIHUBBLE/index.html';

const contentA = fs.readFileSync(fileA, 'utf8');
const contentB = fs.readFileSync(fileB, 'utf8');

// Find view-create-hubbs in B
const startCreateIdx = contentB.indexOf('<div id="view-create-hubbs"');
// Find view-search in B (which comes right after review-hubbs)
const startSearchIdxB = contentB.indexOf('<div id="view-search"');

if (startCreateIdx === -1 || startSearchIdxB === -1) {
  console.log("Could not find views in B");
  process.exit(1);
}

// Extract the views
const extractedViews = contentB.substring(startCreateIdx, startSearchIdxB);

// Insert into A right before view-search
const startSearchIdxA = contentA.indexOf('<div id="view-search"');
if (startSearchIdxA === -1) {
  console.log("Could not find view-search in A");
  process.exit(1);
}

const newContentA = contentA.substring(0, startSearchIdxA) + extractedViews + contentA.substring(startSearchIdxA);

fs.writeFileSync(fileA, newContentA, 'utf8');
console.log("Successfully merged HTML views.");
