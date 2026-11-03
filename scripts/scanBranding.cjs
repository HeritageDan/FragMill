const fs = require('fs');
const path = require('path');

function getSourceFiles(dir, fileList = []) {
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getSourceFiles(fullPath, fileList);
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.tsx') || entry.endsWith('.html')) &&
      !entry.includes('.test.')
    ) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const srcDir = path.resolve(__dirname, '../src');
const files = getSourceFiles(srcDir);
const violations = [];

for (const filePath of files) {
  const relativePath = path.relative(srcDir, filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (/^(\/\/|\*|\/\*)/.test(line)) {
      return;
    }
    if (/(frageo\s+blast|frageo\s+lab)/i.test(line)) {
      violations.push({
        file: relativePath,
        line: index + 1,
        text: line,
      });
    }
  });
}

if (violations.length > 0) {
  console.error(`Found ${violations.length} user-visible "FraGeo Blast" or "FraGeo Lab" strings:`);
  violations.forEach((v) => console.error(`  - ${v.file}:${v.line}: "${v.text}"`));
  process.exit(1);
} else {
  console.log(`Scan passed! Zero "FraGeo Blast" or "FraGeo Lab" strings found in ${files.length} source files.`);
  process.exit(0);
}
