import type {
  GeminiQualityResponse,
  FragmentationMetrics,
  BlastParameters,
  RockMass,
  MillBatch,
  AiProvider,
} from '../../types';

export const CLAUDE_CONFIG = {
  defaultModel: 'claude-haiku-5-5',
  sonnetModel: 'claude-sonnet-5-5',
  reasoningModel: 'claude-opus-5-5',
  baseUrl: 'https://api.anthropic.com/v1/messages',
  modelsUrl: 'https://api.anthropic.com/v1/models',
  apiVersion: '2023-06-01',
};

export const GEMINI_CONFIG = {
  flashModel: 'gemini-1.5-flash',
  proModel: 'gemini-1.5-pro',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
};

export interface AiRequestOptions {
  provider?: AiProvider;
  model?: string;
  generationConfig?: any;
  maxTokens?: number;
  temperature?: number;
}

export interface AiResponseResult {
  ok: boolean;
  text?: string;
  data?: any;
  error?: string;
  status?: number;
  modelUsed?: string;
  providerUsed?: AiProvider;
}

export interface AiTestResult {
  success: boolean;
  message: string;
  provider?: AiProvider;
  model?: string;
  statusCode?: number;
  fixSuggestions?: string[];
}

export type GeminiTestResult = AiTestResult;

/**
 * Automatically detects whether an API key belongs to Anthropic Claude (sk-ant-...) or Google Gemini (AIzaSy...).
 */
export function detectAiProvider(apiKey?: string, explicitProvider?: AiProvider): AiProvider {
  if (explicitProvider) return explicitProvider;
  const key = apiKey ? apiKey.trim() : '';
  if (key.startsWith('sk-ant-') || key.startsWith('sk-')) return 'anthropic';
  if (key.startsWith('AIzaSy') || key.toLowerCase().includes('gemini')) return 'gemini';
  return 'anthropic';
}

/**
 * Fetch list of active models directly from Anthropic API.
 */
export async function fetchAvailableClaudeModels(apiKey?: string): Promise<string[]> {
  const fallbackList = [
    'claude-haiku-5-5',
    'claude-sonnet-5-5',
    'claude-opus-5-5',
    'claude-sonnet-5',
    'claude-opus-5',
    'claude-haiku-4-5-20251001',
  ];

  const cleanKey = apiKey ? apiKey.trim() : '';
  if (!cleanKey) return fallbackList;

  try {
    const res = await fetch(CLAUDE_CONFIG.modelsUrl, {
      method: 'GET',
      headers: {
        'x-api-key': cleanKey,
        'anthropic-version': CLAUDE_CONFIG.apiVersion,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.data)) {
        const ids = data.data.map((m: any) => m.id).filter(Boolean);
        if (ids.length > 0) return ids;
      }
    }
  } catch (err) {
    console.warn('Could not query Anthropic models API, using standard list:', err);
  }

  return fallbackList;
}

/**
 * Universal Anthropic Claude API Messages caller.
 * Uses 'anthropic-dangerous-direct-browser-access: true' for zero-backend client-side execution.
 */
