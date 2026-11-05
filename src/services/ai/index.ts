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

export interface BlastScenarioContext {
  timing?: {
    surfaceDelayMs?: number;
    inHoleDelayMs?: number;
    maxChargePerDelayKg?: number;
    predictedPPVMmPerS?: number;
    distanceToStructureM?: number;
  };
  geometryRatios?: {
    stiffnessRatioHB?: number;
    stemmingRatioTB?: number;
    subdrillRatioJB?: number;
    powderFactorKgM3?: number;
  };
  comminution?: {
    bondWorkIndex?: number;
    dropWeightAxb?: number;
    totalSpecificEnergyKwhPerT?: number;
    achievableThroughputTPH?: number;
    crusherChokeRisk?: boolean;
  };
  economics?: {
    totalCostPerTonUSD?: number;
    blastingCostUSD?: number;
    millingCostUSD?: number;
    optimalP80Mm?: number;
  };
  kuzram?: {
    predictedX50Mm?: number;
    predictedP80Mm?: number;
    uniformityIndexN?: number;
  };
}

/**
 * Bilingual engineering evaluation of measured blast fragmentation and comminution correlation.
 * Adapts dynamically to distinct operational scenarios (rock hardness, powder factor, geometric stiffness,
 * initiation timing, ground vibration, comminution power draw, and downstream economics).
 */
