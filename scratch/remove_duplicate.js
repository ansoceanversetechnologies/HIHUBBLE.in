import fs from 'fs';

const filePath = 'C:/Users/musht/Downloads/Story_Hubbing/Story_Hubbing/index.html';
const html = fs.readFileSync(filePath, 'utf8');
const lines = html.split('\n');

// Verify that the lines we are removing are indeed the duplicate block
const verifyBlockStart = lines[928].trim(); // Line 929 (0-indexed 928)
const verifyBlockEnd = lines[1251].trim();   // Line 1252 (0-indexed 1251)

console.log("Verifying boundary lines before deletion...");
console.log("Start line text:", verifyBlockStart);
console.log("End line text:", verifyBlockEnd);

if (verifyBlockStart.includes('VIEW: SEARCH') && verifyBlockEnd === '</div>') {
  // Remove lines 928 to 1252 (0-indexed, which corresponds to lines 929 to 1253 in 1-indexed view)
  // lines.splice(start, deleteCount)
  // 1-indexed 928 is 0-indexed 927. We delete from 927 to 1252 (inclusive).
  // Number of lines: 1252 - 927 + 1 = 326 lines.
  lines.splice(927, 326);
  
  fs.writeFileSync(filePath, lines.join('\n'));
  console.log("✅ Successfully deleted duplicate block from index.html!");
} else {
  console.error("❌ Verification failed! Boundary lines did not match expectations.");
}