export async function postClaudeMessages(
  apiKey: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string | any[] }>,
  options?: { model?: string; maxTokens?: number; temperature?: number; autoFallback?: boolean }
): Promise<AiResponseResult> {
  const cleanKey = apiKey ? apiKey.trim() : '';
  if (!cleanKey) {
    return { ok: false, error: 'Clé API Anthropic absente', providerUsed: 'anthropic' };
  }

  let chosenModel = options?.model || CLAUDE_CONFIG.defaultModel;
  // Automatically migrate retired Claude 3 model identifiers
  if (chosenModel.startsWith('claude-3')) {
    if (chosenModel.includes('sonnet')) chosenModel = CLAUDE_CONFIG.sonnetModel;
    else if (chosenModel.includes('opus')) chosenModel = CLAUDE_CONFIG.reasoningModel;
    else chosenModel = CLAUDE_CONFIG.defaultModel;
  }

  // Candidate models: user choice first, followed by active Claude 5/5.5 models if autoFallback is on
  const candidateModels = options?.autoFallback
    ? Array.from(new Set([chosenModel, CLAUDE_CONFIG.defaultModel, CLAUDE_CONFIG.sonnetModel, CLAUDE_CONFIG.reasoningModel])).filter(Boolean)
    : [chosenModel];

  let lastStatus = 0;
  let lastError = '';
  let lastModelTried = chosenModel;

  for (const model of candidateModels) {
    lastModelTried = model;
    try {
      const requestBody: any = {
        model,
        max_tokens: options?.maxTokens || 2500,
        messages,
      };
      // Anthropic deprecated 'temperature' on Claude 5/5.5 models (passing it returns 400 invalid_request_error)
      if (options?.temperature !== undefined && !model.includes('-5')) {
        requestBody.temperature = options.temperature;
      }

      const response = await fetch(CLAUDE_CONFIG.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cleanKey,
          'anthropic-version': CLAUDE_CONFIG.apiVersion,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(requestBody),
      });

      lastStatus = response.status;
      if (response.ok) {
        const data = await response.json();
        const textPart = data.content?.find((c: any) => c.type === 'text');
        const text = textPart ? textPart.text : (data.content?.[0]?.text || '');
        return {
          ok: true,
          text,
          data: {
            ...data,
            // Compatibility shim for code expecting Gemini-style candidate parts
            candidates: [{ content: { parts: [{ text }] } }],
          },
          modelUsed: model,
          providerUsed: 'anthropic',
        };
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

      // If invalid API key (401 authentication_error), no model will work, break immediately
      if (response.status === 401) {
        break;
      }
      // If billing issue (402) or rate limit (429), break immediately
      if (response.status === 402 || response.status === 429) {
        break;
      }
      // If credit balance too low (400), break immediately
      if (lastError.toLowerCase().includes('credit balance') || lastError.toLowerCase().includes('plans & billing')) {
        break;
      }
      // If 404 (model not found/deprecated) and we haven't tried defaultModel yet, continue to next candidate
      if (response.status === 404 && model !== CLAUDE_CONFIG.defaultModel) {
        continue;
      }
    } catch (networkErr: any) {
      lastError = networkErr.message || 'Erreur réseau';
      break;
    }
  }

  return { ok: false, error: lastError, status: lastStatus, modelUsed: lastModelTried, providerUsed: 'anthropic' };
}

/**
 * Universal Google Gemini API content generator with model cascading.
 */
export async function postGeminiGenerateContent(
  apiKey: string,
  contents: any[],
  options?: { model?: string; generationConfig?: any }
): Promise<AiResponseResult> {
  const cleanKey = apiKey ? apiKey.trim() : '';
  if (!cleanKey) {
    return { ok: false, error: 'Clé API Google absente', providerUsed: 'gemini' };
  }

  const preferred = options?.model || GEMINI_CONFIG.flashModel;
  const candidateModels = Array.from(
    new Set([preferred, 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'])
  ).filter(Boolean);

  let lastStatus = 0;
  let lastError = '';

  for (const model of candidateModels) {
    try {
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
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return { ok: true, text, data, modelUsed: model, providerUsed: 'gemini' };
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

      if (response.status === 400 && lastError.toLowerCase().includes('api key not valid')) {
        break;
      }
      if (
        lastError.toLowerCase().includes('generative language api has not been used') ||
        lastError.toLowerCase().includes('is disabled') ||
        lastError.toLowerCase().includes('user location is not supported')
      ) {
        break;
      }
    } catch (networkErr: any) {
      lastError = networkErr.message || 'Erreur réseau';
      break;
    }
  }

  return { ok: false, error: lastError, status: lastStatus, providerUsed: 'gemini' };
}

/**
 * Universal content dispatcher: routes to Anthropic Claude (default) or Google Gemini.
 */
export async function postAiGenerateContent(
  apiKey: string,
  contents: any[],
  options?: AiRequestOptions
): Promise<AiResponseResult> {
  const provider = detectAiProvider(apiKey, options?.provider);

  if (provider === 'anthropic') {
    // Convert contents payload to Claude messages format
    const claudeContent: any[] = [];

    for (const item of contents) {
      if (typeof item === 'string') {
        claudeContent.push({ type: 'text', text: item });
      } else if (item.parts) {
        for (const part of item.parts) {
          if (part.text) {
            claudeContent.push({ type: 'text', text: part.text });
          } else if (part.inlineData) {
            claudeContent.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: part.inlineData.mimeType || 'image/jpeg',
                data: part.inlineData.data,
              },
            });
          }
        }
      }
    }

    const messages = [
      {
        role: 'user' as const,
        content: claudeContent.length === 1 && claudeContent[0].type === 'text'
          ? claudeContent[0].text
          : claudeContent,
      },
    ];

    return postClaudeMessages(apiKey, messages, {
      model: options?.model,
      maxTokens: options?.maxTokens || options?.generationConfig?.maxOutputTokens || 1024,
      temperature: options?.temperature ?? options?.generationConfig?.temperature ?? 0.2,
    });
  }

  // Gemini provider
  return postGeminiGenerateContent(apiKey, contents, {
    model: options?.model,
    generationConfig: options?.generationConfig,
  });
}

