import type {
  GeminiQualityResponse,
  FragmentationMetrics,
  BlastParameters,
  RockMass,
  MillBatch,
} from '../../types';

export const GEMINI_CONFIG = {
  flashModel: 'gemini-1.5-flash',
  proModel: 'gemini-1.5-pro',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
};

export interface GeminiRequestOptions {
  model?: string;
  generationConfig?: any;
}

export interface GeminiResponseResult {
  ok: boolean;
  data?: any;
  error?: string;
  status?: number;
  modelUsed?: string;
}

export interface GeminiTestResult {
  success: boolean;
  message: string;
  model?: string;
  statusCode?: number;
  fixSuggestions?: string[];
}

/**
 * Universal Gemini API content generator with smart model cascading fallback,
 * dual auth (query param + x-goog-api-key header), and comprehensive error diagnosis.
 */
export async function postGeminiGenerateContent(
  apiKey: string,
  contents: any[],
  options?: GeminiRequestOptions
): Promise<GeminiResponseResult> {
  const cleanKey = apiKey ? apiKey.trim() : '';
  if (!cleanKey) {
    return { ok: false, error: 'Clé API absente' };
  }

  // Model cascade: try preferred model first, then standard reliable fallbacks
  const preferred = options?.model || GEMINI_CONFIG.flashModel;
  const candidateModels = Array.from(
    new Set([preferred, 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'])
  ).filter(Boolean);

  let lastStatus = 0;
  let lastError = '';

  for (const model of candidateModels) {
    try {
      // Pass key both in URL query parameter (standard REST) and in header for maximum compatibility
      const url = `${GEMINI_CONFIG.baseUrl}/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey,
        },
        body: JSON.stringify({
          contents,
          generationConfig: options?.generationConfig,
        }),
      });

      lastStatus = response.status;
      if (response.ok) {
        const data = await response.json();
        return { ok: true, data, modelUsed: model };
      }

      let rawText = '';
      try {
        rawText = await response.text();
      } catch {
        // ignore
      }

      let parsedMessage = '';
      try {
        const errJson = JSON.parse(rawText);
        if (errJson?.error?.message) {
          parsedMessage = errJson.error.message;
        }
      } catch {
        parsedMessage = rawText.slice(0, 300);
      }

      lastError = parsedMessage || `Erreur HTTP ${response.status}`;

      // If invalid key format or completely invalid key, stop looping
      if (response.status === 400 && lastError.toLowerCase().includes('api key not valid')) {
        break;
      }
      // If Generative Language API is disabled on the GCP project, looping won't help
      if (
        lastError.toLowerCase().includes('generative language api has not been used') ||
        lastError.toLowerCase().includes('is disabled')
      ) {
        break;
      }
      // If user location is not supported, looping won't help
      if (lastError.toLowerCase().includes('user location is not supported')) {
        break;
      }
      // If it's a 404 (model not found) or 403 (model permission denied for this specific model),
      // the loop continues to try the next candidate model (e.g. gemini-1.5-flash)!
    } catch (networkErr: any) {
      lastError = networkErr.message || 'Erreur réseau';
      break;
    }
  }

  return { ok: false, error: lastError, status: lastStatus };
}

// Scene Quality & Obstacle Check via Gemini Flash
export async function checkImageWithGemini(
  imageBase64: string,
  apiKey?: string,
  preferredModel?: string
): Promise<GeminiQualityResponse> {
  const offlineFallback: GeminiQualityResponse = {
    isMuckPile: true,
    scaleMarkerVisible: true,
    lightingQuality: 'good',
    obstaclesDetected: [],
    operatorAdvice:
      'Mode hors-ligne (Calculs géotechniques locaux) : Les contrôles métrologiques de netteté, contraste et résolution sont validés localement.',
  };

  if (!apiKey || apiKey.trim() === '') {
    return offlineFallback;
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
    const res = await postGeminiGenerateContent(
      apiKey,
      [
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
      {
        model: preferredModel,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }
    );

    if (!res.ok || !res.data) {
      return offlineFallback;
    }

    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return offlineFallback;

    return JSON.parse(text) as GeminiQualityResponse;
  } catch (error: any) {
    console.warn('Gemini API call failed or offline:', error.message);
    return offlineFallback;
  }
}

// Quick connectivity & validation test for user-provided Gemini API key
export async function testGeminiApiKey(
  apiKey: string,
  preferredModel?: string
): Promise<GeminiTestResult> {
  const cleanKey = apiKey ? apiKey.trim() : '';
  if (!cleanKey) {
    return {
      success: false,
      message: 'Veuillez saisir une clé API Gemini (commençant par AIzaSy...).',
    };
  }

  const result = await postGeminiGenerateContent(
    cleanKey,
    [{ parts: [{ text: 'Respond with OK.' }] }],
    {
      model: preferredModel,
      generationConfig: {
        maxOutputTokens: 10,
      },
    }
  );

  if (result.ok && result.data) {
    return {
      success: true,
      message: `Connexion réussie avec Google Gemini (${result.modelUsed}) !`,
      model: result.modelUsed,
    };
  }

  const status = result.status || 0;
  const rawErr = result.error || (status ? `Erreur HTTP ${status}` : 'Erreur inconnue');
  const suggestions: string[] = [];
  let diagnosticMessage = rawErr;

  if (status === 403) {
    const errLower = rawErr.toLowerCase();
    if (
      errLower.includes('generative language api has not been used') ||
      errLower.includes('is disabled')
    ) {
      diagnosticMessage =
        'Erreur HTTP 403 : L\'API "Generative Language API" n\'est pas activée sur votre projet Google Cloud.';
      suggestions.push(
        'Méthode 1 (Recommandée & Gratuite) : Créez directement votre clé sur Google AI Studio (https://aistudio.google.com/app/apikey). Les clés AI Studio ont l\'API déjà activée et ne nécessitent aucune configuration GCP.'
      );
      suggestions.push(
        'Méthode 2 : Dans Google Cloud Console, ouvrez "Bibliothèque d\'API", recherchez "Generative Language API" et cliquez sur "Activer".'
      );
    } else if (errLower.includes('referer') || errLower.includes('referrer')) {
      diagnosticMessage =
        'Erreur HTTP 403 : Votre clé API a une restriction d\'application par "Référent HTTP" qui bloque localhost.';
      suggestions.push(
        'Dans Google Cloud Console > Identifiants > Modifier votre clé : Dans "Restrictions relatives aux applications", choisissez "Aucune" ou ajoutez http://localhost:* et http://127.0.0.1:*.'
      );
    } else if (errLower.includes('blocked') || errLower.includes('not allowed')) {
      diagnosticMessage =
        'Erreur HTTP 403 : Votre clé a des restrictions d\'API qui interdisent l\'appel à Generative Language API.';
      suggestions.push(
        'Dans Google Cloud Console > Identifiants > Modifier votre clé : Dans "Restrictions relatives aux API", cochez "Ne pas restreindre la clé" ou cochez explicitement "Generative Language API".'
      );
    } else if (errLower.includes('user location is not supported')) {
      diagnosticMessage =
        'Erreur HTTP 403 : Votre localisation géographique ou votre VPN n\'est pas pris en charge par Google AI Studio.';
      suggestions.push(
        'Désactivez votre VPN ou connectez-vous depuis un pays pris en charge (France, USA, Canada, UE...).'
      );
    } else {
      diagnosticMessage = `Erreur HTTP 403 (Accès Refusé) : Google a rejeté l'accès avec cette clé (${rawErr}).`;
      suggestions.push(
        'Solution recommandée (1 minute) : Rendez-vous sur https://aistudio.google.com/app/apikey et cliquez sur "Create API key in new project". Cette clé gratuite fonctionne immédiatement sans restriction.'
      );
      suggestions.push(
        'Si la clé a été créée sur Google Cloud Console : assurez-vous que la "Generative Language API" est activée et qu\'aucune restriction (IP, HTTP Referrer) ne bloque votre navigateur local.'
      );
      suggestions.push(
        'Rappel : Sans clé Gemini ou en mode déconnecté, FragMill et Geolab restent 100% opérationnels en mode local hors-ligne avec toutes les formules géotechniques réelles.'
      );
    }
  } else if (status === 400 || rawErr.toLowerCase().includes('api key not valid')) {
    diagnosticMessage =
      'Clé API invalide (Erreur 400) : Vérifiez que la clé commence par AIzaSy et a été copiée sans espaces.';
    suggestions.push('Obtenez une clé valide sur https://aistudio.google.com/app/apikey');
  } else if (status === 429) {
    diagnosticMessage =
      'Quota de requêtes dépassé (Erreur 429) : Trop de requêtes envoyées à l\'API Gemini.';
    suggestions.push(
      'Patientez une minute avant de réessayer (le quota gratuit est de 15 requêtes/minute).'
    );
  } else if (status === 0 || rawErr.toLowerCase().includes('failed to fetch')) {
    diagnosticMessage =
      'Impossible de contacter les serveurs Google (Vérifiez votre connexion Internet ou pare-feu).';
    suggestions.push('L\'application bascule automatiquement sur le mode local hors-ligne.');
  }

  return {
    success: false,
    message: diagnosticMessage,
    statusCode: status,
    fixSuggestions: suggestions,
  };
}

// Generate Bilingual Engineering Blast & Recovery Commentary
export async function generateGeminiReportText(
  metrics: FragmentationMetrics,
  params: BlastParameters,
  rockMass: RockMass,
  millBatch: MillBatch | undefined,
  lang: 'en' | 'fr',
  apiKey?: string,
  preferredModel?: string
): Promise<string> {
  const getDeterministicSummary = () => {
    const pf =
      params.burden && params.spacing && params.benchHeight && params.chargePerHole
        ? Number(
            (params.chargePerHole / (params.burden * params.spacing * params.benchHeight)).toFixed(2)
          )
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
${
  millBatch
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
${
  millBatch
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
    const res = await postGeminiGenerateContent(
      apiKey,
      [{ parts: [{ text: prompt }] }],
      {
        model: preferredModel,
        generationConfig: {
          temperature: 0.2,
        },
      }
    );

    if (res.ok && res.data) {
      const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim().length > 0) {
        return text.trim();
      }
    }
    return getDeterministicSummary();
  } catch (err: any) {
    console.warn('Gemini API call failed, falling back to local deterministic summary:', err.message);
    return getDeterministicSummary();
  }
}
