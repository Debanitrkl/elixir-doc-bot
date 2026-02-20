/**
 * Bhashini API client for ASR (speech-to-text), NMT (translation), and TTS (text-to-speech).
 *
 * Bhashini is the Government of India's AI translation platform supporting 22 Indian languages.
 * API docs: https://bhashini.gov.in/ulca
 *
 * Flow:
 * 1. Get pipeline config (cached) - identifies which model to use for each task
 * 2. Call the compute endpoint with the model + input
 */

const MEITY_API_BASE = "https://meity-auth.ulcacontrib.org";
const DHRUVA_API_BASE = "https://dhruva-api.bhashini.gov.in";

interface PipelineConfig {
  pipelineId: string;
  endpoint: string;
  asrModel?: string;
  nmtModel?: string;
  ttsModel?: string;
  cachedAt: number;
}

// Cache pipeline configs for 1 hour
const pipelineCache = new Map<string, PipelineConfig>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function getCredentials() {
  const userId = process.env.BHASHINI_USER_ID;
  const apiKey = process.env.BHASHINI_API_KEY;
  if (!userId || !apiKey) throw new Error("Bhashini credentials not set");
  return { userId, apiKey };
}

/**
 * Get or refresh a pipeline config for a given task and language pair.
 */
async function getPipelineConfig(
  taskType: "asr" | "translation" | "tts",
  sourceLanguage: string,
  targetLanguage?: string
): Promise<{ endpoint: string; modelId: string }> {
  const cacheKey = `${taskType}:${sourceLanguage}:${targetLanguage || ""}`;
  const cached = pipelineCache.get(cacheKey);

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    const modelId =
      taskType === "asr" ? cached.asrModel! :
      taskType === "translation" ? cached.nmtModel! :
      cached.ttsModel!;
    return { endpoint: cached.endpoint, modelId };
  }

  const { userId, apiKey } = getCredentials();

  const pipelineTasks: Array<Record<string, unknown>> = [];

  if (taskType === "asr") {
    pipelineTasks.push({
      taskType: "asr",
      config: { language: { sourceLanguage } },
    });
  } else if (taskType === "translation") {
    pipelineTasks.push({
      taskType: "translation",
      config: { language: { sourceLanguage, targetLanguage } },
    });
  } else if (taskType === "tts") {
    pipelineTasks.push({
      taskType: "tts",
      config: { language: { sourceLanguage } },
    });
  }

  const res = await fetch(
    `${MEITY_API_BASE}/ulca/apis/v0/model/getModelsPipeline`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ulcaApiKey: apiKey,
        userID: userId,
      },
      body: JSON.stringify({ pipelineTasks, pipelineRequestConfig: { pipelineId: "64392f96daac500b55c543cd" } }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bhashini pipeline config failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const pipelineResponse = data.pipelineResponseConfig?.[0];
  const inferenceEndpoint = data.pipelineInferenceAPIEndPoint;

  if (!pipelineResponse || !inferenceEndpoint) {
    throw new Error("Invalid Bhashini pipeline response");
  }

  const endpoint = inferenceEndpoint.callbackUrl;
  const modelConfig = pipelineResponse.config?.[0];
  const modelId = modelConfig?.modelId || modelConfig?.serviceId;

  const config: PipelineConfig = {
    pipelineId: "64392f96daac500b55c543cd",
    endpoint,
    cachedAt: Date.now(),
  };

  if (taskType === "asr") config.asrModel = modelId;
  else if (taskType === "translation") config.nmtModel = modelId;
  else config.ttsModel = modelId;

  pipelineCache.set(cacheKey, config);

  return { endpoint, modelId };
}

/**
 * Speech-to-Text (ASR): Convert audio to text in the source language.
 */
export async function speechToText(
  audioBase64: string,
  sourceLanguage: string
): Promise<{ text: string }> {
  const { endpoint, modelId } = await getPipelineConfig("asr", sourceLanguage);
  const { apiKey } = getCredentials();

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({
      pipelineTasks: [
        {
          taskType: "asr",
          config: {
            language: { sourceLanguage },
            serviceId: modelId,
            audioFormat: "wav",
            samplingRate: 16000,
          },
        },
      ],
      inputData: {
        audio: [{ audioContent: audioBase64 }],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bhashini ASR failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.pipelineResponse?.[0]?.output?.[0]?.source;

  if (!text) {
    throw new Error("Bhashini ASR returned empty result");
  }

  return { text };
}

/**
 * Translate text between languages (NMT).
 */
export async function translate(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<{ translatedText: string }> {
  if (sourceLanguage === targetLanguage) {
    return { translatedText: text };
  }

  const { endpoint, modelId } = await getPipelineConfig(
    "translation",
    sourceLanguage,
    targetLanguage
  );
  const { apiKey } = getCredentials();

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({
      pipelineTasks: [
        {
          taskType: "translation",
          config: {
            language: { sourceLanguage, targetLanguage },
            serviceId: modelId,
          },
        },
      ],
      inputData: {
        input: [{ source: text }],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bhashini translation failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const translatedText = data.pipelineResponse?.[0]?.output?.[0]?.target;

  if (!translatedText) {
    throw new Error("Bhashini translation returned empty result");
  }

  return { translatedText };
}

/**
 * Text-to-Speech (TTS): Convert text to audio in the given language.
 * Returns base64-encoded audio.
 */
export async function textToSpeech(
  text: string,
  sourceLanguage: string,
  gender: "male" | "female" = "female"
): Promise<{ audioBase64: string }> {
  const { endpoint, modelId } = await getPipelineConfig("tts", sourceLanguage);
  const { apiKey } = getCredentials();

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({
      pipelineTasks: [
        {
          taskType: "tts",
          config: {
            language: { sourceLanguage },
            serviceId: modelId,
            gender,
          },
        },
      ],
      inputData: {
        input: [{ source: text }],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bhashini TTS failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const audioBase64 = data.pipelineResponse?.[0]?.audio?.[0]?.audioContent;

  if (!audioBase64) {
    throw new Error("Bhashini TTS returned empty result");
  }

  return { audioBase64 };
}

/**
 * Full pipeline: ASR + NMT (source language audio -> English text).
 */
export async function voiceToEnglish(
  audioBase64: string,
  sourceLanguage: string
): Promise<{ originalText: string; englishText: string }> {
  // Step 1: Speech to text in source language
  const { text: originalText } = await speechToText(audioBase64, sourceLanguage);

  // Step 2: Translate to English
  if (sourceLanguage === "en") {
    return { originalText, englishText: originalText };
  }

  const { translatedText: englishText } = await translate(
    originalText,
    sourceLanguage,
    "en"
  );

  return { originalText, englishText };
}

/**
 * Full pipeline: NMT + TTS (English text -> target language audio).
 */
export async function englishToVoice(
  englishText: string,
  targetLanguage: string
): Promise<{ translatedText: string; audioBase64: string | null }> {
  // Step 1: Translate English to target language
  let translatedText = englishText;
  if (targetLanguage !== "en") {
    const result = await translate(englishText, "en", targetLanguage);
    translatedText = result.translatedText;
  }

  // Step 2: Generate TTS audio
  let audioBase64: string | null = null;
  try {
    const ttsResult = await textToSpeech(translatedText, targetLanguage);
    audioBase64 = ttsResult.audioBase64;
  } catch (error) {
    // TTS may not be available for all languages; fall back to text-only
    console.warn(`TTS failed for ${targetLanguage}:`, error);
  }

  return { translatedText, audioBase64 };
}