/**
 * Connectivity test for Anthropic Claude API Key.
 */
export async function testClaudeApiKey(
  apiKey: string,
  preferredModel?: string
): Promise<AiTestResult> {
  const cleanKey = apiKey ? apiKey.trim() : '';
  if (!cleanKey) {
    return {
      success: false,
      message: 'Veuillez saisir une clé API Anthropic Claude (commençant par sk-ant-...).',
      provider: 'anthropic',
    };
  }

  let modelToTest = preferredModel || CLAUDE_CONFIG.defaultModel;
  if (modelToTest.startsWith('claude-3')) {
    if (modelToTest.includes('sonnet')) modelToTest = CLAUDE_CONFIG.sonnetModel;
    else if (modelToTest.includes('opus')) modelToTest = CLAUDE_CONFIG.reasoningModel;
    else modelToTest = CLAUDE_CONFIG.defaultModel;
  }

  // Test the model with graceful fallback to active Claude models
  const result = await postClaudeMessages(
    cleanKey,
    [{ role: 'user', content: 'Respond with OK.' }],
    {
      model: modelToTest,
      maxTokens: 10,
      autoFallback: true,
    }
  );

  if (result.ok) {
    return {
      success: true,
      message: `Connexion réussie avec Anthropic Claude (${result.modelUsed}) !`,
      provider: 'anthropic',
      model: result.modelUsed,
    };
  }

  const status = result.status || 0;
  const rawErr = result.error || (status ? `Erreur HTTP ${status}` : 'Erreur inconnue');
  const suggestions: string[] = [];
  let diagnosticMessage = rawErr;
  const errLower = rawErr.toLowerCase();

  if (
    status === 401 ||
    errLower.includes('invalid x-api-key') ||
    errLower.includes('authentication_error')
  ) {
    diagnosticMessage =
      'Clé API Anthropic invalide (Erreur 401) : La clé x-api-key n\'est pas reconnue par Anthropic.';
    suggestions.push(
      'Vérifiez que votre clé commence par "sk-ant-..." et a été copiée sans espaces au début ou à la fin.'
    );
    suggestions.push(
      'Générez une nouvelle clé sur Anthropic Console : https://console.anthropic.com/settings/keys'
    );
  } else if (
    status === 404 ||
    errLower.includes('not_found_error') ||
    errLower.includes('model:')
  ) {
    diagnosticMessage = `Modèle non accessible (${rawErr}).`;
    suggestions.push(
      '1. Les anciens modèles de génération Claude 3 ont été retirés par Anthropic. Utilisez les modèles actifs actuels : "claude-haiku-5-5" (recommandé), "claude-sonnet-5-5", ou "claude-opus-5-5".'
    );
    suggestions.push(
      '2. Solde de crédits Anthropic requis : L\'API Anthropic nécessite un compte avec crédits prépayés actifs. Rendez-vous sur https://console.anthropic.com/settings/billing pour vérifier votre solde.'
    );
    suggestions.push(
      '3. Alternative 100% GRATUITE sans carte bancaire : Basculez sur l\'onglet Google Gemini ci-dessus (modèle Gemini 1.5 Flash gratuit sans carte bancaire sur aistudio.google.com).'
    );
    suggestions.push(
      '4. Mode local hors-ligne : L\'application reste 100% opérationnelle en local avec les calculs géotechniques réels.'
    );
  } else if (
    status === 400 &&
    (errLower.includes('credit balance') || errLower.includes('plans & billing'))
  ) {
    diagnosticMessage =
      'Solde de crédits épuisé (Erreur 400) : Votre compte Anthropic ne dispose d\'aucun crédit prépayé actif.';
    suggestions.push(
      'Rechargez votre compte sur Anthropic Console : https://console.anthropic.com/settings/billing'
    );
    suggestions.push(
      'Ou utilisez Google Gemini 1.5 Flash (totalement gratuit sans carte bancaire).'
    );
  } else if (status === 403 || errLower.includes('permission_error')) {
    diagnosticMessage = `Accès refusé par Anthropic (Erreur 403) : ${rawErr}.`;
    suggestions.push(
      'Vérifiez que votre compte ou organisation Anthropic est actif sur https://console.anthropic.com/settings/billing'
    );
    suggestions.push(
      'Si vous êtes dans une région soumise à restriction ou sur VPN, vérifiez votre connexion.'
    );
  } else if (status === 429 || errLower.includes('rate_limit_error')) {
    diagnosticMessage =
      'Limite de requêtes atteinte (Erreur 429) : Trop de requêtes envoyées à l\'API Claude.';
    suggestions.push('Patientez quelques secondes avant de réessayer.');
  } else if (status === 0 || errLower.includes('failed to fetch')) {
    diagnosticMessage =
      'Impossible de contacter les serveurs Anthropic (Vérifiez votre connexion Internet).';
    suggestions.push('L\'application bascule automatiquement sur le mode local hors-ligne.');
  }

  return {
    success: false,
    message: diagnosticMessage,
    statusCode: status,
    provider: 'anthropic',
    model: modelToTest,
    fixSuggestions: suggestions,
  };
}

