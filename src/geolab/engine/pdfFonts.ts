import type { jsPDF } from 'jspdf';

/**
 * Transliterates Greek characters, subscripts, mathematical symbols and special characters
 * to readable standard ASCII/Latin-1 representations so that fonts like Times-Roman
 * or Helvetica never produce corrupted glyphs such as '£', '”', '• €', etc.
 */
export function transliterateGreekAndSpecialChars(text: string): string {
  if (!text) return text;
  return text
    // Greek uppercase and lowercase symbols
    .replace(/Σ|∑/g, 'Total ')
    .replace(/Δ|δ/g, 'Delta ')
    .replace(/ρd_opm/g, 'rho_d_opm')
    .replace(/ρd_max/g, 'rho_d_max')
    .replace(/ρd/g, 'rho_d')
    .replace(/ρs/g, 'rho_s')
    .replace(/ρ/g, 'rho')
    .replace(/γ/g, 'gamma')
    .replace(/μ|µ/g, 'u')
    .replace(/ø|Ø/g, 'D')
    // Subscripts
    .replace(/d₁₀/g, 'd10')
    .replace(/d₃₀/g, 'd30')
    .replace(/d₆₀/g, 'd60')
    .replace(/D₁₀/g, 'D10')
    .replace(/D₃₀/g, 'D30')
    .replace(/D₆₀/g, 'D60')
    .replace(/[\u2080-\u2089]/g, (m) => String(m.charCodeAt(0) - 0x2080))
    // Superscripts
    .replace(/[\u2070-\u2079]/g, (m) => String(m.charCodeAt(0) - 0x2070))
    .replace(/\u00B9/g, '1')
    .replace(/\u00B2/g, '2')
    .replace(/\u00B3/g, '3')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    // Mathematical & comparison
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/±/g, '+/-')
    .replace(/×/g, 'x')
    .replace(/°/g, ' deg')
    // Punctuation and dashes
    .replace(/[—–]/g, '-')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/…/g, '...')
    .replace(/[•·]/g, '-')
    // Markdown artifacts
    .replace(/\*\*/g, '')
    // Private-use and legacy corrupted glyphs
    .replace(/[\uE000-\uF8FF]/g, '-')
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
      if (!currentFont || currentFont.toLowerCase().includes('times') || !(doc as any).__isUnicodeFontActive) {
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
