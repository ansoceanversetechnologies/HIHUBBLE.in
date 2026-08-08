const fs = require('fs');

const fileA = 'c:/HIHUBBLETest/HIHUBBLE/src/style.css';
const fileB = 'c:/HIHUBBLEStory/HIHUBBLE (1)/HIHUBBLE/src/style.css';

const linesA = fs.readFileSync(fileA, 'utf8').split(/\r?\n/).map(l => l.trimEnd());
const linesB = fs.readFileSync(fileB, 'utf8').split(/\r?\n/).map(l => l.trimEnd());

let divergenceIndex = -1;
for (let i = 0; i < Math.min(linesA.length, linesB.length); i++) {
  if (linesA[i] !== linesB[i]) {
    divergenceIndex = i;
    break;
  }
}

console.log('Divergence index:', divergenceIndex);
console.log('Lines A length:', linesA.length);
console.log('Lines B length:', linesB.length);

if (divergenceIndex >= 0) {
    console.log('Line A at divergence:', linesA[divergenceIndex]);
    console.log('Line B at divergence:', linesB[divergenceIndex]);
}
