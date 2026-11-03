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

const allowedPatterns = [
  /['"]FragMillDB['"]/,
  /['"]fragmill_[a-zA-Z0-9_]+['"]/,
  /STORAGE_KEY\s*=\s*['"]fragmill_/,
  /['"]fragmill['"]\s*\|\s*['"]geolab['"]/,
  /['"]fragmill['"]/,
  /['"]geolab['"]/,
  /['"]geolab_organisation_profile['"]/,
  /\bgeolabProjects\b/,
  /\bGeoLab(TestType|Analysis|Project|Client|Sample|Signatory|StandardRef|TestDefinition|Tab|Shell|Module)\b/,
  /\b(GEOLAB_TESTS_REGISTRY|GEOLAB_TEST_LIST|getTestDefinition|generateGeoLabExcelReport|generateGeoLabPdfReport|generateGeoLabNarrative|exportProjectReportsZip|seedGeoLabDemoData)\b/,
  /\b(FragMillDatabase|onSwitchToFragMill)\b/,
  /local:\/\/fragmill-/,
  /fragmill\|frageo/i,
  /^\s*\/\//,
  /^\s*\*/,
  /\/\*[\s\S]*?\*\//,
  /from\s+['"].*geolab.*['"]/,
  /}\s+from\s+['"].*geolab.*['"]/,
  /import\s+.*['"].*geolab.*['"]/,
  /throw\s+new\s+Error\([^)]*GeoLab/,
];

const srcDir = path.resolve(__dirname, '../src');
const files = getSourceFiles(srcDir);
const violations = [];

for (const filePath of files) {
  const relativePath = path.relative(srcDir, filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (/(fragmill|geolab)/i.test(line)) {
      let isAllowed = false;
      for (const pattern of allowedPatterns) {
        if (pattern.test(line)) {
          const userVisibleLeak =
            /<[^>]*>[^<]*(FragMill|GeoLab)[^<]*<\/[^>]*>/i.test(line) ||
            /['"][^'"]*(FragMill|GeoLab)\s+(Study|Report|Lab|Modele|Template)[^'"]*['"]/i.test(line) ||
            /title\s*=\s*['"][^'"]*(FragMill|GeoLab)[^'"]*['"]/i.test(line);

          if (!userVisibleLeak) {
            isAllowed = true;
            break;
          }
        }
      }

      if (!isAllowed) {
        violations.push({
          file: relativePath,
          line: index + 1,
          text: line,
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`Found ${violations.length} user-visible "FragMill" or "GeoLab" strings outside legacy internal identifiers:`);
  violations.forEach((v) => console.error(`  - ${v.file}:${v.line}: "${v.text}"`));
  process.exit(1);
} else {
  console.log(`Scan passed! Zero user-visible "FragMill" or "GeoLab" strings found in ${files.length} source files.`);
  process.exit(0);
}
