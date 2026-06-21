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
// multiplier  = credits charged per 1 AI token.
//               Normalized so cheapest paid model = 1×.
//               Formula: ceil(completion_cost_per_1M / 1.5)
//               Free models = 0 (limited by FREE_DAILY_MESSAGE_LIMIT).
//
// costPer1MTokens = blended real OpenRouter cost (input+output avg), $ per 1M.
//                   Source: openrouter.ai/api/v1/models  (verified 2026-06-20)
//
// All model IDs verified against OpenRouter API — only IDs that actually
// exist are listed here.
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
    badge: 'Free',
  },

  // ─── Google Gemini ─────────────────────────────────────────────────────
  // gemini-2.5-flash-lite:  $0.10 input / $0.40 output per 1M  → mult 1
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
  // gemini-3.5-flash:  $1.50 input / $9.00 output per 1M  → mult 6
  {
    id: 'google/gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    provider: 'Google',
    tier: 'standard',
    category: 'fast',
    multiplier: 6,
    costPer1MTokens: 5.25,
    supportsVision: true,
    badge: 'Fast',
  },
  // gemini-2.5-pro:  $1.25 input / $10.00 output per 1M  → mult 7
  {
    id: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'Google',
    tier: 'premium',
    category: 'best',
    multiplier: 7,
    costPer1MTokens: 5.63,
    supportsVision: true,
    badge: 'Best',
  },

  // ─── OpenAI GPT ────────────────────────────────────────────────────────
  // gpt-4o-mini:  $0.15 input / $0.60 output per 1M  → mult 1
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o Mini',
    provider: 'OpenAI',
    tier: 'standard',
    category: 'cheap',
    multiplier: 1,
    costPer1MTokens: 0.38,
    supportsVision: true,
    badge: 'Cheapest',
  },
  // gpt-4o:  $2.50 input / $10.00 output per 1M  → mult 7
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    provider: 'OpenAI',
    tier: 'premium',
    category: 'fast',
    multiplier: 7,
    costPer1MTokens: 6.25,
    supportsVision: true,
    badge: 'Fast',
  },
  // gpt-5.5:  $5.00 input / $30.00 output per 1M  → mult 20
  {
    id: 'openai/gpt-5.5',
    label: 'GPT-5.5',
    provider: 'OpenAI',
    tier: 'ultra',
    category: 'best',
    multiplier: 20,
    costPer1MTokens: 17.50,
    supportsVision: true,
    badge: 'Best',
  },

  // ─── Anthropic Claude ──────────────────────────────────────────────────
  // claude-haiku-4.5:  $1.00 input / $5.00 output per 1M  → mult 4
  {
    id: 'anthropic/claude-haiku-4.5',
    label: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    tier: 'standard',
    category: 'cheap',
    multiplier: 4,
    costPer1MTokens: 3.00,
    supportsVision: true,
    badge: 'Cheapest',
  },
  // claude-sonnet-4.5:  $3.00 input / $15.00 output per 1M  → mult 10
  {
    id: 'anthropic/claude-sonnet-4.5',
    label: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    tier: 'premium',
    category: 'fast',
    multiplier: 10,
    costPer1MTokens: 9.00,
    supportsVision: true,
    badge: 'Fast',
  },
  // claude-opus-4.8:  $5.00 input / $25.00 output per 1M  → mult 17
  {
    id: 'anthropic/claude-opus-4.8',
    label: 'Claude Opus 4.8',
    provider: 'Anthropic',
    tier: 'ultra',
    category: 'best',
    multiplier: 17,
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
    id: 'google/gemini-3.1-flash-image',
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
