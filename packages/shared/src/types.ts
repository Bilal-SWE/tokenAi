// ───────────────────────────────────────────────────────────
// Credit bundle definitions
// Wallet currency is nanodollars (1 USD = 1,000,000,000).
// Stored as BIGINT in the DB; displayed as "$X.XX" in the UI.
// ───────────────────────────────────────────────────────────
export const TOKEN_BUNDLES = [
  { id: 'starter',  label: 'Starter',  usd: 5,  nanodollars: 5_000_000_000,  popular: false },
  { id: 'standard', label: 'Standard', usd: 10, nanodollars: 10_000_000_000, popular: true  },
  { id: 'pro',      label: 'Pro',      usd: 20, nanodollars: 20_000_000_000, popular: false },
  { id: 'business', label: 'Business', usd: 50, nanodollars: 50_000_000_000, popular: false },
] as const;

export type BundleId = typeof TOKEN_BUNDLES[number]['id'];

export type ChatMode = 'chat' | 'generate' | 'presentation' | 'compare';

export type ModelTier = 'free' | 'standard' | 'premium' | 'ultra';

// ───────────────────────────────────────────────────────────
// Model definitions
//
// nanodollarsPerToken = cost charged per 1 AI token, in nanodollars.
//   Formula: costPer1MTokens (blended, with 2× markup) × 1,000
//   Free models = 0 (limited by FREE_DAILY_MESSAGE_LIMIT).
//
// costPer1MTokens = blended real OpenRouter cost (input+output avg), $ per 1M.
//                   Source: openrouter.ai/api/v1/models  (verified 2026-06-20)
// ───────────────────────────────────────────────────────────
export const AI_MODELS = [

  // ─── Free (no charge, limited by daily message cap) ────────────────────
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    label: 'Nemotron Ultra',
    provider: 'NVIDIA',
    tier: 'free',
    category: 'free',
    nanodollarsPerToken: 0,
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
    nanodollarsPerToken: 0,
    costPer1MTokens: 0,
    supportsVision: false,
    badge: 'Free',
  },

  // ─── Google Gemini ─────────────────────────────────────────────────────
  // gemini-2.5-flash-lite: $0.25/1M blended → 2× markup → $0.50/1M → 500 ndpt
  {
    id: 'google/gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    provider: 'Google',
    tier: 'standard',
    category: 'cheap',
    nanodollarsPerToken: 500,
    costPer1MTokens: 0.25,
    supportsVision: true,
    badge: 'Cheapest',
  },
  // gemini-3.5-flash: $5.25/1M blended → 2× → $10.50/1M → 10500 ndpt
  {
    id: 'google/gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    provider: 'Google',
    tier: 'standard',
    category: 'fast',
    nanodollarsPerToken: 10_500,
    costPer1MTokens: 5.25,
    supportsVision: true,
    badge: 'Fast',
  },
  // gemini-2.5-pro: $5.63/1M blended → 2× → $11.26/1M → 11260 ndpt
  {
    id: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'Google',
    tier: 'premium',
    category: 'best',
    nanodollarsPerToken: 11_260,
    costPer1MTokens: 5.63,
    supportsVision: true,
    badge: 'Best',
  },

  // ─── OpenAI GPT ────────────────────────────────────────────────────────
  // gpt-4o-mini: $0.38/1M blended → 2× → $0.76/1M → 760 ndpt
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o Mini',
    provider: 'OpenAI',
    tier: 'standard',
    category: 'cheap',
    nanodollarsPerToken: 760,
    costPer1MTokens: 0.38,
    supportsVision: true,
    badge: 'Cheapest',
  },
  // gpt-4o: $6.25/1M blended → 2× → $12.50/1M → 12500 ndpt
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    provider: 'OpenAI',
    tier: 'premium',
    category: 'fast',
    nanodollarsPerToken: 12_500,
    costPer1MTokens: 6.25,
    supportsVision: true,
    badge: 'Fast',
  },
  // gpt-5.5: $17.50/1M blended → 2× → $35/1M → 35000 ndpt
  {
    id: 'openai/gpt-5.5',
    label: 'GPT-5.5',
    provider: 'OpenAI',
    tier: 'ultra',
    category: 'best',
    nanodollarsPerToken: 35_000,
    costPer1MTokens: 17.50,
    supportsVision: true,
    badge: 'Best',
  },

  // ─── Anthropic Claude ──────────────────────────────────────────────────
  // claude-haiku-4.5: $3.00/1M blended → 2× → $6/1M → 6000 ndpt
  {
    id: 'anthropic/claude-haiku-4.5',
    label: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    tier: 'standard',
    category: 'cheap',
    nanodollarsPerToken: 6_000,
    costPer1MTokens: 3.00,
    supportsVision: true,
    badge: 'Cheapest',
  },
  // claude-sonnet-4.5: $9.00/1M blended → 2× → $18/1M → 18000 ndpt
  {
    id: 'anthropic/claude-sonnet-4.5',
    label: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    tier: 'premium',
    category: 'fast',
    nanodollarsPerToken: 18_000,
    costPer1MTokens: 9.00,
    supportsVision: true,
    badge: 'Fast',
  },
  // claude-opus-4.8: $15.00/1M blended → 2× → $30/1M → 30000 ndpt
  {
    id: 'anthropic/claude-opus-4.8',
    label: 'Claude Opus 4.8',
    provider: 'Anthropic',
    tier: 'ultra',
    category: 'best',
    nanodollarsPerToken: 30_000,
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
export const IMAGE_GENERATION_CREDITS = 80_000_000; // nanodollars — kept for backward compat

export type ImageApiType = 'chat-completion' | 'image-generation';

export const IMAGE_MODELS = [
  {
    id: 'google/gemini-3.1-flash-image',
    label: 'Gemini Flash Image',
    provider: 'Google',
    nanodollarsPerImage: 80_000_000,    // ~$0.08
    quality: 'Fast & High Quality',
    apiType: 'chat-completion' as ImageApiType,
  },
  {
    id: 'black-forest-labs/flux-1.1-pro',
    label: 'FLUX 1.1 Pro',
    provider: 'Black Forest Labs',
    nanodollarsPerImage: 100_000_000,   // ~$0.10
    quality: 'Photorealistic',
    apiType: 'image-generation' as ImageApiType,
  },
  {
    id: 'openai/dall-e-3',
    label: 'DALL-E 3',
    provider: 'OpenAI',
    nanodollarsPerImage: 150_000_000,   // ~$0.15
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
  return (getModel(id)?.nanodollarsPerToken ?? 1) === 0;
}

/** Nanodollars charged for a given number of raw AI tokens on a model. */
export function costInNanodollars(modelId: string, tokens: number): number {
  const m = getModel(modelId);
  return Math.ceil(tokens * (m?.nanodollarsPerToken ?? 1));
}

/** @deprecated Use costInNanodollars instead */
export function creditsForTokens(modelId: string, tokens: number): number {
  return costInNanodollars(modelId, tokens);
}

/** Format a nanodollar balance as a dollar string, e.g. "$4.87" */
export function formatBalance(nanodollars: number): string {
  return `$${(nanodollars / 1_000_000_000).toFixed(2)}`;
}

/** @deprecated Use formatBalance for wallet/cost values */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export const TIER_LABELS: Record<ModelTier, string> = {
  free: 'Free',
  standard: 'Standard',
  premium: 'Premium',
  ultra: 'Ultra',
};
