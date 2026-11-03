import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Audit test ensuring no user-visible "FragMill" or "GeoLab" strings remain
 * across the application, outside preserved legacy internal identifiers.
 */
describe('FraGeo Suite Branding Audit (User-Visible Strings Scan)', () => {
  function getSourceFiles(dir: string, fileList: string[] = []): string[] {
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
    // 1. Preserved Dexie database name and table names
    /['"]FragMillDB['"]/,
    /\bgeolabProjects\b/,
    // 2. Preserved localStorage keys & storage keys
    /['"]fragmill_[a-zA-Z0-9_]+['"]/,
    /STORAGE_KEY\s*=\s*['"]fragmill_/,
    /['"]geolab_organisation_profile['"]/,
    // 3. Preserved module identifiers in union types and routing
    /['"]fragmill['"]\s*\|\s*['"]geolab['"]/,
    /['"]fragmill['"]/,
    /['"]geolab['"]/,
    // 4. Developer TypeScript types, interfaces, import paths, and internal functions
    /\bGeoLab(TestType|Analysis|Project|Client|Sample|Signatory|StandardRef|TestDefinition|Tab|Shell|Module)\b/,
    /\b(GEOLAB_TESTS_REGISTRY|GEOLAB_TEST_LIST|getTestDefinition|generateGeoLabExcelReport|generateGeoLabPdfReport|generateGeoLabNarrative|exportProjectReportsZip|seedGeoLabDemoData)\b/,
    /\b(FragMillDatabase|onSwitchToFragMill)\b/,
    /from\s+['"].*geolab.*['"]/,
    /}\s+from\s+['"].*geolab.*['"]/,
    /import\s+.*['"].*geolab.*['"]/,
    /throw\s+new\s+Error\([^)]*GeoLab/,
    // 5. Preserved preset URIs and backup regex
    /local:\/\/fragmill-/,
    /fragmill\|frageo/i,
    // 6. Source code comments
    /^\s*\/\//,
    /^\s*\*/,
    /\/\*[\s\S]*?\*\//,
  ];

  it('scans all source files and verifies zero user-visible "FragMill" or "GeoLab" strings', () => {
    const srcDir = path.resolve(__dirname, '..');
    const files = getSourceFiles(srcDir);
    const violations: { file: string; line: number; text: string }[] = [];

    for (const filePath of files) {
      const relativePath = path.relative(srcDir, filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((rawLine, index) => {
        const line = rawLine.trim();
        // Check if line contains FragMill or GeoLab (case-insensitive)
        if (/(fragmill|geolab)/i.test(line)) {
          // Check if it matches an allowed internal identifier
          let isAllowed = false;
          for (const pattern of allowedPatterns) {
            if (pattern.test(line)) {
              // Ensure the line doesn't also contain a user-visible string like:
              // <span>...FragMill...</span> or "FragMill Study" or "GeoLab Report"
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
      const summary = violations
        .map((v) => `  - ${v.file}:${v.line}: "${v.text}"`)
        .join('\n');
      expect.fail(
        `Found ${violations.length} user-visible "FragMill" or "GeoLab" strings outside legacy internal identifiers:\n${summary}`
      );
    }

    expect(violations).toHaveLength(0);
  });
});