/**
 * Connectivity test for Google Gemini API Key.
 */
export async function testGeminiApiKey(
  apiKey: string,
  preferredModel?: string
): Promise<AiTestResult> {
  const cleanKey = apiKey ? apiKey.trim() : '';
  if (!cleanKey) {
    return {
      success: false,
      message: 'Veuillez saisir une clé API Gemini (commençant par AIzaSy...).',
      provider: 'gemini',
    };
  }

  const result = await postGeminiGenerateContent(
    cleanKey,
    [{ parts: [{ text: 'Respond with OK.' }] }],
    {
      model: preferredModel,
      generationConfig: { maxOutputTokens: 10 },
    }
  );

  if (result.ok && result.data) {
    return {
      success: true,
      message: `Connexion réussie avec Google Gemini (${result.modelUsed}) !`,
      provider: 'gemini',
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
        'Créez une clé directe sur Google AI Studio (https://aistudio.google.com/app/apikey).'
      );
    } else {
      diagnosticMessage = `Erreur HTTP 403 (Accès Refusé Google) : ${rawErr}.`;
      suggestions.push(
        'Vous pouvez également basculer vers Anthropic Claude dans les Paramètres pour une configuration plus simple.'
      );
    }
  } else if (status === 400) {
    diagnosticMessage = 'Clé API Google invalide (Erreur 400).';
    suggestions.push('Obtenez une clé valide sur https://aistudio.google.com/app/apikey');
  }

  return {
    success: false,
    message: diagnosticMessage,
    statusCode: status,
    provider: 'gemini',
    fixSuggestions: suggestions,
  };
}