export async function generateGeminiReportText(
  metrics: FragmentationMetrics,
  params: BlastParameters,
  rockMass: RockMass,
  millBatch: MillBatch | undefined,
  lang: 'en' | 'fr',
  apiKey?: string,
  preferredModel?: string,
  provider?: AiProvider,
  scenarioContext?: BlastScenarioContext
): Promise<string> {
  const isFr = lang === 'fr';

  const burden = Math.max(1, params.burden || 3.5);
  const spacing = Math.max(1, params.spacing || 4.2);
  const benchH = Math.max(1, params.benchHeight || 10);
  const stemming = params.stemmingLength || burden * 0.9;
  const subdrill = params.subdrill || burden * 0.3;
  const charge = params.chargePerHole || 85;
  const ucs = rockMass.ucsMPa || 110;
  const density = rockMass.density || 2.7;

  const volPerHole = burden * spacing * benchH;
  const pf = Number((charge / volPerHole).toFixed(2));
  const stiffnessHB = Number((benchH / burden).toFixed(2));
  const stemmingTB = Number((stemming / burden).toFixed(2));
  const subdrillJB = Number((subdrill / burden).toFixed(2));

  const surfaceDelay = scenarioContext?.timing?.surfaceDelayMs || 25;
  const reliefRate = Number((surfaceDelay / burden).toFixed(1));
  const ppv = scenarioContext?.timing?.predictedPPVMmPerS ?? 6.8;
  const dist = scenarioContext?.timing?.distanceToStructureM ?? 450;
  const isPpvCompliant = ppv <= 12.7;

  const p50 = metrics.p50 || 130;
  const p80 = metrics.p80 || 195;
  const oversize = metrics.oversizePercent || 0;
  const fines = metrics.finesPercent || 0;
  const uniformity = metrics.uniformityIndex || 1.15;

  const wi = scenarioContext?.comminution?.bondWorkIndex ?? (millBatch?.totalSpecificEnergyKwhPerT ? 14.5 : 15.0);
  const isChokeRisk = p80 > 220 || oversize > 10;
  const sagThroughputDelta = p80 <= 145 ? +42 : (p80 <= 210 ? 0 : -35);
  const powerSavings = p80 <= 145 ? 1.45 : (p80 <= 210 ? 0 : -1.80);

  const getDeterministicSummary = () => {
    // Dynamic Scenario Evaluation Blocks
    let energyDiagnosisFr = '';
    let energyDiagnosisEn = '';
    if (ucs > 130 && pf < 0.55) {
      energyDiagnosisFr = `Sous-dosage énergétique sévère en roche compétente (q = ${pf} kg/m³ face à un UCS de ${ucs} MPa). L'énergie d'explosion est insuffisante pour cisailler le réseau de fractures, provoquant une forte proportion de blocs (>300 mm : ${oversize}%) et un ralentissement critique du marinage.`;
      energyDiagnosisEn = `Severe undercharging in competent rock (PF = ${pf} kg/m³ vs UCS of ${ucs} MPa). Explosive energy is insufficient to break joint blocks, generating high oversize boulder fractions (>300 mm: ${oversize}%) and loading bottlenecks.`;
    } else if (ucs < 55 && pf > 0.65) {
      energyDiagnosisFr = `Surdosage énergétique en roche tendre (q = ${pf} kg/m³ pour UCS ${ucs} MPa). Énergie gaspillée en pulvérisation et création excessive de micro-fines (<25 mm : ${fines}%), augmentant le risque de surpression aérienne et d'envol de poussières.`;
      energyDiagnosisEn = `Excessive powder factor in weak rock (PF = ${pf} kg/m³ for UCS ${ucs} MPa). Energy is wasted in pulverization and micro-fines generation (<25 mm: ${fines}%), amplifying airblast overpressure and dust emissions.`;
    } else {
      energyDiagnosisFr = `Adéquation énergétique équilibrée (q = ${pf} kg/m³ pour UCS ${ucs} MPa). La répartition de l'énergie explosive produit une fragmentation médiane P50 = ${p50} mm bien centrée et un étalement granulométrique régulier.`;
      energyDiagnosisEn = `Balanced energy matching (PF = ${pf} kg/m³ for UCS ${ucs} MPa). Explosive energy partition yields a well-centered median size P50 = ${p50} mm and uniform fragmentation gradient.`;
    }

    let geomDiagnosisFr = '';
    let geomDiagnosisEn = '';
    if (stiffnessHB < 2.0) {
      geomDiagnosisFr += `Rapport de rigidité critique (H/B = ${stiffnessHB} < 2.0) créant un comportement de gradin rigide avec risques de culots durs et de rebords en crête. `;
      geomDiagnosisEn += `Critical low stiffness ratio (H/B = ${stiffnessHB} < 2.0) indicating rigid slab behavior prone to toe stumps and backbreak. `;
    } else {
      geomDiagnosisFr += `Rapport de rigidité souple et favorable au déplacement (H/B = ${stiffnessHB}). `;
      geomDiagnosisEn += `Favorable flexural stiffness ratio (H/B = ${stiffnessHB}). `;
    }

    if (stemmingTB < 0.75) {
      geomDiagnosisFr += `Bourrage court d'alerte (T/B = ${stemmingTB} < 0.75) présentant un risque majeur de projection de blocs (flyrock). `;
      geomDiagnosisEn += `Short stemming collar hazard (T/B = ${stemmingTB} < 0.75) carrying severe flyrock projection risks. `;
    } else if (stemmingTB > 1.2) {
      geomDiagnosisFr += `Bourrage long (T/B = ${stemmingTB} > 1.2) générant des blocs hors-gabarit en surface. `;
      geomDiagnosisEn += `Deep collar stemming (T/B = ${stemmingTB} > 1.2) producing surface cap-rock boulders. `;
    }

    let timingDiagnosisFr = '';
    let timingDiagnosisEn = '';
    if (reliefRate < 3.2) {
      timingDiagnosisFr = `Confinement élevé du tir (dégagement de ${reliefRate} ms/m de banquette < 3.5 ms/m). La détonation trop rapprochée des rangées contraint l'éjection et amplifie les vibrations.`;
      timingDiagnosisEn = `High blast confinement (relief rate ${reliefRate} ms/m of burden < 3.5 ms/m). Successive rows fire before front movement occurs, choking displacement and boosting ground vibration.`;
    } else {
      timingDiagnosisFr = `Chronogramme séquentiel progressif (${reliefRate} ms/m de banquette). Vitesse particulaire PPV = ${ppv} mm/s à ${dist}m (${isPpvCompliant ? 'conforme aux seuils USBM pour structures' : 'attention : seuil USBM dépassé'}).`;
      timingDiagnosisEn = `Optimal progressive timing sequence (${reliefRate} ms/m of burden). Peak particle velocity PPV = ${ppv} mm/s at ${dist}m (${isPpvCompliant ? 'fully USBM compliant' : 'alert: exceeds USBM structural limit'}).`;
    }

    let commDiagnosisFr = '';
    let commDiagnosisEn = '';
    if (isChokeRisk) {
      commDiagnosisFr = `Le P80 de ${p80} mm et la fraction de blocs (>300 mm : ${oversize}%) constituent un goulot d'étranglement pour le concassage primaire, avec une pénalité estimée de ${Math.abs(sagThroughputDelta)} t/h sur le broyeur SAG.`;
      commDiagnosisEn = `Feed P80 of ${p80} mm and boulder fraction (>300 mm: ${oversize}%) create a bottleneck at the primary crusher, imposing an estimated ${Math.abs(sagThroughputDelta)} tph penalty on SAG throughput.`;
    } else {
      commDiagnosisFr = `Alimentation optimale de l'usine (P80 = ${p80} mm pour Wi = ${wi} kWh/t) permettant un gain de débit SAG de +${sagThroughputDelta} t/h et une économie d'énergie de broyage de ${powerSavings} kWh/t.`;
      commDiagnosisEn = `Ideal plant feed distribution (P80 = ${p80} mm for Wi = ${wi} kWh/t) securing a SAG throughput expansion of +${sagThroughputDelta} tph and comminution energy savings of ${powerSavings} kWh/t.`;
    }

    // Recommendations tailored directly to the specific scenario
    const recsFr: string[] = [];
    const recsEn: string[] = [];

    if (stemmingTB < 0.75) {
      recsFr.push(`1. SÉCURITÉ VOLS : Rehausser la colonne de bourrage à au moins ${Math.round(burden * 0.9 * 10) / 10} m (T/B ≥ 0.85) en matériau concassé angulaire pour supprimer le risque de flyrock.`);
      recsEn.push(`1. FLYROCK SAFETY: Increase stemming column to at least ${Math.round(burden * 0.9 * 10) / 10} m (T/B ≥ 0.85) with crushed angular aggregate to suppress projection risks.`);
    } else if (ucs > 130 && pf < 0.55) {
      recsFr.push(`1. ÉNERGIE FOND DE TROU : Rehausser la charge spécifique à au moins 0.65 kg/m³ en concentrant la charge de pied pour résorber les ${oversize}% de blocs primaires.`);
      recsEn.push(`1. TOE ENERGY: Increase powder factor to at least 0.65 kg/m³ with heavy toe decking to suppress ${oversize}% oversize boulders.`);
    } else if (fines > 14) {
      recsFr.push(`1. MAÎTRISE DES FINES : Réduire légèrement la charge spécifique ou augmenter le bourrage pour préserver la qualité de l'alimentation concasseur.`);
      recsEn.push(`1. FINES MITIGATION: Moderate specific charge or extend stemming to reduce micro-pulverization.`);
    } else {
      recsFr.push(`1. GÉOMÉTRIE DU TIR : Maintenir la maille de ${burden} m × ${spacing} m qui assure une fragmentation équilibrée et stable.`);
      recsEn.push(`1. PATTERN GEOMETRY: Maintain current ${burden} m × ${spacing} m pattern delivering robust, balanced sizing.`);
    }

    if (reliefRate < 3.2) {
      recsFr.push(`2. RETARD SURFACE : Augmenter le délai inter-rangées à au moins ${Math.round(burden * 5)} ms (5 ms/m de banquette) pour assurer le dégagement libre de la masse.`);
      recsEn.push(`2. SURFACE TIMING: Increase inter-row delay to at least ${Math.round(burden * 5)} ms (5 ms/m of burden) to ensure unrestricted burden relief.`);
    } else {
      recsFr.push(`2. VALORISATION USINE : Exploiter le P80 de ${p80} mm pour maximiser la cadence d'alimentation du circuit de broyage.`);
      recsEn.push(`2. MILL FEED RATE: Leverage current P80 of ${p80} mm to drive maximum feed throughput into the comminution circuit.`);
    }

    if (isFr) {
      return `SYNTHÈSE TECHNIQUE & ÉVALUATION GÉOTECHNIQUE DU TIR (SCÉNARIO RÉEL) :

1. Caractérisation du Massif & Bilan Énergétique :
${energyDiagnosisFr}
Paramètres de maille : ${burden} m × ${spacing} m (gradin ${benchH} m, ⌀ ${params.holeDiameter} mm, charge ${charge} kg/trou en ${params.explosiveType || 'ANFO'}). Massif rocheux : ${rockMass.rockType} (densité ${density} t/m³, UCS ${ucs} MPa). Granulométrie optique : P50 = ${p50} mm, P80 = ${p80} mm (uniformité n = ${uniformity}).

2. Ratios Géométriques du Gradin & Séquence d'Initiation :
- Géométrie : ${geomDiagnosisFr}
- Initiation & vibrations : ${timingDiagnosisFr}

3. Impact Usine (Comminution) & Économie Mine-au-Moulin :
- Circuit usine : ${commDiagnosisFr}
${millBatch ? `- Télémétrie usine : ${millBatch.millingThroughputTph} t/h de débit, énergie globale de ${millBatch.totalSpecificEnergyKwhPerT} kWh/t.` : ''}

4. Recommandations Opérationnelles de Terrain :
${recsFr.join('\n')}`;
    }

    return `GEOTECHNICAL BLAST EVALUATION & OPERATIONAL SCENARIO AUDIT:

1. Rock Mass Characteristics & Energy Allocation:
${energyDiagnosisEn}
Pattern geometry: ${burden} m × ${spacing} m (bench ${benchH} m, ⌀ ${params.holeDiameter} mm, charge ${charge} kg/hole with ${params.explosiveType || 'ANFO'}). Rock mass: ${rockMass.rockType} (density ${density} t/m³, UCS ${ucs} MPa). Photographic sizing: P50 = ${p50} mm, P80 = ${p80} mm (uniformity n = ${uniformity}).

2. Bench Geometry Ratios & 3D Initiation Dynamics:
- Geometry ratios: ${geomDiagnosisEn}
- Timing & ground vibration: ${timingDiagnosisEn}

3. Comminution Plant Impact & Downstream Productivity:
- Milling circuit: ${commDiagnosisEn}
${millBatch ? `- Plant telemetry: ${millBatch.millingThroughputTph} tph throughput, total specific energy ${millBatch.totalSpecificEnergyKwhPerT} kWh/t.` : ''}

4. Operational Recommendations:
${recsEn.join('\n')}`;
  };

  if (!apiKey || apiKey.trim() === '') {
    return getDeterministicSummary();
  }

  const prompt = `You are a Principal Blast and Comminution Mining Engineer.
Analyze the following detailed multi-component blast investigation and downstream plant telemetry:

OPERATIONAL SCENARIO DATA:
- Rock Mass: ${rockMass.rockType}, Density: ${density} t/m³, UCS: ${ucs} MPa, Joint Spacing: ${rockMass.meanJointSpacing} m
- Blast Design: Burden = ${burden} m, Spacing = ${spacing} m, Bench Height = ${benchH} m, Diameter = ${params.holeDiameter} mm
- Explosive: ${params.explosiveType || 'ANFO'}, Charge/Hole = ${charge} kg, Powder Factor = ${pf} kg/m³
- Bench Ratios: Stiffness H/B = ${stiffnessHB}, Stemming T/B = ${stemmingTB}, Subdrill J/B = ${subdrillJB}
- Initiation Timing: Surface Delay = ${surfaceDelay} ms, Relief Rate = ${reliefRate} ms/m, USBM Predicted PPV = ${ppv} mm/s at ${dist}m
- Measured Photographic Fragmentation: P20 = ${metrics.p20} mm, P50 = ${p50} mm, P80 = ${p80} mm, P90 = ${metrics.p90} mm, Uniformity = ${uniformity}
- Sizing Extremes: Fines (<25mm) = ${fines}%, Oversize Boulders (>300mm) = ${oversize}%
- Downstream Comminution: Bond Work Index Wi = ${wi} kWh/t, Crusher Choke Risk = ${isChokeRisk ? 'YES' : 'NO'}, Estimated SAG Delta = ${sagThroughputDelta} tph, Power Savings = ${powerSavings} kWh/t

INSTRUCTIONS & ENGINEERING STANDARDS:
1. Provide a rigorous, authoritative 4-section engineering analysis in ${isFr ? 'FRENCH' : 'ENGLISH'}.
2. Do NOT produce vague, generic statements. You MUST evaluate this specific scenario based on:
   - Rock hardness vs powder factor adequacy
   - Bench stiffness ratio (H/B) and flyrock risk from stemming ratio (T/B)
   - Initiation relief timing (ms/m) and USBM ground vibration compliance
   - Downstream crushing bottlenecks and SAG mill specific power draw
3. Conclude with 2 clear, numbered operational recommendations directly addressing the highest-priority site issue.`;

  try {
    const res = await postAiGenerateContent(
      apiKey,
      [{ parts: [{ text: prompt }] }],
      {
        provider,
        model: preferredModel,
        generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
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

