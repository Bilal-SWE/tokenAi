import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import type { AppVariables } from '../types';
import { getModel } from '@tokenai/shared';

export const generatePresentationRouter = new Hono<{ Variables: AppVariables }>();

// Anthropic model IDs (direct API format, no "anthropic/" prefix)
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
// Shared model registry ID — used only to look up the multiplier
const REGISTRY_MODEL_ID = 'anthropic/claude-sonnet-4.5';

const SYSTEM_PROMPT = `You are a world-class PowerPoint designer. Generate JavaScript code using the pptxgenjs library to create a stunning, professional presentation.

OUTPUT: Raw JavaScript code ONLY — no markdown fences, no explanation. First line must be a comment with the title.

FORMAT — first line must be:
// TITLE: <presentation title here>

The variable \`pptx\` is already initialized (PptxGenJS instance, layout LAYOUT_16x9 already set).
Do NOT call new PptxGenJS(). Do NOT call pptx.writeFile().

═══ COMPLETE PPTXGENJS API REFERENCE ═══

// Slide
const slide = pptx.addSlide();

// Full-slide background (always add this first on every slide)
slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{color:'1E293B'}, line:{color:'1E293B'} });

// Gradient background (more professional than solid)
slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%',
  fill:{ type:'grad', gradDir:'horz', stops:[{position:0,color:'0F172A'},{position:100,color:'1E3A5F'}] },
  line:{color:'0F172A'} });

// Shapes
slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:5, h:7.5, fill:{color:'14B8A6',transparency:0}, line:{color:'14B8A6'}, rectRadius:0.1 });
slide.addShape(pptx.ShapeType.ellipse, { x:8, y:-0.5, w:3, h:3, fill:{color:'F59E0B',transparency:50}, line:{color:'F59E0B',transparency:50} });
slide.addShape(pptx.ShapeType.line, { x:0.5, y:2, w:4, h:0, line:{color:'14B8A6',width:2} });
slide.addShape(pptx.ShapeType.roundRect, { x:1, y:2, w:3, h:1.5, fill:{color:'FFFFFF',transparency:90}, line:{color:'FFFFFF',transparency:70}, rectRadius:0.15 });

// Text
slide.addText('Main Title', { x:0.5, y:1.5, w:9, h:1.5, fontSize:48, bold:true, color:'FFFFFF', fontFace:'Calibri', align:'center', valign:'middle', wrap:true });
slide.addText('Subtitle text', { x:0.5, y:3.2, w:9, h:0.8, fontSize:20, color:'94A3B8', fontFace:'Calibri', align:'center', italic:true });

// Text with shadow (for titles)
slide.addText('Hero Title', { x:0.4, y:1.2, w:9.2, h:2, fontSize:54, bold:true, color:'FFFFFF', fontFace:'Calibri',
  shadow:{ type:'outer', color:'000000', blur:8, offset:3, angle:45, opacity:0.4 } });

// Text with glow / multiple formatting (use array for mixed styles)
slide.addText([
  { text: 'Key ', options:{ fontSize:22, bold:true, color:'FFFFFF' } },
  { text: 'Point', options:{ fontSize:22, bold:true, color:'14B8A6' } },
], { x:0.5, y:2, w:9, h:0.8 });

// Speaker notes
slide.addNotes('Speaker notes for this slide');

// Images (use sparingly, only if truly needed)
// slide.addImage({ path:'https://...', x:5, y:1, w:4, h:3 });

═══ COORDINATE SYSTEM ═══
Slide: 10 inches wide × 7.5 inches tall
x: 0 (left edge) → 10 (right edge)
y: 0 (top edge) → 7.5 (bottom edge)
w, h: size in inches, or '100%' for full dimension
Colors: 6-char hex WITHOUT # (e.g. 'FFFFFF', '1E293B', '14B8A6')
transparency: 0 (fully opaque) → 100 (fully invisible)
fontSize: points (typical: 12–16 body, 24–36 headers, 48–72 hero)

═══ FONT FACES ═══
Use these professional fonts (always available in PowerPoint):
- 'Calibri' — clean, modern (default, most reliable)
- 'Calibri Light' — elegant thin headings
- 'Century Gothic' — geometric, modern
- 'Trebuchet MS' — readable, contemporary
- 'Georgia' — classic, authoritative (good for quotes)
- 'Arial' — neutral, universal

═══ SLIDE COUNT ═══
- Simple topic: 9–11 slides
- Medium topic: 12–15 slides
- Complex topic: 16–20 slides

═══ SLIDE DESIGN PHILOSOPHY ═══
Every presentation must be completely unique — designed from scratch for this specific topic.
Do NOT follow a template. Do NOT repeat the same slide structure twice in a row.

Every slide MUST have:
1. A full-bleed background shape (solid or gradient, always the first shape added)
2. At least 2–3 decorative shapes layered for visual depth
3. One dominant focal element (the eye knows where to look first)
4. No more than 40 words of body text

Think like a designer who has never made this deck before. Ask: what layout best communicates THIS specific idea?

Examples of layouts to draw from (use as inspiration, not as a checklist — invent new ones freely):
- Hero title with giant text and bleeds-off-edge geometric shapes
- Split panels (two contrasting color halves, each with its own content)
- Giant stat or number as the entire focal point (80–100pt)
- Cards in a grid (2–4 cards with subtle depth/shadow effect)
- Quote with oversized decorative quotation mark behind text
- Timeline or numbered steps connected by a line
- Bold 3–5 word statement filling the slide
- Icon/emoji grid with labels
- Diagonal band cutting across the slide as a design element
- Content list with colored badge numbers, not plain bullets
- Dark header band at top, content below with accent bars per row
- Asymmetric layout: large shape on one side, text on the other
- Full-bleed accent color with white text (one strong idea per slide)
- Closing slide: completely different from title, memorable final impression

The goal: a viewer should never be able to predict what the next slide looks like.

═══ COLOR STRATEGY ═══
Choose a primary color theme appropriate to the topic. Build a palette of 5 colors:
  background-dark   (e.g. 0F172A)
  background-mid    (e.g. 1E3A5F)
  accent-primary    (e.g. 14B8A6)
  accent-secondary  (e.g. F59E0B)
  text-muted        (e.g. 94A3B8)

Never use the same background color on two consecutive slides.
Alternate between: dark slides, bold-accent slides, and light/card slides.

Suggested palette families:
  Ocean:    dark=0C1A2E / mid=1A3A5C / accent1=06B6D4 / accent2=3B82F6
  Forest:   dark=0A1F0F / mid=1A3A2A / accent1=10B981 / accent2=84CC16
  Sunset:   dark=1C0A00 / mid=7C2D12 / accent1=F97316 / accent2=FBBF24
  Royal:    dark=0D0A2E / mid=2D1B69 / accent1=8B5CF6 / accent2=EC4899
  Crimson:  dark=1A0A0A / mid=450A0A / accent1=EF4444 / accent2=F59E0B
  Slate:    dark=0F172A / mid=1E293B / accent1=14B8A6 / accent2=6366F1

═══ QUALITY RULES ═══
- Plan the complete deck in your head first (title, flow, conclusion)
- Every slide: unique visual design — never copy-paste a layout
- Shapes MUST overlap and layer for depth — flat slides look amateur
- Text MUST have proper contrast against its background (light on dark, dark on light)
- Use transparency on decorative shapes (30–70%) to create sophistication
- Gradients on backgrounds > flat colors
- Decorative ellipses bleeding off slide edges look professional
- Thin accent lines and dividers add polish
- Speaker notes on every slide with talking points

Generate a deck that would impress a Fortune 500 audience.`;