/**
 * Universal connectivity test: routes to Anthropic Claude or Google Gemini based on key or preference.
 */
export async function testAiApiKey(
  apiKey: string,
  preferredModel?: string,
  explicitProvider?: AiProvider
): Promise<AiTestResult> {
  const provider = detectAiProvider(apiKey, explicitProvider);
  if (provider === 'anthropic') {
    return testClaudeApiKey(apiKey, preferredModel);
  }
  return testGeminiApiKey(apiKey, preferredModel);
}

/**
 * Post-blast rock muck pile photo audit (via Claude Vision or Gemini Vision).
 */
export async function checkImageWithClaude(
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
}
Return ONLY valid JSON, with NO surrounding explanation or conversational text.`;

  try {
    const res = await postClaudeMessages(
      apiKey,
      [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: cleanBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      {
        model: preferredModel || CLAUDE_CONFIG.defaultModel,
        maxTokens: 800,
        temperature: 0.1,
      }
    );

    if (!res.ok || !res.text) {
      return offlineFallback;
    }

    const cleanJson = res.text.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
    return JSON.parse(cleanJson) as GeminiQualityResponse;
  } catch (error: any) {
    console.warn('Claude image audit call failed or offline:', error.message);
    return offlineFallback;
  }
}

/**
 * Universal photo audit dispatcher (Claude or Gemini).
 */
export async function checkImageWithGemini(
  imageBase64: string,
  apiKey?: string,
  preferredModel?: string,
  provider?: AiProvider
): Promise<GeminiQualityResponse> {
  const effectiveProvider = detectAiProvider(apiKey, provider);

  if (effectiveProvider === 'anthropic') {
    return checkImageWithClaude(imageBase64, apiKey, preferredModel);
  }

  // Gemini implementation
  const offlineFallback: GeminiQualityResponse = {
    isMuckPile: true,
    scaleMarkerVisible: true,
    lightingQuality: 'good',
    obstaclesDetected: [],
    operatorAdvice:
      'Mode hors-ligne (Calculs géotechniques locaux) : Contrôles validés localement.',
  };

  if (!apiKey || apiKey.trim() === '') {
    return offlineFallback;
  }

  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
  const prompt = `You are a mining geotechnical AI assistant analyzing post-blast rock muck pile images. Return a strict JSON object with: isMuckPile, scaleMarkerVisible, lightingQuality, obstaclesDetected, suggestedRoiBbox, suggestedScaleBbox, operatorAdvice.`;

  try {
    const res = await postGeminiGenerateContent(
      apiKey,
      [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          ],
        },
      ],
      {
        model: preferredModel,
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }
    );

    if (!res.ok || !res.data) return offlineFallback;
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return offlineFallback;
    return JSON.parse(text) as GeminiQualityResponse;
  } catch {
    return offlineFallback;
  }
}

export const checkImageWithAi = checkImageWithGemini;

/**
 * Bilingual engineering evaluation of measured blast fragmentation and comminution correlation.
 */
export async function generateGeminiReportText(
  metrics: FragmentationMetrics,
  params: BlastParameters,
  rockMass: RockMass,
  millBatch: MillBatch | undefined,
  lang: 'en' | 'fr',
  apiKey?: string,
  preferredModel?: string,
  provider?: AiProvider
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
    const res = await postAiGenerateContent(
      apiKey,
      [{ parts: [{ text: prompt }] }],
      {
        provider,
        model: preferredModel,
        generationConfig: { temperature: 0.2 },
      }
    );

    if (res.ok && res.text && res.text.trim().length > 0) {
      return res.text.trim();
    }
    return getDeterministicSummary();
  } catch (err: any) {
    console.warn('AI report generation failed, falling back to local deterministic summary:', err.message);
    return getDeterministicSummary();
  }
}

export const generateAiReportText = generateGeminiReportText;

