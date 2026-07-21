const fs = require('fs');
const execSync = require('child_process').execSync;
const res = execSync('powershell "Get-ChildItem -Path C:\\Yapay_Zeka_Uygulamalar\\Kaymak\\app, C:\\Yapay_Zeka_Uygulamalar\\Kaymak\\components -Recurse -File -Include *.tsx,*.ts | Select-Object FullName"').toString();
const files = res.split('\n').map(l => l.trim()).filter(Boolean).filter(l => l.endsWith('.tsx') || l.endsWith('.ts'));

// Turkish character matching or common untranslated strings (we'll also search for literal text between tags)
const turkishChars = /[ğüşöçİĞÜŞÖÇ]/i;
const results = [];

for (let file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    // Basic filter for Turkish characters, excluding comments and already translated ones if possible
    if (turkishChars.test(line) && !line.trim().startsWith('//') && !line.includes('t(')) {
      results.push(file + ':' + (i+1) + ' ' + line.trim());
    }
  });
}
fs.writeFileSync('hardcoded_turkish.txt', results.join('\n'));
console.log('Found ' + results.length + ' lines with Turkish characters.');
