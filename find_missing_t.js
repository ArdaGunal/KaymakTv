const fs = require('fs');
const execSync = require('child_process').execSync;
const res = execSync('powershell "Get-ChildItem -Path C:\\Yapay_Zeka_Uygulamalar\\Kaymak\\app, C:\\Yapay_Zeka_Uygulamalar\\Kaymak\\components -Recurse -File -Include *.tsx,*.ts | Select-Object FullName"').toString();
const files = res.split('\n').map(l => l.trim()).filter(Boolean).filter(l => l.endsWith('.tsx') || l.endsWith('.ts'));

for (let file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.match(/\bt\(/)) {
    if (!content.includes('useTranslation') && !content.includes('t: any')) {
      console.log('MISSING t IN:', file);
    }
  }
}
