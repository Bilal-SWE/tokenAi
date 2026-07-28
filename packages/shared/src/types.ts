// ───────────────────────────────────────────────────────────
// Credit bundle definitions
// Wallet currency is "credits" ($1 USD = 1,000,000 credits at exact OpenRouter cost).
// ───────────────────────────────────────────────────────────
export const TOKEN_BUNDLES = [
  { id: 'starter',  label: 'Starter',  usd: 5,  tokens: 5_000_000,   popular: false },
  { id: 'standard', label: 'Standard', usd: 10, tokens: 10_000_000,  popular: true  },
  { id: 'pro',      label: 'Pro',      usd: 20, tokens: 20_000_000,  popular: false },
  { id: 'business', label: 'Business', usd: 50, tokens: 50_000_000,  popular: false },
] as const;

export type BundleId = typeof TOKEN_BUNDLES[number]['id'];

export type ChatMode = 'chat' | 'generate' | 'presentation' | 'compare' | 'voice';

export type ModelTier = 'free' | 'standard' | 'premium' | 'ultra';

// ───────────────────────────────────────────────────────────
// Model definitions
//
// multiplier  = credits charged per 1 AI token (Exact OpenRouter Cost, 0% Profit Margin).
//               Free models = 0 (limited by FREE_DAILY_MESSAGE_LIMIT).
// ───────────────────────────────────────────────────────────
export const AI_MODELS = [

  // ─── Free (no credits, limited by daily message cap) ───────────────────
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    label: 'Nemotron Ultra',
    provider: 'NVIDIA',
    tier: 'free',
    category: 'free',
    multiplier: 0,
    costPer1MTokens: 0,
    supportsVision: false,
    supportsTools: false,
    badge: 'Free',
  },
  {
    id: 'poolside/laguna-m.1:free',
    label: 'Laguna M.1',
    provider: 'Poolside',
    tier: 'free',
    category: 'free',
    multiplier: 0,
    costPer1MTokens: 0,
    supportsVision: false,
    supportsTools: false,
    badge: 'Free',
  },

  // ─── Google Gemini ─────────────────────────────────────────────────────
  {
    id: 'google/gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    provider: 'Google',
    tier: 'standard',
    category: 'cheap',
    multiplier: 0.25,
    costPer1MTokens: 0.25,
    supportsVision: true,
    supportsTools: true,
    badge: 'Cheapest',
  },
  {
    id: 'google/gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    provider: 'Google',
    tier: 'standard',
    category: 'fast',
    multiplier: 5.25,
    costPer1MTokens: 5.25,
    supportsVision: true,
    supportsTools: true,
    badge: 'Fast',
  },
  {
    id: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'Google',
    tier: 'premium',
    category: 'best',
    multiplier: 5.63,
    costPer1MTokens: 5.63,
    supportsVision: true,
    supportsTools: true,
    badge: 'Best',
  },

  // ─── OpenAI GPT ────────────────────────────────────────────────────────
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o Mini',
    provider: 'OpenAI',
    tier: 'standard',
    category: 'cheap',
    multiplier: 0.38,
    costPer1MTokens: 0.38,
    supportsVision: true,
    supportsTools: true,
    badge: 'Cheapest',
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    provider: 'OpenAI',
    tier: 'premium',
    category: 'fast',
    multiplier: 6.25,
    costPer1MTokens: 6.25,
    supportsVision: true,
    supportsTools: true,
    badge: 'Fast',
  },
  {
    id: 'openai/gpt-5.5',
    label: 'GPT-5.5',
    provider: 'OpenAI',
    tier: 'ultra',
    category: 'best',
    multiplier: 17.50,
    costPer1MTokens: 17.50,
    supportsVision: true,
    supportsTools: true,
    badge: 'Best',
  },

  // ─── Anthropic Claude ──────────────────────────────────────────────────
  {
    id: 'anthropic/claude-haiku-4.5',
    label: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    tier: 'standard',
    category: 'cheap',
    multiplier: 3.00,
    costPer1MTokens: 3.00,
    supportsVision: true,
    supportsTools: true,
    badge: 'Cheapest',
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    label: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    tier: 'premium',
    category: 'fast',
    multiplier: 9.00,
    costPer1MTokens: 9.00,
    supportsVision: true,
    supportsTools: true,
    badge: 'Fast',
  },
  {
    id: 'anthropic/claude-opus-4.8',
    label: 'Claude Opus 4.8',
    provider: 'Anthropic',
    tier: 'ultra',
    category: 'best',
    multiplier: 15.00,
    costPer1MTokens: 15.00,
    supportsVision: true,
    supportsTools: true,
    badge: 'Best',
  },

  // ─── Qwen3 ─────────────────────────────────────────────────────────────
  {
    id: 'qwen/qwen-3-chat-72b',
    label: 'Qwen 3 Chat 72B',
    provider: 'Qwen3',
    tier: 'standard',
    category: 'fast',
    multiplier: 1.5,
    costPer1MTokens: 1.5,
    supportsVision: false,
    supportsTools: true,
    badge: 'Fast',
  },
  {
    id: 'qwen/qwen-3-coder-32b',
    label: 'Qwen 3 Coder 32B',
    provider: 'Qwen3',
    tier: 'standard',
    category: 'cheap',
    multiplier: 1.0,
    costPer1MTokens: 1.0,
    supportsVision: false,
    supportsTools: true,
    badge: 'Cheapest',
  },
  {
    id: 'qwen/qwen-3-math-72b',
    label: 'Qwen 3 Math 72B',
    provider: 'Qwen3',
    tier: 'premium',
    category: 'best',
    multiplier: 2.0,
    costPer1MTokens: 2.0,
    supportsVision: false,
    supportsTools: true,
    badge: 'Best',
  },

  // ─── DeepSeek ──────────────────────────────────────────────────────────
  {
    id: 'deepseek/deepseek-chat',
    label: 'DeepSeek Chat (V3)',
    provider: 'DeepSeek',
    tier: 'standard',
    category: 'cheap',
    multiplier: 1.2,
    costPer1MTokens: 1.2,
    supportsVision: false,
    supportsTools: true,
    badge: 'Cheapest',
  },
  {
    id: 'deepseek/deepseek-coder',
    label: 'DeepSeek Coder (V3)',
    provider: 'DeepSeek',
    tier: 'standard',
    category: 'fast',
    multiplier: 1.2,
    costPer1MTokens: 1.2,
    supportsVision: false,
    supportsTools: true,
    badge: 'Fast',
  },
  {
    id: 'deepseek/deepseek-r1',
    label: 'DeepSeek R1 (Reasoning)',
    provider: 'DeepSeek',
    tier: 'premium',
    category: 'best',
    multiplier: 3.5,
    costPer1MTokens: 3.5,
    supportsVision: false,
    supportsTools: true,
    badge: 'Best',
  },
] as const;

