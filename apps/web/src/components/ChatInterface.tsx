'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send, AlertTriangle, Loader2, Paperclip, Sparkles,
  X, Image as ImageIcon, FileText, MessageSquare, ChevronDown, Check, Copy, Pencil,
  Mic, MicOff, Link2, LayoutTemplate, Reply, Scale,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiFetch, apiStream } from '@/lib/api';
import { useWallet } from '@/context/WalletContext';
import { useAppPreferences } from '@/context/AppPreferencesContext';
import MarkdownMessage from './MarkdownMessage';
import SlideViewer from './SlideViewer';
import ConversationPickerModal from './ConversationPickerModal';
import { AI_MODELS, IMAGE_MODELS, formatTokens, getModel, creditsForTokens } from '@tokenai/shared';
import type { ModelId, ChatMode, ModelTier, AIModel, ImageModelId } from '@tokenai/shared';
import type { ConversationSummary } from '@tokenai/shared';
import clsx from 'clsx';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imagePreview?: string;
  generatedImage?: string;
  tokens_used?: number;
  tokensUsed?: number;
  model?: string;
  streaming?: boolean;
  isPresentation?: boolean;
  balanceExhausted?: boolean;
  // Compare mode
  compareContent?: string;
  compareModel?: string;
  compareStreaming?: boolean;
  compareTokensUsed?: number;
}

interface AttachedImage {
  dataUrl: string;
  name: string;
}

interface AttachedFile {
  name: string;
  kind: 'text' | 'pdf';
  text?: string;
  dataUrl?: string;
}

interface LinkedContext {
  conversation: ConversationSummary;
  messages: { role: string; content: string }[];
}

interface Props {
  conversationId: string | null;
  initialMessages?: Message[];
  initialModel?: ModelId;
  onConversationCreated?: (id: string) => void;
  placeholder?: string;
}

// ─── Presentation system prompt ──────────────────────────────────────────────

const PRESENTATION_SYSTEM_PROMPT = `You are an expert presentation designer. The user will describe a topic and you must produce a complete, professional slide deck.

Respond ONLY with the presentation content using this exact format (use --- on its own line between slides):

# [Presentation Title]

---

## Slide 1: [Slide Title]
- [Concise bullet point — max 10 words]
- [Concise bullet point — max 10 words]
- [Concise bullet point — max 10 words]

> **Speaker notes:** [2-3 sentences of guidance for the presenter]

---

## Slide 2: [Slide Title]
...

Rules:
- 8 to 12 slides total
- Recommended structure: Title slide → Agenda → 5-7 content slides → Summary → Call to action or Next steps
- Bullet points must be short and scannable (no full paragraphs)
- Every slide must have speaker notes
- Match the tone and depth to the topic (technical, business, educational, etc.)
- Produce only the slide content — no preamble, no explanation outside the format`;

// ─── Styling helpers ──────────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  'OpenAI': 'bg-emerald-50 text-emerald-700',
  'Anthropic': 'bg-amber-50 text-amber-700',
  'Google': 'bg-blue-50 text-blue-700',
  'Meta': 'bg-sky-50 text-sky-700',
  'DeepSeek': 'bg-purple-50 text-purple-700',
  'NVIDIA': 'bg-green-50 text-green-700',
};

const TIER_BADGE: Record<ModelTier, string> = {
  free:     'bg-emerald-500 text-white',
  standard: 'bg-blue-500 text-white',
  premium:  'bg-violet-600 text-white',
  ultra:    'bg-orange-500 text-white',
};

// Colors for the big number in the rate popup (derived from tier)
const TIER_COLOR: Record<ModelTier, string> = {
  free:     'text-emerald-500',
  standard: 'text-blue-500',
  premium:  'text-violet-600',
  ultra:    'text-orange-500',
};

const CHEAPEST_PAID_MODEL = AI_MODELS
  .filter((m) => m.multiplier > 0)
  .reduce((a, b) => (b.multiplier < a.multiplier ? b : a));

const PROVIDER_SECTIONS: { provider: string; title: string }[] = [
  { provider: 'Google',    title: 'Google Gemini' },
  { provider: 'OpenAI',    title: 'OpenAI GPT' },
  { provider: 'Anthropic', title: 'Anthropic Claude' },
];

// One flagship model per provider — the best choice for generating presentations
const PRESENTATION_MODELS = [
  AI_MODELS.find((m) => m.id === 'anthropic/claude-sonnet-latest')!,
  AI_MODELS.find((m) => m.id === 'openai/gpt-5.5')!,
  AI_MODELS.find((m) => m.id === 'google/gemini-3.5-flash')!,
].filter(Boolean);

const CATEGORY_BADGE: Record<string, string> = {
  Free:     'bg-green-100 text-green-700',
  Cheapest: 'bg-teal-100 text-teal-700',
  Fast:     'bg-sky-100 text-sky-700',
  Balanced: 'bg-violet-100 text-violet-700',
  Best:     'bg-amber-100 text-amber-700',
};

interface ProviderTheme {
  selectedChip: string;
  selectedSub: string;
  sendBtn: string;
  userBubble: string;
  focusRing: string;
  attachActive: string;
  estimate: string;
  groupBg: string;
}

const PROVIDER_THEME: Record<string, ProviderTheme> = {
  Google: {
    selectedChip: 'bg-blue-600 text-white border-blue-600',
    selectedSub: 'text-blue-100',
    sendBtn: 'bg-blue-600 hover:bg-blue-700',
    userBubble: 'bg-blue-600',
    focusRing: 'focus:ring-blue-500',
    attachActive: 'bg-blue-100 text-blue-700 border-blue-200',
    estimate: 'text-blue-600',
    groupBg: 'bg-blue-100',
  },
  OpenAI: {
    selectedChip: 'bg-emerald-600 text-white border-emerald-600',
    selectedSub: 'text-emerald-100',
    sendBtn: 'bg-emerald-600 hover:bg-emerald-700',
    userBubble: 'bg-emerald-600',
    focusRing: 'focus:ring-emerald-500',
    attachActive: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    estimate: 'text-emerald-600',
    groupBg: 'bg-emerald-100',
  },
  Anthropic: {
    selectedChip: 'bg-amber-600 text-white border-amber-600',
    selectedSub: 'text-amber-100',
    sendBtn: 'bg-amber-600 hover:bg-amber-700',
    userBubble: 'bg-amber-600',
    focusRing: 'focus:ring-amber-500',
    attachActive: 'bg-amber-100 text-amber-700 border-amber-200',
    estimate: 'text-amber-600',
    groupBg: 'bg-amber-100',
  },
  Meta: {
    selectedChip: 'bg-sky-600 text-white border-sky-600',
    selectedSub: 'text-sky-100',
    sendBtn: 'bg-sky-600 hover:bg-sky-700',
    userBubble: 'bg-sky-600',
    focusRing: 'focus:ring-sky-500',
    attachActive: 'bg-sky-100 text-sky-700 border-sky-200',
    estimate: 'text-sky-600',
    groupBg: 'bg-sky-100',
  },
  DeepSeek: {
    selectedChip: 'bg-purple-600 text-white border-purple-600',
    selectedSub: 'text-purple-100',
    sendBtn: 'bg-purple-600 hover:bg-purple-700',
    userBubble: 'bg-purple-600',
    focusRing: 'focus:ring-purple-500',
    attachActive: 'bg-purple-100 text-purple-700 border-purple-200',
    estimate: 'text-purple-600',
    groupBg: 'bg-purple-100',
  },
  NVIDIA: {
    selectedChip: 'bg-green-600 text-white border-green-600',
    selectedSub: 'text-green-100',
    sendBtn: 'bg-green-600 hover:bg-green-700',
    userBubble: 'bg-green-600',
    focusRing: 'focus:ring-green-500',
    attachActive: 'bg-green-100 text-green-700 border-green-200',
    estimate: 'text-green-600',
    groupBg: 'bg-green-100',
  },
};

