# TokenAI — Claude Code Context

## What this is
Pay-as-you-go multi-model AI platform. Users buy token bundles and 
consume them across GPT-4o mini, Claude Haiku, and Gemini Flash.

## Monorepo structure
- apps/web — Next.js 14 frontend (port 3000)
- apps/api — Hono backend (port 3001)
- packages/shared — shared TypeScript types

## Key concepts
- Tokens are stored as integers (never floats) in the `wallets` table
- Token deduction is atomic via the `deduct_tokens` Postgres function
- All AI calls go through OpenRouter (single API key for all models)
- Streaming uses Server-Sent Events (SSE)

## Running locally
pnpm install
pnpm dev   # starts both web and api concurrently

## Environment
Copy .env.example to .env.local and fill in all values before running.
- apps/web needs: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, NEXT_PUBLIC_API_URL
- apps/api needs: OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

## Do not
- Never expose SUPABASE_SERVICE_ROLE_KEY to the frontend
- Never store token balances in client state as the source of truth
- Never call AI providers directly from the frontend — always go through /api/chat
- Never do direct UPDATE on wallets table — always use deduct_tokens/add_tokens RPCs
