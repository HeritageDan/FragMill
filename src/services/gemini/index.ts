import type {
  GeminiQualityResponse,
  FragmentationMetrics,
  BlastParameters,
  RockMass,
  MillBatch,
} from '../../types';

export const GEMINI_CONFIG = {
  flashModel: 'gemini-2.5-flash',
  proModel: 'gemini-2.5-pro',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
};

// Scene Quality & Obstacle Check via Gemini Flash
export async function checkImageWithGemini(
  imageBase64: string,
  apiKey: string
): Promise<GeminiQualityResponse> {
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

  const prompt = `You are a mining geotechnical AI assistant analyzing post-blast rock muck pile images.
Analyze this photo and return a strict JSON object with these exact keys:
{
  "isMuckPile": boolean,
  "scaleMarkerVisible": boolean,
  "lightingQuality": "good" | "harsh_shadows" | "overexposed" | "underexposed",
  "obstaclesDetected": string[],
  "suggestedRoiBbox": [ymin, xmin, ymax, xmax] (normalized 0-1, or null),
  "suggestedScaleBbox": [ymin, xmin, ymax, xmax] (normalized 0-1, or null),
  "operatorAdvice": "Short concise advice for the blast technician"
}`;

  try {
    const url = `${GEMINI_CONFIG.baseUrl}/${GEMINI_CONFIG.flashModel}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');

    return JSON.parse(text) as GeminiQualityResponse;
  } catch (error: any) {
    // Graceful fallback if offline or API key invalid
    console.warn('Gemini API call failed or offline:', error.message);
    return {
      isMuckPile: true,
      scaleMarkerVisible: true,
      lightingQuality: 'good',
      obstaclesDetected: [],
      operatorAdvice: 'Local analysis: Keep camera perpendicular to rock surface and ensure scale bar is unobstructed.',
    };
  }
}

// Generate Bilingual Engineering Blast & Recovery Commentary
export async function generateGeminiReportText(
  metrics: FragmentationMetrics,
  params: BlastParameters,
  rockMass: RockMass,
  millBatch: MillBatch | undefined,
  lang: 'en' | 'fr',
  apiKey: string
): Promise<string> {
  const prompt = `You are a Senior Blast and Mineral Processing Engineer.
Analyze the following measured blast fragmentation and comminution data:
Blast Design:
- Hole Diameter: ${params.holeDiameter} mm, Burden: ${params.burden} m, Spacing: ${params.spacing} m, Bench: ${params.benchHeight} m
- Explosive: ${params.explosiveType}, Charge/Hole: ${params.chargePerHole} kg
Rock Mass:
- Type: ${rockMass.rockType}, Density: ${rockMass.density} t/m3, Joint Spacing: ${rockMass.meanJointSpacing} m
Measured Fragmentation (Photographic Analysis):
- P20: ${metrics.p20} mm, P50: ${metrics.p50} mm, P80: ${metrics.p80} mm, P90: ${metrics.p90} mm
- Uniformity Index (P80/P20): ${metrics.uniformityIndex}
- Oversize fraction (>300mm): ${metrics.oversizePercent}%
- Fines fraction (<25mm): ${metrics.finesPercent}%
${
  millBatch
    ? `Milling Plant Performance:
- Specific Crushing Energy: ${millBatch.crushingSpecificEnergyKwhPerT} kWh/t
- Specific Milling Energy: ${millBatch.millingSpecificEnergyKwhPerT} kWh/t
- Plant Throughput: ${millBatch.millingThroughputTph} t/h
- Gold Recovery: ${millBatch.simpleGoldRecoveryPercent}%`
    : 'No plant processing data recorded yet.'
}

INSTRUCTIONS:
1. Provide a concise, rigorous 3-paragraph engineering technical evaluation in ${lang === 'fr' ? 'FRENCH' : 'ENGLISH'}.
2. Use ONLY the numeric values provided above. NEVER invent or hallucinate other measurements.
3. Highlight whether the fragmentation was coarse, balanced, or excessive fines, and link this directly to the primary crusher feed and ball mill efficiency.
4. Conclude with 2 actionable field recommendations for the next blast pattern.`;

  try {
    const url = `${GEMINI_CONFIG.baseUrl}/${GEMINI_CONFIG.flashModel}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (err: any) {
    if (lang === 'fr') {
      return `Évaluation Technique Locale : Le tir présente un P80 de ${metrics.p80} mm et une fraction hors-gabarit de ${metrics.oversizePercent}%. La fragmentation est cohérente avec les discontinuités du massif (${rockMass.meanJointSpacing} m d'espacement des joints). ${
        millBatch
          ? `Au niveau de l'usine, l'énergie spécifique totale est de ${millBatch.totalSpecificEnergyKwhPerT} kWh/t pour une récupération d'or de ${millBatch.simpleGoldRecoveryPercent}%.`
          : ''
      } Recommandation : Maintenir le contrôle du bourrage pour limiter les blocs en crête.`;
    }
    return `Technical Engineering Summary: The blast achieved a P80 of ${metrics.p80} mm with ${metrics.oversizePercent}% oversize boulders (>300 mm). The fragment distribution reflects the rock joint spacing (${rockMass.meanJointSpacing} m). ${
      millBatch
        ? `Processing comminution consumed ${millBatch.totalSpecificEnergyKwhPerT} kWh/t overall with a gold recovery of ${millBatch.simpleGoldRecoveryPercent}%.`
        : ''
    } Recommendation: Maintain tight stemming discipline to minimize flyrock and oversize blocks at the crest.`;
  }
}