const DEFAULT_THEME = PROVIDER_THEME.Google;

function providerTheme(provider: string): ProviderTheme {
  return PROVIDER_THEME[provider] ?? DEFAULT_THEME;
}

function rateLabel(multiplier: number): string {
  return multiplier === 0 ? 'Free' : `${multiplier}×`;
}



// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatInterface({
  conversationId,
  initialMessages = [],
  initialModel = 'google/gemini-3.1-flash-lite',
  onConversationCreated,
  placeholder = 'Type a message...',
}: Props) {
  const { t, language } = useAppPreferences();

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  // Uncontrolled input — avoids re-rendering the whole component on every keystroke.
  // Only `hasInput` (a boolean) triggers re-renders (just for the send-button state).
  const [hasInput, setHasInput] = useState(false);
  const [model, setModel] = useState<ModelId>(
    getModel(initialModel) ? initialModel : 'google/gemini-3.1-flash-lite'
  );
  const [mode, setMode] = useState<ChatMode>('chat');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lowBalanceWarning, setLowBalanceWarning] = useState(false);
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [generating, setGenerating] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ratePopup, setRatePopup] = useState<AIModel | null>(null);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [imageModel, setImageModel] = useState<ImageModelId>(IMAGE_MODELS[0].id);
  const [imageMenuOpen, setImageMenuOpen] = useState(false);
  const imageMenuRef = useRef<HTMLDivElement>(null);
  const [openImageGroups, setOpenImageGroups] = useState<string[]>([]);
  const [showCompareSoon, setShowCompareSoon] = useState(false);
  // Compare mode
  const [modelB, setModelB] = useState<ModelId>('openai/gpt-mini-latest');
  const [modelBMenuOpen, setModelBMenuOpen] = useState(false);
  const [openGroupsB, setOpenGroupsB] = useState<string[]>([]);
  const modelBMenuRef = useRef<HTMLDivElement>(null);

  // Feature 3: Voice input
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  // Feature 1: Text selection quote-reply
  const [quoteText, setQuoteText] = useState('');
  const [quotePopupPos, setQuotePopupPos] = useState<{ x: number; y: number } | null>(null);

  // Feature 5: Context conversation
  const [linkedContext, setLinkedContext] = useState<LinkedContext | null>(null);
  const [showContextPicker, setShowContextPicker] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const rateDialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const { balance, setBalance, walletLoaded } = useWallet();

  // Admin check — silently determines if current user is admin
  useEffect(() => {
    apiFetch('/api/admin/check').then(() => setIsAdmin(true)).catch(() => setIsAdmin(false));
  }, []);

  // Close model dropdown on outside click
  useEffect(() => {
    if (!modelMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [modelMenuOpen]);

  // Close image model dropdown on outside click
  useEffect(() => {
    if (!imageMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (imageMenuRef.current && !imageMenuRef.current.contains(e.target as Node)) {
        setImageMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [imageMenuOpen]);

  // Close model B dropdown on outside click
  useEffect(() => {
    if (!modelBMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (modelBMenuRef.current && !modelBMenuRef.current.contains(e.target as Node)) {
        setModelBMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [modelBMenuOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Feature 1: Text selection detection ────────────────────────────────────
  useEffect(() => {
    function handleMouseUp() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setQuotePopupPos(null);
        return;
      }
      const text = selection.toString().trim();
      if (text.length < 5) {
        setQuotePopupPos(null);
        return;
      }
      const range = selection.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
      const msgEl = el?.closest('[data-role="assistant"]');
      if (!msgEl) {
        setQuotePopupPos(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setQuoteText(text);
      setQuotePopupPos({ x: rect.left + rect.width / 2, y: rect.top });
    }

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  function handleQuoteReply() {
    const lines = quoteText.split('\n').map((l) => `> ${l}`).join('\n');
    setInputValue(getInput() ? `${getInput()}\n\n${lines}\n\n` : `${lines}\n\n`);
    setQuotePopupPos(null);
    setQuoteText('');
    setMode('chat');
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 200) + 'px';
      }
    }, 0);
  }

  // ── Feature 3: Voice input ─────────────────────────────────────────────────
  function toggleVoice() {
    const SR = (window as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      || (window as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SR) {
      setError('Voice input is not supported in your browser. Try Chrome or Edge.');
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SR as any)();
    rec.lang = language === 'ar' ? 'ar-SA' : 'en-US';
    rec.continuous = false;
    rec.interimResults = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const transcript: string = e.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setInputValue(getInput() ? `${getInput()} ${transcript}` : transcript);
        autoResize();
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  // Read current textarea value (avoids stale state reads)
  function getInput() { return textareaRef.current?.value ?? ''; }

  // Set textarea value + sync hasInput boolean
  function setInputValue(val: string) {
    if (!textareaRef.current) return;
    textareaRef.current.value = val;
    setHasInput(val.trim().length > 0);
    autoResize();
  }

  // Clear textarea + reset height
  function clearInput() {
    if (!textareaRef.current) return;
    textareaRef.current.value = '';
    textareaRef.current.style.height = 'auto';
    setHasInput(false);
  }

  function selectTask(next: ChatMode) {
    if (mode === next) return;
    setMode(next);
    setError(null);
    if (next !== 'chat' && next !== 'compare') {
      setAttachedImage(null);
      setAttachedFile(null);
    }
    if (next === 'presentation' && !PRESENTATION_MODELS.find((m) => m.id === model)) {
      setModel(PRESENTATION_MODELS[0].id);
    }
  }

  function toggleGroupB(key: string) {
    setOpenGroupsB((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function selectModelB(m: AIModel) {
    setModelB(m.id);
    setModelBMenuOpen(false);
  }

  function handleAttachClick() {
    const m = getModel(model);
    if (!m?.supportsVision) {
      setError(`${m?.label ?? 'This model'} can't read images. Please pick a model that supports images.`);
      return;
    }
    setError(null);
    imageInputRef.current?.click();
  }

  function handleFileAttachClick() {
    fileInputRef.current?.click();
  }

  function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setError('Image must be under 4MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage({ dataUrl: reader.result as string, name: file.name });
      setAttachedFile(null);
      setMode('chat');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const isPdf = file.type === 'application/pdf' || ext === '.pdf';

    if (isPdf) {
      const m = getModel(model);
      if (!m?.supportsVision) {
        setError(`${m?.label ?? 'This model'} can't read PDFs. Pick a model that supports documents.`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) { setError('PDF must be under 10MB'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFile({ name: file.name, kind: 'pdf', dataUrl: reader.result as string });
        setAttachedImage(null);
        setMode('chat');
        setError(null);
      };
      reader.readAsDataURL(file);
      return;
    }

    const allowed = ['text/plain', 'text/markdown', 'application/json', 'text/csv',
      'application/javascript', 'text/javascript', 'text/x-python', 'text/html', 'text/css'];
    const allowedExts = ['.txt', '.md', '.json', '.csv', '.js', '.ts', '.py', '.html', '.css'];

    if (!allowed.includes(file.type) && !allowedExts.includes(ext)) {
      setError('Unsupported file type. Supported: PDF, .txt, .md, .json, .csv, .js, .ts, .py, .html, .css');
      return;
    }
    if (file.size > 2 * 1024 * 1024) { setError('Text file must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFile({ name: file.name, kind: 'text', text: reader.result as string });
      setAttachedImage(null);
      setMode('chat');
      setError(null);
    };
    reader.readAsText(file);
  }

  function clearAttachments() {
    setAttachedImage(null);
    setAttachedFile(null);
  }

  function selectModel(m: AIModel) {
    setModel(m.id);
    setModelMenuOpen(false);
    if (m.multiplier > 0) setRatePopup(m);
  }

  function toggleGroup(key: string) {
    setOpenGroups((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function copyMessage(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      setError('Could not copy to clipboard.');
    }
  }


  function editMessage(text: string) {
    setMode('chat');
    setInputValue(text);
    setError(null);
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 200) + 'px';
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 0);
  }

  const estimatedTokens = Math.ceil(getInput().length / 4)
    + (attachedFile?.text ? Math.ceil(attachedFile.text.length / 4) : 0);
  const selectedModel = getModel(model) ?? AI_MODELS[0];
  const isFreeSelected = Number(selectedModel.multiplier) === 0;
  const estimatedCredits = creditsForTokens(model, estimatedTokens);
  const theme = providerTheme(selectedModel.provider);
  const supportsVision = selectedModel.supportsVision;

  useEffect(() => {
    if (!supportsVision) {
      if (attachedImage) setAttachedImage(null);
      if (attachedFile?.kind === 'pdf') setAttachedFile(null);
    }
  }, [supportsVision, attachedImage, attachedFile]);

  useEffect(() => {
    if (modelMenuOpen) {
      setOpenGroups([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelMenuOpen]);

  // Open / close the native <dialog> whenever ratePopup changes
  useEffect(() => {
    const dialog = rateDialogRef.current;
    if (!dialog) return;
    if (ratePopup && !dialog.open) dialog.showModal();
    else if (!ratePopup && dialog.open) dialog.close();
  }, [ratePopup]);

  const sendMessage = useCallback(async () => {
    // ── Image generation mode ────────────────────────────────────────────────
    if (mode === 'generate') {
      const prompt = getInput().trim();
      if (!prompt || generating) return;
      clearInput();
      setError(null);

      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: prompt };
      const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: 'Generating image...', streaming: true };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setGenerating(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      try {
        const result = await apiFetch<{ url: string; tokensUsed: number; newBalance: number }>('/api/generate-image', {
          method: 'POST', body: JSON.stringify({ prompt, model: imageModel }),
        });
        setBalance(result.newBalance);
        setMessages((prev) => prev.map((m) =>
          m.streaming ? { ...m, content: '', generatedImage: result.url, streaming: false, tokensUsed: result.tokensUsed } : m
        ));
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 402) setError('Insufficient tokens. Top up to continue.');
        else if (status === 503) setError('Image generation is not configured.');
        else setError('Image generation failed. Please try again.');
        setMessages((prev) => prev.map((m) => m.streaming ? { ...m, streaming: false, content: '' } : m));
      } finally {
        setGenerating(false);
      }
      return;
    }

    // ── Compare mode ─────────────────────────────────────────────────────────
    if (mode === 'compare') {
      const content = getInput().trim();
      if (!content || streaming) return;
      clearInput();
      setError(null);

      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content };
      const msgId = crypto.randomUUID();
      const compareMsg: Message = {
        id: msgId, role: 'assistant',
        content: '', streaming: true, model,
        compareContent: '', compareStreaming: true, compareModel: modelB,
      };
      setMessages((prev) => [...prev, userMsg, compareMsg]);
      setStreaming(true);

      // Build context from current conversation messages for stream B
      // (so model B sees the same history without querying DB)
      const existingContext = messages
        .filter((m) => !m.streaming && m.content)
        .map((m) => ({ role: m.role, content: m.content }));

      const chatBodyA = {
        conversationId,
        content,
        contextMessages: linkedContext ? linkedContext.messages : undefined,
      };
      const chatBodyB = {
        conversationId: null,
        content,
        skipPersist: true,
        contextMessages: existingContext.length > 0 ? existingContext : undefined,
      };

      try {
        await Promise.all([
          // ── Stream A ──────────────────────────────────────────────────────
          apiStream(
            '/api/chat', { ...chatBodyA, model },
            (chunk) => {
              const delta = (chunk as { choices?: Array<{ delta?: { content?: string } }> })
                .choices?.[0]?.delta?.content;
              if (delta) setMessages((prev) => prev.map((m) =>
                m.id === msgId ? { ...m, content: m.content + delta } : m
              ));
            },
            (done) => {
              setBalance(done.newBalance);
              setMessages((prev) => prev.map((m) =>
                m.id === msgId ? { ...m, streaming: false, tokensUsed: done.tokensUsed } : m
              ));
              if (done.conversationId && !conversationId) {
                onConversationCreated?.(done.conversationId);
                router.replace(`/chat/${done.conversationId}`);
              }
            }
          ),
          // ── Stream B (ephemeral — no DB persistence) ──────────────────────
          apiStream(
            '/api/chat', { ...chatBodyB, model: modelB },
            (chunk) => {
              const delta = (chunk as { choices?: Array<{ delta?: { content?: string } }> })
                .choices?.[0]?.delta?.content;
              if (delta) setMessages((prev) => prev.map((m) =>
                m.id === msgId ? { ...m, compareContent: (m.compareContent ?? '') + delta } : m
              ));
            },
            (done) => {
              setBalance(done.newBalance);
              setMessages((prev) => prev.map((m) =>
                m.id === msgId ? { ...m, compareStreaming: false, compareTokensUsed: done.tokensUsed } : m
              ));
            }
          ),
        ]);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 402) setError('Insufficient credits. Top up to continue — or switch to a free model.');
        else if (status === 429) setError('Daily free limit reached. Switch to a paid model or try again tomorrow.');
        else setError('Connection lost. The response may be incomplete.');
        setMessages((prev) => prev.map((m) =>
          m.id === msgId ? { ...m, streaming: false, compareStreaming: false } : m
        ));
      } finally {
        setStreaming(false);
      }
      return;
    }

    // ── Chat / Presentation mode ─────────────────────────────────────────────
    const content = getInput().trim();
    if (!content || streaming) return;

    clearInput();
    setError(null);
    setLowBalanceWarning(false);

    // Warn if balance might not be enough for a full response
    const modelInfo2 = getModel(model);
    const mult = Number(modelInfo2?.multiplier ?? 1);
    if (mult > 0) {
      const estInputCredits = Math.ceil((content.length / 4 + 500) * mult);
      const minForFullReply = estInputCredits + Math.ceil(1000 * mult); // ~1000 output tokens
      if (balance < minForFullReply) {
        setLowBalanceWarning(true);
      }
    }

    const imageSnapshot = attachedImage;
    const fileSnapshot = attachedFile;
    clearAttachments();

    const isPresentation = mode === 'presentation';
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: isPresentation ? `Create a presentation: ${content}` : content,
      imagePreview: imageSnapshot?.dataUrl,
    };
    const assistantMsg: Message = {
      id: crypto.randomUUID(), role: 'assistant', content: '', streaming: true, model,
      isPresentation,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }

    try {
      let newConvId: string | null = null;

      await apiStream(
        '/api/chat',
        {
          conversationId,
          content: isPresentation ? `Create a presentation about: ${content}` : content,
          model,
          imageUrl: imageSnapshot?.dataUrl,
          fileText: fileSnapshot?.kind === 'text' ? fileSnapshot.text : undefined,
          fileData: fileSnapshot?.kind === 'pdf' ? fileSnapshot.dataUrl : undefined,
          fileName: fileSnapshot?.kind === 'pdf' ? fileSnapshot.name : undefined,
          systemPrompt: isPresentation ? PRESENTATION_SYSTEM_PROMPT : undefined,
          contextMessages: linkedContext ? linkedContext.messages : undefined,
        },
        (chunk) => {
          const delta = (chunk as { choices?: Array<{ delta?: { content?: string } }> })
            .choices?.[0]?.delta?.content;
          if (delta) {
            setMessages((prev) => prev.map((m) => m.streaming ? { ...m, content: m.content + delta } : m));
          }
        },
        (done) => {
          newConvId = done.conversationId;
          setBalance(done.newBalance);
          setMessages((prev) => prev.map((m) =>
            m.streaming ? {
              ...m,
              streaming: false,
              tokensUsed: done.tokensUsed,
              balanceExhausted: done.balanceExhausted,
            } : m
          ));
          if (done.balanceExhausted) setLowBalanceWarning(false);
          if (newConvId && !conversationId) {
            onConversationCreated?.(newConvId);
            router.replace(`/chat/${newConvId}`);
          }
        }
      );
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 402) setError('Insufficient credits. Top up to continue — or switch to a free model.');
      else if (status === 400) setError('This model is no longer available. Please select a different model from the menu.');
      else if (status === 429) setError('Daily free limit reached. Switch to a paid model or try again tomorrow.');
      else if (status === 502) setError(`AI provider error: ${(err as Error).message}`);
      else setError('Connection lost. The response may be incomplete.');
      setMessages((prev) => prev.map((m) => m.streaming ? { ...m, streaming: false } : m));
    } finally {
      setStreaming(false);
    }
  }, [mode, streaming, generating, model, modelB, messages, conversationId, attachedImage, attachedFile,
      linkedContext, router, setBalance, onConversationCreated]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const isGenerateMode = mode === 'generate';
  const isPresentationMode = mode === 'presentation';
  const canSend = isGenerateMode
    ? (hasInput && !generating)
    : (hasInput && !streaming);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--page-bg)' }}>
      {/* Hidden inputs */}
      <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleImageSelected} />
      <input ref={fileInputRef} type="file" accept=".pdf,application/pdf,.txt,.md,.json,.csv,.js,.ts,.py,.html,.css" className="hidden" onChange={handleFileSelected} />

      {/* ── Header: task selector + model ──────────────────────────────────── */}
      <div className="px-4 py-3 border-b" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="max-w-5xl xl:max-w-6xl mx-auto space-y-2.5">

          {/* Task tabs */}
          <div className="inline-flex rounded-xl p-1 gap-1" style={{ background: 'var(--hover-bg)' }}>
            <button
              type="button"
              onClick={() => selectTask('chat')}
              className={clsx(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors',
                mode === 'chat' ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'
              )}
            >
              <MessageSquare className="w-4 h-4" /> {t('chat')}
            </button>
            <button
              type="button"
              onClick={() => selectTask('generate')}
              className={clsx(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors',
                mode === 'generate' ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-700 dark:text-violet-300' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'
              )}
            >
              <Sparkles className="w-4 h-4" /> {t('imageCreation')}
            </button>
            <button
              type="button"
              onClick={() => selectTask('presentation')}
              className={clsx(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors',
                mode === 'presentation' ? 'bg-white text-teal-700 shadow-sm dark:bg-slate-700 dark:text-teal-300' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'
              )}
            >
              <LayoutTemplate className="w-4 h-4" /> {t('presentation')}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowCompareSoon(true); setTimeout(() => setShowCompareSoon(false), 2000); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-500 hover:text-gray-700 dark:text-slate-400"
              >
                <Scale className="w-4 h-4" /> Compare
              </button>
              {showCompareSoon && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-lg animate-fade-in"
                  style={{ background: 'var(--text-primary)' }}>
                  Coming Soon 🚀
                </div>
              )}
            </div>
          </div>

          {/* Mode-specific controls */}
          {(mode === 'chat' || mode === 'presentation') && (
            <div>
              {/* Shared dropdown trigger — same style for both chat and presentation */}
              <div className="relative" ref={modelMenuRef}>
                <button
                  type="button"
                  onClick={() => setModelMenuOpen((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={modelMenuOpen}
                  className="w-full flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left hover:border-gray-300 transition-colors"
                  style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', theme.userBubble)} />
                    <span className="font-medium text-sm truncate">{selectedModel.label}</span>
                    <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0', TIER_BADGE[selectedModel.tier])}>
                      {rateLabel(selectedModel.multiplier)}
                    </span>
                    <span className="text-xs truncate hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
                      · {selectedModel.provider} · {selectedModel.badge}
                    </span>
                  </div>
                  <ChevronDown className={clsx('w-4 h-4 flex-shrink-0 transition-transform', modelMenuOpen && 'rotate-180')} style={{ color: 'var(--text-muted)' }} />
                </button>

                {modelMenuOpen && (
                  <div
                    role="listbox"
                    className="absolute z-20 mt-1.5 w-full max-h-96 overflow-y-auto rounded-xl border shadow-lg py-1"
                    style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                  >
                    {mode === 'presentation' ? (
                      /* Presentation mode: same grouped style as chat, one group per provider */
                      PRESENTATION_MODELS.map((m) => {
                        const pt = providerTheme(m.provider);
                        const groupKey = m.provider;
                        const isOpen = openGroups.includes(groupKey);
                        return (
                          <div key={m.id} className={clsx('py-1', pt.groupBg, 'dark:bg-opacity-10')}>
                            <button
                              type="button"
                              onClick={() => toggleGroup(groupKey)}
                              aria-expanded={isOpen}
                              className="w-full flex items-center gap-2 px-3.5 py-2 text-left hover:bg-white/40 transition-colors"
                            >
                              <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', pt.userBubble)} />
                              <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{m.provider}</span>
                              <ChevronDown className={clsx('w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ml-auto', isOpen && 'rotate-180')} />
                            </button>
                            {isOpen && (
                              <button
                                role="option"
                                aria-selected={model === m.id}
                                onClick={() => selectModel(m)}
                                className={clsx(
                                  'w-full flex items-center gap-2 px-3.5 py-2.5 text-left transition-colors',
                                  model === m.id ? 'bg-white shadow-sm dark:bg-slate-700' : 'hover:bg-white/60'
                                )}
                              >
                                <span className="w-4 flex-shrink-0 flex items-center justify-center">
                                  {model === m.id ? <Check className="w-4 h-4 text-blue-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{m.label}</span>
                                    <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0', CATEGORY_BADGE[m.badge] ?? 'bg-gray-100 text-gray-600')}>
                                      {m.badge}
                                    </span>
                                  </div>
                                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {rateLabel(m.multiplier)} rate
                                  </div>
                                </div>
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      /* Chat mode: full grouped dropdown */
                      [
                        ...(isAdmin ? [{
                          key: 'free', title: 'Free', sub: 'no credits · daily limit',
                          bg: 'bg-violet-50 dark:bg-violet-900/20', dot: 'bg-violet-500',
                          items: AI_MODELS.filter((m) => Number(m.multiplier) === 0),
                        }] : []),
                        ...PROVIDER_SECTIONS.map((s) => ({
                          key: s.provider, title: s.title, sub: '',
                          bg: providerTheme(s.provider).groupBg + ' dark:bg-opacity-10', dot: providerTheme(s.provider).userBubble,
                          items: AI_MODELS.filter((m) => m.provider === s.provider && Number(m.multiplier) > 0),
                        })),
                      ].map((group) => {
                        if (group.items.length === 0) return null;
                        const isOpen = openGroups.includes(group.key);
                        return (
                          <div key={group.key} className={clsx('py-1', group.bg)}>
                            <button
                              type="button"
                              onClick={() => toggleGroup(group.key)}
                              aria-expanded={isOpen}
                              className="w-full flex items-center gap-2 px-3.5 py-2 text-left hover:bg-white/40 transition-colors"
                            >
                              <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', group.dot)} />
                              <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{group.title}</span>
                              {group.sub && <span className="text-[10px] text-gray-500 normal-case">{group.sub}</span>}
                              <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">{group.items.length}</span>
                              <ChevronDown className={clsx('w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
                            </button>
                            {isOpen && group.items.map((m) => (
                              <button
                                key={m.id}
                                role="option"
                                aria-selected={model === m.id}
                                onClick={() => selectModel(m)}
                                className={clsx(
                                  'w-full flex items-center gap-2 px-3.5 py-2.5 text-left transition-colors',
                                  model === m.id ? 'bg-white shadow-sm dark:bg-slate-700' : 'hover:bg-white/60'
                                )}
                              >
                                <span className="w-4 flex-shrink-0 flex items-center justify-center">
                                  {model === m.id ? <Check className="w-4 h-4 text-blue-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{m.label}</span>
                                    <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0', CATEGORY_BADGE[m.badge] ?? 'bg-gray-100 text-gray-600')}>
                                      {m.badge}
                                    </span>
                                  </div>
                                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {rateLabel(m.multiplier)} rate
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              {mode === 'chat' && (
                <a href="/pricing" className="inline-block mt-2 text-xs text-blue-600 hover:underline">View full pricing →</a>
              )}
              {mode === 'presentation' && (
                <div className="flex items-center gap-2 mt-2 rounded-xl border border-teal-200 bg-teal-50 dark:bg-teal-900/20 dark:border-teal-800 px-3.5 py-2.5">
                  <LayoutTemplate className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                  <span className="text-xs text-teal-700 dark:text-teal-300">
                    Just describe your topic naturally — no special format needed. The AI will create professional slides automatically.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Compare mode: two model selectors side by side */}
          {mode === 'compare' && (() => {
            const selectedA = AI_MODELS.find((m) => m.id === model) ?? AI_MODELS[0];
            const selectedBModel = AI_MODELS.find((m) => m.id === modelB) ?? AI_MODELS[1];
            const groups = [
              ...(isAdmin ? [{
                key: 'free', title: 'Free', sub: 'no credits · daily limit',
                bg: 'bg-violet-50 dark:bg-violet-900/20', dot: 'bg-violet-500',
                items: AI_MODELS.filter((m) => Number(m.multiplier) === 0),
              }] : []),
              ...PROVIDER_SECTIONS.map((s) => ({
                key: s.provider, title: s.title, sub: '',
                bg: providerTheme(s.provider).groupBg + ' dark:bg-opacity-10', dot: providerTheme(s.provider).userBubble,
                items: AI_MODELS.filter((m) => m.provider === s.provider && Number(m.multiplier) > 0),
              })),
            ];

            const ModelDropdown = ({
              selected, menuOpen, setMenuOpen, menuRef, openG, toggleG, onSelect, currentId,
            }: {
              selected: AIModel; menuOpen: boolean; setMenuOpen: (v: boolean) => void;
              menuRef: React.RefObject<HTMLDivElement | null>; openG: string[]; toggleG: (k: string) => void;
              onSelect: (m: AIModel) => void; currentId: ModelId;
            }) => (
              <div className="relative flex-1 min-w-0" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left hover:border-gray-300 transition-colors"
                  style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', providerTheme(selected.provider).userBubble)} />
                    <span className="font-medium text-sm truncate">{selected.label}</span>
                    <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0', TIER_BADGE[selected.tier])}>
                      {rateLabel(selected.multiplier)}
                    </span>
                  </div>
                  <ChevronDown className={clsx('w-4 h-4 flex-shrink-0 transition-transform', menuOpen && 'rotate-180')} style={{ color: 'var(--text-muted)' }} />
                </button>
                {menuOpen && (
                  <div role="listbox" className="absolute z-30 mt-1.5 w-full max-h-80 overflow-y-auto rounded-xl border shadow-lg py-1"
                    style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                    {groups.map((group) => {
                      if (group.items.length === 0) return null;
                      const isOpen = openG.includes(group.key);
                      return (
                        <div key={group.key} className={clsx('py-1', group.bg)}>
                          <button type="button" onClick={() => toggleG(group.key)}
                            className="w-full flex items-center gap-2 px-3.5 py-2 text-left hover:bg-white/40 transition-colors">
                            <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', group.dot)} />
                            <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{group.title}</span>
                            <span className="ml-auto text-[10px] text-gray-400">{group.items.length}</span>
                            <ChevronDown className={clsx('w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
                          </button>
                          {isOpen && group.items.map((m) => (
                            <button key={m.id} role="option" aria-selected={currentId === m.id}
                              onClick={() => onSelect(m)}
                              className={clsx('w-full flex items-center gap-2 px-3.5 py-2.5 text-left transition-colors',
                                currentId === m.id ? 'bg-white shadow-sm dark:bg-slate-700' : 'hover:bg-white/60')}>
                              <span className="w-4 flex-shrink-0 flex items-center justify-center">
                                {currentId === m.id ? <Check className="w-4 h-4 text-blue-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{m.label}</span>
                                  <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0', CATEGORY_BADGE[m.badge] ?? 'bg-gray-100 text-gray-600')}>
                                    {m.badge}
                                  </span>
                                </div>
                                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{rateLabel(m.multiplier)} rate</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );

            return (
              <div className="flex items-center gap-2">
                <ModelDropdown
                  selected={selectedA} menuOpen={modelMenuOpen} setMenuOpen={setModelMenuOpen}
                  menuRef={modelMenuRef} openG={openGroups} toggleG={toggleGroup}
                  onSelect={selectModel} currentId={model}
                />
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <Scale className="w-4 h-4 text-orange-500" />
                </div>
                <ModelDropdown
                  selected={selectedBModel} menuOpen={modelBMenuOpen} setMenuOpen={setModelBMenuOpen}
                  menuRef={modelBMenuRef} openG={openGroupsB} toggleG={toggleGroupB}
                  onSelect={selectModelB} currentId={modelB}
                />
              </div>
            );
          })()}

          {/* Generate mode: image model selector — same dropdown style as chat */}
          {mode === 'generate' && (() => {
            const selectedImage = IMAGE_MODELS.find((im) => im.id === imageModel) ?? IMAGE_MODELS[0];
            return (
              <div className="space-y-2">
                <div className="relative" ref={imageMenuRef}>
                  {/* Trigger */}
                  <button
                    type="button"
                    onClick={() => setImageMenuOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={imageMenuOpen}
                    className="w-full flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left hover:border-gray-300 transition-colors"
                    style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                      <span className="font-medium text-sm truncate">{selectedImage.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 bg-violet-600 text-white">
                        {formatTokens(selectedImage.credits)} tokens
                      </span>
                      <span className="text-xs truncate hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
                        · {selectedImage.provider}
                      </span>
                    </div>
                    <ChevronDown className={clsx('w-4 h-4 flex-shrink-0 transition-transform', imageMenuOpen && 'rotate-180')} style={{ color: 'var(--text-muted)' }} />
                  </button>

                  {/* Dropdown */}
                  {imageMenuOpen && (
                    <div
                      role="listbox"
                      className="absolute z-20 mt-1.5 w-full rounded-xl border shadow-lg py-1 overflow-hidden"
                      style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                    >
                      {IMAGE_MODELS.map((im) => {
                        const isOpen = openImageGroups.includes(im.id);
                        const providerColors: Record<string, { bg: string; dot: string }> = {
                          'Google':             { bg: 'bg-blue-50 dark:bg-blue-900/10',   dot: 'bg-blue-500' },
                          'Black Forest Labs':  { bg: 'bg-purple-50 dark:bg-purple-900/10', dot: 'bg-purple-500' },
                          'OpenAI':             { bg: 'bg-emerald-50 dark:bg-emerald-900/10', dot: 'bg-emerald-500' },
                        };
                        const colors = providerColors[im.provider] ?? { bg: 'bg-gray-50', dot: 'bg-gray-500' };
                        return (
                          <div key={im.id} className={clsx('py-1', colors.bg)}>
                            <button
                              type="button"
                              onClick={() => setOpenImageGroups((prev) =>
                                prev.includes(im.id) ? prev.filter((k) => k !== im.id) : [...prev, im.id]
                              )}
                              aria-expanded={isOpen}
                              className="w-full flex items-center gap-2 px-3.5 py-2 text-left hover:bg-white/40 transition-colors"
                            >
                              <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', colors.dot)} />
                              <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{im.provider}</span>
                              <ChevronDown className={clsx('w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ml-auto', isOpen && 'rotate-180')} />
                            </button>
                            {isOpen && (
                              <button
                                role="option"
                                aria-selected={imageModel === im.id}
                                onClick={() => { setImageModel(im.id); setImageMenuOpen(false); }}
                                className={clsx(
                                  'w-full flex items-center gap-2 px-3.5 py-2.5 text-left transition-colors',
                                  imageModel === im.id ? 'bg-white shadow-sm dark:bg-slate-700' : 'hover:bg-white/60'
                                )}
                              >
                                <span className="w-4 flex-shrink-0 flex items-center justify-center">
                                  {imageModel === im.id ? <Check className="w-4 h-4 text-violet-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{im.label}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 bg-violet-600 text-white">
                                      {formatTokens(im.credits)} tokens
                                    </span>
                                  </div>
                                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{im.quality}</div>
                                </div>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <a href="/pricing" className="inline-block text-[11px] text-violet-600 hover:underline">Credits deducted per image · View pricing →</a>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Messages ──────────────────────────────────────────────────────────── */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-5xl xl:max-w-6xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center mt-20">
              <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{t('startConversation')}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('chooseModelAndType')}</p>
              <div className="flex items-center justify-center gap-4 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> Analyze images</span>
                <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Read files</span>
                <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Generate images</span>
                <span className="flex items-center gap-1.5"><LayoutTemplate className="w-3.5 h-3.5" /> Make presentations</span>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'user' ? (
                <div className="max-w-[80%] space-y-1.5 group">
                  {msg.imagePreview && (
                    <div className="flex justify-end">
                      <img src={msg.imagePreview} alt="Attached" className="max-w-xs max-h-48 rounded-xl border border-gray-200 object-cover" />
                    </div>
                  )}
                  {msg.content && (
                    <>
                      <div dir="auto" className={clsx('text-white rounded-2xl rounded-tr-sm px-4 py-3 text-[15px] sm:text-base whitespace-pre-wrap leading-relaxed', theme.userBubble)}>
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button onClick={() => copyMessage(msg.id, msg.content)} title="Copy" className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => editMessage(msg.content)} title="Edit & resend" className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : msg.compareContent !== undefined ? (
                /* ── Compare split view ────────────────────────────────────── */
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { content: msg.content, mdl: msg.model, streaming: msg.streaming, tokens: msg.tokensUsed },
                    { content: msg.compareContent, mdl: msg.compareModel, streaming: msg.compareStreaming, tokens: msg.compareTokensUsed },
                  ].map((side, i) => {
                    const sideModel = AI_MODELS.find((m) => m.id === side.mdl);
                    return (
                      <div key={i} className="rounded-2xl border px-4 py-3 text-sm shadow-sm flex flex-col gap-2"
                        style={{ background: 'var(--msg-assistant-bg)', borderColor: 'var(--msg-assistant-border)' }}>
                        {/* Header */}
                        <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: 'var(--card-border)' }}>
                          <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium',
                            MODEL_COLORS[sideModel?.provider || ''] || 'bg-gray-100 text-gray-500')}>
                            {side.mdl?.split('/')[1]}
                          </span>
                          <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', TIER_BADGE[sideModel?.tier ?? 'standard'])}>
                            {rateLabel(sideModel?.multiplier ?? 1)}
                          </span>
                          {side.streaming && <Loader2 className="w-3 h-3 animate-spin ml-auto" style={{ color: 'var(--text-muted)' }} />}
                        </div>
                        {/* Content */}
                        <div className="flex-1">
                          <MarkdownMessage content={side.content} />
                          {side.streaming && (
                            <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse rounded-sm align-middle" />
                          )}
                        </div>
                        {/* Footer */}
                        {!side.streaming && side.tokens !== undefined && (
                          <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--card-border)' }}>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {side.tokens === 0 ? 'Free' : `${formatTokens(side.tokens)} credits`}
                            </span>
                            <button onClick={() => copyMessage(msg.id + i, side.content)} title="Copy"
                              className="ml-auto p-1 rounded transition-colors" style={{ color: 'var(--text-muted)' }}>
                              {copiedId === msg.id + i ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  data-role="assistant"
                  className="w-full rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm border"
                  style={{ background: 'var(--msg-assistant-bg)', borderColor: 'var(--msg-assistant-border)' }}
                >
                  {msg.generatedImage ? (
                    <div className="space-y-2">
                      <img src={msg.generatedImage} alt="Generated" className="rounded-xl max-w-full border border-gray-100" />
                      <a href={msg.generatedImage} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Open full size</a>
                    </div>
                  ) : msg.isPresentation && !msg.streaming && msg.content ? (
                    <SlideViewer content={msg.content} />
                  ) : (
                    <>
                      <MarkdownMessage content={msg.content} />
                      {msg.streaming && (
                        <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse rounded-sm align-middle" />
                      )}
                      {msg.balanceExhausted && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          <span>⚠️</span>
                          <span>Response cut off — your token balance ran out. <a href="/topup" className="underline font-medium">Top up to continue.</a></span>
                        </div>
                      )}
                    </>
                  )}
                  {!msg.streaming && (msg.tokensUsed ?? msg.tokens_used) !== undefined && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'var(--card-border)' }}>
                      {msg.model && (
                        <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', MODEL_COLORS[AI_MODELS.find((m) => m.id === msg.model)?.provider || ''] || 'bg-gray-100 text-gray-500')}>
                          {msg.model.split('/')[1]}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {(msg.tokensUsed ?? msg.tokens_used) === 0
                          ? 'Free'
                          : `${formatTokens(msg.tokensUsed ?? msg.tokens_used ?? 0)} credits`}
                      </span>
                      {!msg.generatedImage && msg.content && (
                        <button onClick={() => copyMessage(msg.id, msg.content)} title="Copy" className="ml-auto p-1 rounded transition-colors" style={{ color: 'var(--text-muted)' }}>
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
              {error.includes('Connection lost') && (
                <button onClick={sendMessage} className="ml-auto text-xs underline">Retry</button>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input area ─────────────────────────────────────────────────────── */}
      <div className="border-t px-4 py-3" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="max-w-5xl xl:max-w-6xl mx-auto">
          {walletLoaded && balance === 0 && (isGenerateMode || isPresentationMode || !isFreeSelected) ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <a href="/topup" className="bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
                Top up to continue
              </a>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Out of credits — or pick a <span className="text-green-600 font-medium">Free</span> model above
              </span>
            </div>
          ) : (
            <>
              {walletLoaded && balance > 0 && balance < 10_000 && !isFreeSelected && (
                <div className="flex items-center gap-1.5 text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2 text-xs mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Low balance — <a href="/topup" className="underline font-medium">top up to continue</a>
                </div>
              )}

              {lowBalanceWarning && !isFreeSelected && (
                <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  Your token balance may not be enough for a full response — the reply might be cut off mid-way.
                </div>
              )}

              {/* Feature 5: Linked context badge */}
              {linkedContext && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50">
                  <Link2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span className="text-xs text-blue-700 font-medium truncate flex-1">
                    Context: {linkedContext.conversation.title}
                  </span>
                  <span className="text-xs text-blue-500">{linkedContext.messages.length} msgs</span>
                  <button
                    onClick={() => setLinkedContext(null)}
                    className="p-0.5 rounded text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Attachment previews */}
              {attachedImage && (
                <div className="flex items-center gap-2 mb-2 p-2 rounded-lg border" style={{ background: 'var(--hover-bg)', borderColor: 'var(--card-border)' }}>
                  <img src={attachedImage.dataUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{attachedImage.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>≈ 1,000–1,500 tokens</div>
                  </div>
                  <button onClick={clearAttachments} className="p-1 hover:bg-gray-200 rounded">
                    <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                </div>
              )}

              {attachedFile && (
                <div className="flex items-center gap-2 mb-2 p-2 rounded-lg border" style={{ background: 'var(--hover-bg)', borderColor: 'var(--card-border)' }}>
                  <div className={clsx('w-10 h-10 rounded flex items-center justify-center flex-shrink-0', attachedFile.kind === 'pdf' ? 'bg-rose-100' : 'bg-blue-100')}>
                    <FileText className={clsx('w-5 h-5', attachedFile.kind === 'pdf' ? 'text-rose-600' : 'text-blue-600')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{attachedFile.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {attachedFile.kind === 'pdf'
                        ? 'PDF · native processing'
                        : `≈ ${Math.ceil((attachedFile.text?.length ?? 0) / 4).toLocaleString()} tokens`}
                    </div>
                  </div>
                  <button onClick={clearAttachments} className="p-1 hover:bg-gray-200 rounded">
                    <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <textarea
                    ref={textareaRef}
                    onChange={(e) => { setHasInput(e.target.value.trim().length > 0); autoResize(); }}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isPresentationMode
                        ? t('describePresentation')
                        : isGenerateMode
                        ? 'Describe the image you want to generate...'
                        : attachedImage
                        ? 'What would you like to know about this image?'
                        : attachedFile
                        ? 'Ask a question about this file...'
                        : placeholder
                    }
                    rows={1}
                    className={clsx('w-full border rounded-xl px-4 py-3 text-[15px] sm:text-base resize-none focus:outline-none focus:ring-2', theme.focusRing)}
                    style={{
                      minHeight: '44px',
                      background: 'var(--input-bg)',
                      borderColor: 'var(--input-border)',
                      color: 'var(--text-primary)',
                    }}
                  />

                  {/* Bottom toolbar */}
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {!isGenerateMode && !isPresentationMode && (
                      <button
                        onClick={handleAttachClick}
                        title="Upload an image"
                        className={clsx(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                          attachedImage ? theme.attachActive : 'border-gray-200 hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-700'
                        )}
                        style={{ color: attachedImage ? undefined : 'var(--text-secondary)' }}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t('uploadImage')}</span>
                      </button>
                    )}

                    {!isGenerateMode && !isPresentationMode && (
                      <button
                        onClick={handleFileAttachClick}
                        title="Upload a file"
                        className={clsx(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                          attachedFile ? theme.attachActive : 'border-gray-200 hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-700'
                        )}
                        style={{ color: attachedFile ? undefined : 'var(--text-secondary)' }}
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t('uploadFile')}</span>
                      </button>
                    )}

                    {/* Feature 3: Voice input button */}
                    {!isGenerateMode && (
                      <button
                        onClick={toggleVoice}
                        title={listening ? 'Stop recording' : 'Voice input'}
                        className={clsx(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                          listening
                            ? 'bg-red-100 text-red-700 border-red-300 animate-pulse'
                            : 'border-gray-200 hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-700'
                        )}
                        style={{ color: listening ? undefined : 'var(--text-secondary)' }}
                      >
                        {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{listening ? t('listening') : t('voice')}</span>
                      </button>
                    )}


                    {/* Feature 5: Link context conversation */}
                    {!isGenerateMode && (
                      <button
                        onClick={() => setShowContextPicker(true)}
                        title="Link a conversation as context"
                        className={clsx(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                          linkedContext
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : 'border-gray-200 hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-700'
                        )}
                        style={{ color: linkedContext ? undefined : 'var(--text-secondary)' }}
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t('addContext')}</span>
                      </button>
                    )}

                    {/* Credit estimate */}
                    {hasInput && !isGenerateMode && (
                      <span className={clsx('ml-2 text-xs font-medium', isFreeSelected ? 'text-green-600' : theme.estimate)}>
                        {isFreeSelected ? 'Free' : `~${formatTokens(estimatedCredits)} credits`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Send button */}
                <button
                  onClick={sendMessage}
                  disabled={!canSend}
                  className={clsx(
                    'min-h-[44px] min-w-[44px] text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-40',
                    isPresentationMode
                      ? 'bg-teal-600 hover:bg-teal-700'
                      : isGenerateMode
                      ? 'bg-violet-600 hover:bg-violet-700'
                      : theme.sendBtn
                  )}
                >
                  {streaming || generating
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : isPresentationMode
                    ? <LayoutTemplate className="w-4 h-4" />
                    : isGenerateMode
                    ? <Sparkles className="w-4 h-4" />
                    : <Send className="w-4 h-4" />
                  }
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Feature 1: Quote-reply floating popup ──────────────────────────── */}
      {quotePopupPos && quoteText && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: quotePopupPos.x, top: quotePopupPos.y - 4, transform: 'translate(-50%, -100%)' }}
        >
          <button
            className="pointer-events-auto flex items-center gap-1.5 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl hover:bg-gray-700 transition-colors"
            onMouseDown={(e) => { e.preventDefault(); handleQuoteReply(); }}
          >
            <Reply className="w-3 h-3" /> {t('quoteReply')}
          </button>
          <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
        </div>
      )}

      {/* ── Feature 5: Context conversation picker modal ────────────────────── */}
      {showContextPicker && (
        <ConversationPickerModal
          currentConversationId={conversationId}
          onSelect={(conv, msgs) => {
            setLinkedContext({ conversation: conv, messages: msgs });
            setShowContextPicker(false);
          }}
          onClose={() => setShowContextPicker(false)}
        />
      )}

      {/* ── Paid model rate dialog (native <dialog> → browser top layer) ──── */}
      <dialog
        ref={rateDialogRef}
        onClose={() => setRatePopup(null)}
        onClick={(e) => { if (e.currentTarget === e.target) setRatePopup(null); }}
        className="m-auto w-80 max-w-[92vw] rounded-2xl border-0 p-0 shadow-2xl
                   backdrop:bg-black/65 backdrop:backdrop-blur-[2px]"
        style={{ background: 'var(--card-bg)' }}
      >
        {ratePopup && (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={clsx('w-3 h-3 rounded-full flex-shrink-0', providerTheme(ratePopup.provider).userBubble)} />
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{ratePopup.provider}</p>
                  <h3 className="font-bold text-base leading-tight" style={{ color: 'var(--text-primary)' }}>
                    {ratePopup.label}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setRatePopup(null)}
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors mt-0.5"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Rate badge */}
            <div className="px-5 pb-4">
              <div className="rounded-xl p-5 text-center" style={{ background: 'var(--hover-bg)' }}>
                <span className={clsx('text-5xl font-extrabold tabular-nums', TIER_COLOR[ratePopup.tier])}>
                  {ratePopup.multiplier}<span className="text-3xl">×</span>
                </span>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  {ratePopup.multiplier === 1 ? 'baseline rate — cheapest paid model' : `compared to ${CHEAPEST_PAID_MODEL.label}`}
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="px-5 pb-5 space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <p>
                {ratePopup.multiplier === 1
                  ? <><b style={{ color: 'var(--text-primary)' }}>{ratePopup.label}</b> uses the lowest token rate available.</>
                  : <>For the same message, <b style={{ color: 'var(--text-primary)' }}>{ratePopup.label}</b> uses{' '}
                    <b style={{ color: 'var(--text-primary)' }}>{ratePopup.multiplier}×</b> more tokens than{' '}
                    <b style={{ color: 'var(--text-primary)' }}>{CHEAPEST_PAID_MODEL.label}</b> — because it&apos;s a more capable model.</>}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>You&apos;re only charged for what you actually use.</p>
            </div>

            {/* CTA */}
            <div className="px-4 pb-4">
              <button
                onClick={() => setRatePopup(null)}
                className={clsx('w-full text-white rounded-xl py-3 text-sm font-semibold transition-colors', providerTheme(ratePopup.provider).sendBtn)}
              >
                Got it
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
