import type { jsPDF } from 'jspdf';

/**
 * Transliterates Greek characters and special symbols to readable ASCII/Latin-1
 * representations when falling back to default Helvetica font.
 */
export function transliterateGreekAndSpecialChars(text: string): string {
  if (!text) return text;
  return text
    .replace(/ρd_opm/g, 'rho_d_opm')
    .replace(/ρd_max/g, 'rho_d_max')
    .replace(/ρd/g, 'rho_d')
    .replace(/ρs/g, 'rho_s')
    .replace(/ρ/g, 'rho')
    .replace(/γ/g, 'gamma')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/°/g, ' deg')
    .replace(/[\uE000-\uF8FF]/g, '-') // Replace private-use bullet glyphs with standard dash
    .replace(/Ád_opm/g, 'rho_d_opm')
    .replace(/Ád/g, 'rho_d');
}

/**
 * Lazy-loads the bundled Unicode Roboto font (Regular & Bold) and registers it with jsPDF.
 * If the font succeeds, it wraps doc.setFont so standard font calls use Roboto.
 * If loading fails, it falls back to Helvetica and transliterates special characters.
 */
export async function setupUnicodeFont(doc: jsPDF): Promise<boolean> {
  try {
    const { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } = await import('../../assets/fonts/robotoBase64');

    doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

    doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD_BASE64);
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

    const originalSetFont = doc.setFont.bind(doc);
    (doc as any).__originalSetFont = originalSetFont;

    doc.setFont = function (fontName: string, fontStyle?: string) {
      if (fontName === 'helvetica' || fontName === 'Roboto') {
        const style = fontStyle === 'bold' ? 'bold' : 'normal';
        return originalSetFont('Roboto', style);
      }
      return originalSetFont(fontName, fontStyle);
    } as any;

    const originalText = doc.text.bind(doc);
    doc.text = function (text: any, x: any, y: any, options: any) {
      const currentFont = doc.getFont()?.fontName;
      if (currentFont === 'times') {
        if (typeof text === 'string') {
          text = transliterateGreekAndSpecialChars(text);
        } else if (Array.isArray(text)) {
          text = text.map((t) => (typeof t === 'string' ? transliterateGreekAndSpecialChars(t) : t));
        }
      }
      return originalText(text, x, y, options);
    } as any;

    doc.setFont('Roboto', 'normal');
    (doc as any).__isUnicodeFontActive = true;
    return true;
  } catch (err) {
    console.warn('[PDF] Failed to load Unicode font, falling back to Helvetica with transliteration:', err);

    (doc as any).__isUnicodeFontActive = false;

    // Wrap doc.text to automatically transliterate Greek and special characters
    const originalText = doc.text.bind(doc);
    doc.text = function (text: any, x: any, y: any, options: any) {
      if (typeof text === 'string') {
        text = transliterateGreekAndSpecialChars(text);
      } else if (Array.isArray(text)) {
        text = text.map((t) => (typeof t === 'string' ? transliterateGreekAndSpecialChars(t) : t));
      }
      return originalText(text, x, y, options);
    } as any;

    doc.setFont('helvetica', 'normal');
    return false;
  }
}