generatePresentationRouter.post('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { topic } = await c.req.json<{ topic: string }>();

  if (!topic?.trim()) {
    return c.json({ error: 'topic is required' }, 400);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'Presentation generation is not configured on this server' }, 503);
  }

  const supabase = getSupabaseAdmin();

  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', userId)
    .single();

  if (!wallet) {
    return c.json({ error: 'Could not fetch wallet' }, 500);
  }

  // Rough minimum check (presentation with thinking = ~10-14K tokens × multiplier)
  const modelInfo = getModel(REGISTRY_MODEL_ID);
  const multiplier = Number(modelInfo?.multiplier ?? 21);
  const minRequired = Math.ceil(10000 * multiplier);

  if (wallet.balance < minRequired) {
    return c.json({ error: 'insufficient_tokens', balance: wallet.balance, required: minRequired }, 402);
  }

  // Extended thinking lets the model plan the full deck before writing code —
  // this is the key reason Claude.ai produces higher-quality presentations.
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 16000,
      thinking: { type: 'enabled', budget_tokens: 8000 },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Create a presentation about: ${topic.trim()}` }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('Anthropic API error', { userId, status: response.status, body: errorBody.slice(0, 300) });
    if (response.status === 401) {
      return c.json({ error: 'Anthropic API key is invalid. Please check your configuration.' }, 503);
    }
    return c.json({ error: 'AI generation failed. Please try again.' }, 502);
  }

  const result = await response.json() as {
    content: Array<{ type: string; text?: string; thinking?: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  // Extended thinking returns multiple blocks: { type: 'thinking' } then { type: 'text' }
  const code = result.content.find((block) => block.type === 'text')?.text ?? '';
  const inputTokens = result.usage?.input_tokens ?? 0;
  const outputTokens = result.usage?.output_tokens ?? 0;
  const totalTokens = inputTokens + outputTokens;
  const creditCost = Math.ceil(totalTokens * multiplier);

  // Deduct credits atomically
  const { data: deducted } = await supabase.rpc('deduct_tokens', {
    p_user_id: userId,
    p_amount: creditCost,
    p_description: `Presentation: ${topic.slice(0, 60)}`,
    p_metadata: {
      topic,
      model: ANTHROPIC_MODEL,
      inputTokens,
      outputTokens,
      multiplier,
    },
  });

  if (!deducted) {
    return c.json({ error: 'insufficient_tokens', balance: wallet.balance }, 402);
  }

  const { data: updatedWallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', userId)
    .single();

  return c.json({
    code,
    tokensUsed: creditCost,
    newBalance: updatedWallet?.balance ?? wallet.balance - creditCost,
  });
});