export type ModelCategory = 'free' | 'cheap' | 'fast' | 'medium' | 'best';

export type ModelId = typeof AI_MODELS[number]['id'];

// ───────────────────────────────────────────────────────────
// Image generation
// ───────────────────────────────────────────────────────────
export const IMAGE_GENERATION_CREDITS = 120_000; // kept for backward compat

export type ImageApiType = 'chat-completion' | 'image-generation';

export const IMAGE_MODELS = [
  // Google
  {
    id: 'google/gemini-3.1-flash-image-lite',
    label: 'Gemini Image Lite',
    provider: 'Google',
    credits: 25_000,
    quality: 'Super Fast & Low Cost',
    apiType: 'chat-completion' as ImageApiType,
  },
  {
    id: 'google/gemini-3.1-flash-image',
    label: 'Gemini Flash Image',
    provider: 'Google',
    credits: 120_000,
    quality: 'Fast & High Quality',
    apiType: 'chat-completion' as ImageApiType,
  },
  {
    id: 'google/gemini-3.1-pro-image',
    label: 'Gemini Pro Image',
    provider: 'Google',
    credits: 250_000,
    quality: 'High Detail & Creative',
    apiType: 'chat-completion' as ImageApiType,
  },
  // Black Forest Labs
  {
    id: 'black-forest-labs/flux-1.1-schnell',
    label: 'FLUX 1.1 Schnell',
    provider: 'Black Forest Labs',
    credits: 15_000,
    quality: 'Instant Generation',
    apiType: 'image-generation' as ImageApiType,
  },
  {
    id: 'black-forest-labs/flux-1.1-dev',
    label: 'FLUX 1.1 Dev',
    provider: 'Black Forest Labs',
    credits: 70_000,
    quality: 'Excellent Prompt Adherence',
    apiType: 'image-generation' as ImageApiType,
  },
  {
    id: 'black-forest-labs/flux-1.1-pro',
    label: 'FLUX 1.1 Pro',
    provider: 'Black Forest Labs',
    credits: 160_000,
    quality: 'Photorealistic',
    apiType: 'image-generation' as ImageApiType,
  },
  // OpenAI
  {
    id: 'openai/dall-e-2',
    label: 'DALL-E 2',
    provider: 'OpenAI',
    credits: 30_000,
    quality: 'Stylized Art & Fast',
    apiType: 'image-generation' as ImageApiType,
  },
  {
    id: 'openai/dall-e-3',
    label: 'DALL-E 3',
    provider: 'OpenAI',
    credits: 200_000,
    quality: 'Creative & Detailed',
    apiType: 'image-generation' as ImageApiType,
  },
  {
    id: 'openai/dall-e-3-hd',
    label: 'DALL-E 3 HD',
    provider: 'OpenAI',
    credits: 320_000,
    quality: 'Super HD Detail',
    apiType: 'image-generation' as ImageApiType,
  },
] as const;

