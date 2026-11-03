import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Audit test ensuring no user-visible "FraGeo Blast" or "FraGeo Lab" strings remain
 * across the application, as the modules are named "Fragmill" and "Geolab".
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

  it('scans all source files and verifies zero user-visible "FraGeo Blast" or "FraGeo Lab" strings', () => {
    const srcDir = path.resolve(__dirname, '..');
    const files = getSourceFiles(srcDir);
    const violations: { file: string; line: number; text: string }[] = [];

    for (const filePath of files) {
      const relativePath = path.relative(srcDir, filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((rawLine, index) => {
        const line = rawLine.trim();
        // Comments are allowed
        if (/^(\/\/|\*|\/\*)/.test(line)) {
          return;
        }
        // Report footers and export templates legitimately use "FraGeo Lab" as per document branding requirements
        if (relativePath.includes('geolab') && (relativePath.includes('engine') || relativePath.includes('templates') || relativePath.includes('studies'))) {
          return;
        }
        // Check if line contains FraGeo Blast or FraGeo Lab (case-insensitive)
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
      const summary = violations
        .map((v) => `  - ${v.file}:${v.line}: "${v.text}"`)
        .join('\n');
      expect.fail(
        `Found ${violations.length} user-visible "FraGeo Blast" or "FraGeo Lab" strings:\n${summary}`
      );
    }

    expect(violations).toHaveLength(0);
  });
});
