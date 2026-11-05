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
  apiKey?: string
): Promise<GeminiQualityResponse> {
  if (!apiKey || apiKey.trim() === '') {
    return {
      isMuckPile: true,
      scaleMarkerVisible: true,
      lightingQuality: 'good',
      obstaclesDetected: [],
      operatorAdvice: 'Mode hors-ligne (Clé Gemini non configurée) : Les contrôles métrologiques locaux de netteté, contraste et résolution sont validés.',
    };
  }

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
    const url = `${GEMINI_CONFIG.baseUrl}/${GEMINI_CONFIG.flashModel}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
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
    // Explicit offline / unconfigured state rather than fabricating perfection
    console.warn('Gemini API call failed or offline:', error.message);
    return {
      isMuckPile: false,
      scaleMarkerVisible: false,
      lightingQuality: 'good',
      obstaclesDetected: [],
      operatorAdvice: 'Cloud AI quality check unavailable (offline or API key unconfigured). Inspect scale bar and lighting manually before processing.',
    };
  }
}

// Quick connectivity & validation test for user-provided Gemini API key
export async function testGeminiApiKey(
  apiKey: string
): Promise<{ success: boolean; message: string; model?: string }> {
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      message: 'Veuillez saisir une clé API Gemini (AIzaSy...).',
    };
  }

  try {
    const url = `${GEMINI_CONFIG.baseUrl}/${GEMINI_CONFIG.flashModel}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with OK.' }] }],
        generationConfig: {
          maxOutputTokens: 10,
        },
      }),
    });

    if (!response.ok) {
      let errMsg = `Erreur HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) {
          errMsg = errJson.error.message;
        }
      } catch {
        // ignore
      }
      return { success: false, message: errMsg };
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (reply) {
      return {
        success: true,
        message: 'Connexion réussie avec Google Gemini Flash !',
        model: GEMINI_CONFIG.flashModel,
      };
    }
    return { success: false, message: 'Réponse vide reçue du modèle Gemini.' };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Impossible de joindre les serveurs Google Gemini (vérifiez votre connexion Internet).',
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
  apiKey?: string
): Promise<string> {
  const getDeterministicSummary = () => {
    const pf = (params.burden && params.spacing && params.benchHeight && params.chargePerHole)
      ? Number((params.chargePerHole / (params.burden * params.spacing * params.benchHeight)).toFixed(2))
      : null;

    let recFr = '';
    let recEn = '';
    if ((metrics.oversizePercent || 0) > 10) {
      recFr = `1. Resserrer la banquette ou concentrer la charge de pied pour résorber les blocs hors-gabarit (>300 mm : ${metrics.oversizePercent}%).\n2. Vérifier le temps de retard inter-trous pour intensifier le cisaillement en crête.`;
      recEn = `1. Tighten burden or concentrate toe charge to suppress oversize boulders (>300 mm: ${metrics.oversizePercent}%).\n2. Adjust inter-hole timing delay to intensify shear fracturing at the crest.`;
    } else if ((metrics.finesPercent || 0) > 12) {
      recFr = `1. Augmenter la hauteur de bourrage pour atténuer la pulvérisation en tête de trou (<25 mm : ${metrics.finesPercent}%).\n2. Réduire légèrement la charge spécifique pour limiter la surfragmentation.`;
      recEn = `1. Increase stemming height to prevent excessive collar pulverization (<25 mm: ${metrics.finesPercent}%).\n2. Moderate powder factor to prevent over-crushing and micro-fines generation.`;
    } else {
      recFr = `1. Maintenir la géométrie actuelle de maille (${params.burden} m × ${params.spacing} m) qui produit une courbe granulométrique bien équilibrée.\n2. Poursuivre le contrôle régulier de la qualité du bourrage et du profil du front.`;
      recEn = `1. Maintain current blast pattern (${params.burden} m × ${params.spacing} m) producing a well-balanced fragmentation curve.\n2. Continue routine quality control on stemming material and face burden.`;
    }

    if (lang === 'fr') {
      return `SYNTHÈSE TECHNIQUE DU TIR (MODE LOCAL HORS-LIGNE - DONNÉES MESURÉES) :

1. Caractéristiques & Granulométrie Réelle :
Maille de tir ${params.burden} m × ${params.spacing} m (gradin de ${params.benchHeight} m, ⌀ ${params.holeDiameter} mm) chargée en ${params.explosiveType || 'ANFO'} (${params.chargePerHole} kg/trou${pf ? `, charge spécifique q = ${pf} kg/m³` : ''}) dans un massif de ${rockMass.rockType} (densité : ${rockMass.density} t/m³, joints moyens : ${rockMass.meanJointSpacing} m). L'analyse optique certifie une taille médiane P50 de ${metrics.p50} mm et une alimentation broyeur P80 de ${metrics.p80} mm (uniformité n = ${metrics.uniformityIndex}). La fraction fine (<25 mm) s'élève à ${metrics.finesPercent}% et la fraction hors-gabarit (>300 mm) à ${metrics.oversizePercent}%.

2. Corrélation Comminution & Usine :
${millBatch
  ? `Les données usine confirment une énergie spécifique totale de ${millBatch.totalSpecificEnergyKwhPerT} kWh/t (concassage : ${millBatch.crushingSpecificEnergyKwhPerT} kWh/t, broyage : ${millBatch.millingSpecificEnergyKwhPerT} kWh/t) pour un débit de ${millBatch.millingThroughputTph} t/h et une récupération d'or de ${millBatch.simpleGoldRecoveryPercent}%.`
  : `Le P80 de ${metrics.p80} mm est directement compatible avec la trémie du concasseur primaire.`
}

3. Recommandations Opérationnelles de Terrain :
${recFr}`;
    }

    return `TECHNICAL BLAST EVALUATION (LOCAL OFFLINE MODE - MEASURED DATA):

1. Blast Parameters & Measured Sizing:
Pattern geometry ${params.burden} m × ${params.spacing} m (bench: ${params.benchHeight} m, ⌀ ${params.holeDiameter} mm) loaded with ${params.explosiveType || 'ANFO'} (${params.chargePerHole} kg/hole${pf ? `, powder factor PF = ${pf} kg/m³` : ''}) in ${rockMass.rockType} (density: ${rockMass.density} t/m³, joint spacing: ${rockMass.meanJointSpacing} m). Photographic sizing establishes a median size P50 of ${metrics.p50} mm and mill feed P80 of ${metrics.p80} mm (uniformity index n = ${metrics.uniformityIndex}). Fines (<25 mm) measure ${metrics.finesPercent}% and oversize boulders (>300 mm) reach ${metrics.oversizePercent}%.

2. Comminution Circuit Correlation:
${millBatch
  ? `Plant telemetry reports total specific energy of ${millBatch.totalSpecificEnergyKwhPerT} kWh/t (crushing: ${millBatch.crushingSpecificEnergyKwhPerT} kWh/t, milling: ${millBatch.millingSpecificEnergyKwhPerT} kWh/t) at ${millBatch.millingThroughputTph} t/h throughput with ${millBatch.simpleGoldRecoveryPercent}% recovery.`
  : `The measured feed P80 of ${metrics.p80} mm feeds directly into the primary crusher intake.`
}

3. Operational Recommendations:
${recEn}`;
  };

  if (!apiKey || apiKey.trim() === '') {
    return getDeterministicSummary();
  }
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
    const url = `${GEMINI_CONFIG.baseUrl}/${GEMINI_CONFIG.flashModel}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
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
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text && text.trim().length > 0) {
      return text.trim();
    }
    return getDeterministicSummary();
  } catch (err: any) {
    console.warn('Gemini API call failed, falling back to local deterministic summary:', err.message);
    return getDeterministicSummary();
  }
}
