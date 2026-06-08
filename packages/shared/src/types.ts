// ───────────────────────────────────────────────────────────
// Credit bundle definitions
// Wallet currency is "credits". Bundles priced for a ~3x markup
// over real OpenRouter cost (see multipliers below).
// ───────────────────────────────────────────────────────────
export const TOKEN_BUNDLES = [
  { id: 'starter',  label: 'Starter',  usd: 5,  tokens: 7_000_000,   popular: false },
  { id: 'standard', label: 'Standard', usd: 10, tokens: 15_000_000,  popular: true  },
  { id: 'pro',      label: 'Pro',      usd: 20, tokens: 32_000_000,  popular: false },
  { id: 'business', label: 'Business', usd: 50, tokens: 85_000_000,  popular: false },
] as const;

export type BundleId = typeof TOKEN_BUNDLES[number]['id'];

export type ChatMode = 'chat' | 'generate' | 'presentation' | 'compare';

export type ModelTier = 'free' | 'standard' | 'premium' | 'ultra';

// ───────────────────────────────────────────────────────────
// Model definitions
//
// multiplier = credits charged per 1 AI token (normalized so the
//   cheapest paid model = 1x). Free models = 0 (no credits charged,
//   limited by FREE_DAILY_MESSAGE_LIMIT instead).
// costPer1MTokens = your real blended OpenRouter cost, for reference.
// ───────────────────────────────────────────────────────────
// 12 models: GPT / Claude / Gemini, each in 4 categories (Cheapest, Fast,
// Balanced, Best). All support images + PDFs. Multipliers are normalized so
// the cheapest model = 1×, mirroring real OpenRouter cost ratios.
export const AI_MODELS = [
  // ─── Free (no credits, daily message limit) ───
  {
    id: 'openai/gpt-oss-120b:free',
    label: 'GPT-OSS 120B',
    provider: 'OpenAI',
    tier: 'free',
    category: 'free',
    multiplier: 0,
    costPer1MTokens: 0,
    supportsVision: false,
    badge: 'Free',
  },
  {
    id: 'openai/gpt-oss-20b:free',
    label: 'GPT-OSS 20B',
    provider: 'OpenAI',
    tier: 'free',
    category: 'free',
    multiplier: 0,
    costPer1MTokens: 0,
    supportsVision: false,
    badge: 'Free',
  },

  // ─── Google Gemini ───
  {
    id: 'google/gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    provider: 'Google',
    tier: 'standard',
    category: 'cheap',
    multiplier: 1,
    costPer1MTokens: 0.25,
    supportsVision: true,
    badge: 'Cheapest',
  },
  {
    id: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'Google',
    tier: 'standard',
    category: 'fast',
    multiplier: 6,
    costPer1MTokens: 1.40,
    supportsVision: true,
    badge: 'Fast',
  },
  {
    id: 'google/gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    provider: 'Google',
    tier: 'premium',
    category: 'medium',
    multiplier: 24,
    costPer1MTokens: 5.25,
    supportsVision: true,
    badge: 'Balanced',
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    provider: 'Google',
    tier: 'ultra',
    category: 'best',
    multiplier: 32,
    costPer1MTokens: 7.00,
    supportsVision: true,
    badge: 'Best',
  },

  // ─── OpenAI GPT ───
  {
    id: 'openai/gpt-5-nano',
    label: 'GPT-5 nano',
    provider: 'OpenAI',
    tier: 'standard',
    category: 'cheap',
    multiplier: 1,
    costPer1MTokens: 0.22,
    supportsVision: true,
    badge: 'Cheapest',
  },
  {
    id: 'openai/gpt-5-mini',
    label: 'GPT-5 mini',
    provider: 'OpenAI',
    tier: 'standard',
    category: 'fast',
    multiplier: 5,
    costPer1MTokens: 1.13,
    supportsVision: true,
    badge: 'Fast',
  },
  {
    id: 'openai/gpt-4.1',
    label: 'GPT-4.1',
    provider: 'OpenAI',
    tier: 'premium',
    category: 'medium',
    multiplier: 23,
    costPer1MTokens: 5.00,
    supportsVision: true,
    badge: 'Balanced',
  },
  {
    id: 'openai/gpt-5.1',
    label: 'GPT-5.1',
    provider: 'OpenAI',
    tier: 'ultra',
    category: 'best',
    multiplier: 26,
    costPer1MTokens: 5.63,
    supportsVision: true,
    badge: 'Best',
  },

  // ─── Anthropic Claude ───
  {
    id: 'anthropic/claude-3-haiku',
    label: 'Claude 3 Haiku',
    provider: 'Anthropic',
    tier: 'standard',
    category: 'cheap',
    multiplier: 3,
    costPer1MTokens: 0.75,
    supportsVision: true,
    badge: 'Cheapest',
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    label: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    tier: 'premium',
    category: 'fast',
    multiplier: 14,
    costPer1MTokens: 3.00,
    supportsVision: true,
    badge: 'Fast',
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    tier: 'premium',
    category: 'medium',
    multiplier: 41,
    costPer1MTokens: 9.00,
    supportsVision: true,
    badge: 'Balanced',
  },
  {
    id: 'anthropic/claude-opus-4.8',
    label: 'Claude Opus 4.8',
    provider: 'Anthropic',
    tier: 'ultra',
    category: 'best',
    multiplier: 68,
    costPer1MTokens: 15.00,
    supportsVision: true,
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
  {
    id: 'google/gemini-2.5-flash-image',
    label: 'Gemini Flash Image',
    provider: 'Google',
    credits: 120_000,
    quality: 'Fast & High Quality',
    apiType: 'chat-completion' as ImageApiType,
  },
  {
    id: 'black-forest-labs/flux-1.1-pro',
    label: 'FLUX 1.1 Pro',
    provider: 'Black Forest Labs',
    credits: 160_000,
    quality: 'Photorealistic',
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
] as const;

export type ImageModelId = typeof IMAGE_MODELS[number]['id'];

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