export type ImageModelId = typeof IMAGE_MODELS[number]['id'];

// ───────────────────────────────────────────────────────────
// Voice generation models
// ───────────────────────────────────────────────────────────
export const VOICE_MODELS = [
  // OpenAI
  {
    id: 'openai/tts-1',
    label: 'OpenAI TTS-1',
    provider: 'OpenAI',
    credits: 50_000,
    quality: 'High Speed',
  },
  {
    id: 'openai/tts-1-hd',
    label: 'OpenAI TTS-1 HD',
    provider: 'OpenAI',
    credits: 100_000,
    quality: 'High Definition',
  },
  // ElevenLabs
  {
    id: 'elevenlabs/multilingual-v2',
    label: 'ElevenLabs Multilingual v2',
    provider: 'ElevenLabs',
    credits: 150_000,
    quality: 'Most Realistic & Natural',
  },
  // Grok
  {
    id: 'grok/tts-1-lite',
    label: 'Grok Voice 1 Lite',
    provider: 'Grok',
    credits: 20_000,
    quality: 'Expressive & Fast',
  },
  {
    id: 'grok/tts-1',
    label: 'Grok Voice 1',
    provider: 'Grok',
    credits: 90_000,
    quality: 'High Performance',
  },
  {
    id: 'grok/tts-1-hd',
    label: 'Grok Voice 1 HD',
    provider: 'Grok',
    credits: 160_000,
    quality: 'High Definition',
  },
] as const;

export type VoiceModelId = typeof VOICE_MODELS[number]['id'];

// ───────────────────────────────────────────────────────────
// Free-tier abuse control
// ───────────────────────────────────────────────────────────
export const FREE_DAILY_MESSAGE_LIMIT = 50;

// ───────────────────────────────────────────────────────────
// API request/response shapes
// ───────────────────────────────────────────────────────────
export interface SendMessageRequest {
  conversationId: string | null;
  content: string;
  model: ModelId;
  imageUrl?: string;
  fileText?: string;
  fileData?: string;
  fileName?: string;
  systemPrompt?: string;
  contextMessages?: { role: string; content: string }[];
  /** Compare mode: stream the AI response but skip saving to DB */
  skipPersist?: boolean;
  /** Enable OpenRouter web search plugin for this request */
  webSearch?: boolean;
}

export interface SendMessageResponse {
  conversationId: string;
  messageId: string;
  tokensUsed: number;
  newBalance: number;
}

export interface WalletInfo {
  balance: number;
  formattedBalance: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  model: ModelId;
  createdAt: string;
  updatedAt: string;
}

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────
export type AIModel = typeof AI_MODELS[number];

export function getModel(id: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export function isFreeModel(id: string): boolean {
  return Number(getModel(id)?.multiplier ?? 1) === 0;
}

/** Credits charged for a given number of raw AI tokens on a model. */
export function creditsForTokens(modelId: string, tokens: number): number {
  const m = getModel(modelId);
  return Math.ceil(tokens * (m?.multiplier ?? 1));
}

export const TIER_LABELS: Record<ModelTier, string> = {
  free: 'Free',
  standard: 'Standard',
  premium: 'Premium',
  ultra: 'Ultra',
};

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export function formatUSD(credits: number): string {
  if (credits === 0) return '$0.00';
  const usd = credits / 1_000_000;
  if (usd < 0.0001) {
    return `$${usd.toFixed(6)}`;
  }
  if (usd < 0.001) {
    return `$${usd.toFixed(5)}`;
  }
  if (usd < 0.1) {
    return `$${usd.toFixed(4)}`;
  }
  return `$${usd.toFixed(2)}`;
}

