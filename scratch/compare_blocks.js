import fs from 'fs';

const html = fs.readFileSync('C:/Users/musht/Downloads/Story_Hubbing/Story_Hubbing/index.html', 'utf8');
const lines = html.split('\n');

const block1 = lines.slice(604, 927).join('\n');
const block2 = lines.slice(929, 1252).join('\n');

console.log("Block 1 length:", block1.length);
console.log("Block 2 length:", block2.length);

if (block1 === block2) {
  console.log("✅ The blocks are EXACTLY identical!");
} else {
  console.log("❌ The blocks are DIFFERENT!");
  // Write blocks to scratch files for inspection
  fs.writeFileSync('scratch/block1.html', block1);
  fs.writeFileSync('scratch/block2.html', block2);
  console.log("Blocks written to scratch/block1.html and scratch/block2.html for diffing.");
}
