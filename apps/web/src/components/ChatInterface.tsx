'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send, AlertTriangle, Loader2, Paperclip, Sparkles,
  X, Image as ImageIcon, FileText, MessageSquare, ChevronDown, Check, Copy, Pencil,
  Mic, MicOff, Link2, LayoutTemplate, Reply, Scale, Globe,
  User, Bot, Camera, Plus, Cpu,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiFetch, apiStream, apiStreamPresentation } from '@/lib/api';
import { useWallet } from '@/context/WalletContext';
import { useApp } from '@/context/AppContext';
import { useAppPreferences } from '@/context/AppPreferencesContext';
import MarkdownMessage from './MarkdownMessage';
import SlideViewer from './SlideViewer';
import ConversationPickerModal from './ConversationPickerModal';
import { AI_MODELS, IMAGE_MODELS, VOICE_MODELS, formatTokens, formatUSD, getModel, creditsForTokens } from '@tokenai/shared';
import type { ModelId, ChatMode, ModelTier, AIModel, ImageModelId, VoiceModelId } from '@tokenai/shared';
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
  { provider: 'Qwen3',     title: 'Qwen3' },
  { provider: 'DeepSeek',  title: 'DeepSeek' },
];

const VOICE_PROVIDERS = [
  { provider: 'OpenAI',     title: 'OpenAI' },
  { provider: 'ElevenLabs', title: 'ElevenLabs' },
  { provider: 'Grok',       title: 'Grok' },
];

const IMAGE_PROVIDERS = [
  { provider: 'Google',            title: 'Google' },
  { provider: 'Black Forest Labs', title: 'Black Forest Labs' },
  { provider: 'OpenAI',            title: 'OpenAI' },
];

// One flagship model per provider — the best choice for generating presentations
const PRESENTATION_MODELS = [
  AI_MODELS.find((m) => m.id === 'anthropic/claude-sonnet-4.5')!,
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
  Qwen3: {
    selectedChip: 'bg-indigo-600 text-white border-indigo-600',
    selectedSub: 'text-indigo-100',
    sendBtn: 'bg-indigo-600 hover:bg-indigo-700',
    userBubble: 'bg-indigo-600',
    focusRing: 'focus:ring-indigo-500',
    attachActive: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    estimate: 'text-indigo-600',
    groupBg: 'bg-indigo-100',
  },
  Grok: {
    selectedChip: 'bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-700 dark:border-zinc-700',
    selectedSub: 'text-zinc-200',
    sendBtn: 'bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600',
    userBubble: 'bg-zinc-800 dark:bg-zinc-700',
    focusRing: 'focus:ring-zinc-800 dark:focus:ring-zinc-600',
    attachActive: 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700',
    estimate: 'text-zinc-800 dark:text-zinc-300',
    groupBg: 'bg-zinc-100',
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



function UserAvatar() {
  return (
    <div className="w-[44px] h-[44px] rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm select-none">
      <User className="w-5 h-5" />
    </div>
  );
}

function ProviderAvatar({ provider }: { provider?: string }) {
  const p = provider || 'AI';
  const [imgError, setImgError] = useState(false);

  // Map provider to domain for official favicon fetching
  const domains: Record<string, string> = {
    Google: 'gemini.google.com',
    OpenAI: 'openai.com',
    Meta: 'meta.ai',
    DeepSeek: 'deepseek.com',
    NVIDIA: 'nvidia.com',
    Qwen3: 'qwenlm.github.io',
    ElevenLabs: 'elevenlabs.io',
    'Black Forest Labs': 'blackforestlabs.ai',
    Poolside: 'poolside.ai',
    Grok: 'x.ai',
  };

  const domain = domains[p];

  const colors: Record<string, { bg: string; text: string }> = {
    Google: { bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-600 dark:text-blue-400' },
    OpenAI: { bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-600 dark:text-emerald-400' },
    Anthropic: { bg: 'bg-transparent', text: 'text-[#d97757]' },
    Meta: { bg: 'bg-sky-50 dark:bg-sky-950/20', text: 'text-sky-600 dark:text-sky-400' },
    DeepSeek: { bg: 'bg-purple-50 dark:bg-purple-950/20', text: 'text-purple-600 dark:text-purple-400' },
    NVIDIA: { bg: 'bg-green-50 dark:bg-green-950/20', text: 'text-green-600 dark:text-green-400' },
    Compare: { bg: 'bg-indigo-50 dark:bg-indigo-950/20', text: 'text-indigo-600 dark:text-indigo-400' },
    Qwen3: { bg: 'bg-indigo-50 dark:bg-indigo-950/20', text: 'text-indigo-600 dark:text-indigo-400' },
    ElevenLabs: { bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-600 dark:text-emerald-400' },
    'Black Forest Labs': { bg: 'bg-violet-50 dark:bg-violet-950/20', text: 'text-violet-600 dark:text-violet-400' },
    Poolside: { bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-600 dark:text-blue-400' },
    Grok: { bg: 'bg-zinc-50 dark:bg-zinc-950/20', text: 'text-zinc-600 dark:text-zinc-400' },
  };

  const style = colors[p] || { bg: 'bg-gray-50 dark:bg-slate-800', text: 'text-gray-500 dark:text-gray-400' };

  return (
    <div className={clsx(
      "w-[44px] h-[44px] rounded-full flex items-center justify-center flex-shrink-0 bg-white dark:bg-slate-900 border shadow-sm select-none overflow-hidden",
      p === 'Google' && 'border-blue-100 dark:border-blue-900/50',
      p === 'OpenAI' && 'border-emerald-100 dark:border-emerald-900/50',
      p === 'Anthropic' && 'border-amber-100 dark:border-amber-900/50',
      p === 'Meta' && 'border-sky-100 dark:border-sky-900/50',
      p === 'DeepSeek' && 'border-purple-100 dark:border-purple-900/50',
      p === 'NVIDIA' && 'border-green-100 dark:border-green-900/50',
      p === 'Compare' && 'border-indigo-100 dark:border-indigo-900/50',
      p === 'Qwen3' && 'border-indigo-100 dark:border-indigo-900/50',
      p === 'ElevenLabs' && 'border-emerald-100 dark:border-emerald-900/50',
      p === 'Black Forest Labs' && 'border-violet-100 dark:border-violet-900/50',
      p === 'Poolside' && 'border-blue-100 dark:border-blue-900/50',
      p === 'Grok' && 'border-zinc-200 dark:border-zinc-700',
      p === 'AI' && 'border-gray-200 dark:border-slate-700'
    )}>
      {p === 'Anthropic' ? (
        <svg className="w-8 h-8 text-[#d97757] animate-fade-in" viewBox="0 0 16 16" fill="currentColor">
          <path d="m3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212"/>
        </svg>
      ) : domain && !imgError ? (
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
          alt={p}
          className="w-7 h-7 object-contain"
          onError={() => setImgError(true)}
        />
      ) : p === 'Compare' ? (
        <div className={clsx("w-full h-full flex items-center justify-center", style.bg, style.text)}>
          <Scale className="w-5.5 h-5.5" />
        </div>
      ) : (
        <div className={clsx("w-full h-full flex items-center justify-center font-bold text-sm", style.bg, style.text)}>
          <Bot className="w-5.5 h-5.5" />
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatInterface({
  conversationId,
  initialMessages = [],
  initialModel = 'google/gemini-2.5-flash-lite',
  onConversationCreated,
  placeholder = 'Type a message...',
}: Props) {
  const { t, language } = useAppPreferences();

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  // Uncontrolled input — avoids re-rendering the whole component on every keystroke.
  // Only `hasInput` (a boolean) triggers re-renders (just for the send-button state).
  const [hasInput, setHasInput] = useState(false);
  const [model, setModel] = useState<ModelId>(
    getModel(initialModel) ? initialModel : 'google/gemini-2.5-flash-lite'
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
  const { isAdmin, setConversations, refreshConversations, setPendingNewChat, setSelectedModelName } = useApp();
  const [webSearch, setWebSearch] = useState(false);
  const [imageModel, setImageModel] = useState<ImageModelId>(IMAGE_MODELS[0].id);
  const [voiceModel, setVoiceModel] = useState<VoiceModelId>('openai/tts-1');
  const [openCategory, setOpenCategory] = useState<'chat' | 'voice' | 'image' | null>('chat');

  useEffect(() => {
    if (mode === 'voice') setOpenCategory('voice');
    else if (mode === 'generate') setOpenCategory('image');
    else if (mode === 'chat' || mode === 'presentation') setOpenCategory('chat');
  }, [mode]);
  const [imageMenuOpen, setImageMenuOpen] = useState(false);
  const imageMenuRef = useRef<HTMLDivElement>(null);
  const [openImageGroups, setOpenImageGroups] = useState<string[]>([]);
  const [openVoiceGroups, setOpenVoiceGroups] = useState<string[]>([]);
  const [soonTab, setSoonTab] = useState<string | null>(null);

  function triggerSoon(tabName: string) {
    setSoonTab(tabName);
    setTimeout(() => setSoonTab((current) => (current === tabName ? null : current)), 2200);
  }
  // Compare mode
  const [modelB, setModelB] = useState<ModelId>('google/gemini-2.5-flash-lite');
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

  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const rateDialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const { balance, setBalance, walletLoaded } = useWallet();

  // Close Plus upload menu on outside click
  useEffect(() => {
    if (!plusMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setPlusMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [plusMenuOpen]);


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

  const shouldAutoScrollRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    shouldAutoScrollRef.current = isAtBottom;
  }, []);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages]);

  // Reset state when conversationId changes to a different saved conversation,
  // or when initialMessages/initialModel props update.
  const lastIdRef = useRef(conversationId);
  useEffect(() => {
    if (conversationId !== lastIdRef.current) {
      const wasNewChat = lastIdRef.current === null;
      lastIdRef.current = conversationId;

      // If we were on a new chat (null) and just transitioned to the newly created chat ID,
      // we do NOT reset the state because the current local state has the stream results.
      if (wasNewChat && conversationId !== null) {
        return;
      }

      setMessages(initialMessages);
      setModel(
        getModel(initialModel) ? initialModel : 'google/gemini-2.5-flash-lite'
      );
      setError(null);
      setLowBalanceWarning(false);
      setAttachedImage(null);
      setAttachedFile(null);
      setMode('chat');
      setHasInput(false);
    }
  }, [conversationId, initialMessages, initialModel]);

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

  function handleMediaAttachClick() {
    setError(null);
    mediaInputRef.current?.click();
  }

  function handleMediaSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const isImage = file.type.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext);

    if (isImage) {
      const m = getModel(model);
      if (!m?.supportsVision) {
        setError(`${m?.label ?? 'This model'} can't read images. Please pick a model that supports images.`);
        return;
      }
      if (file.size > 4 * 1024 * 1024) { setError('Image must be under 4MB'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImage({ dataUrl: reader.result as string, name: file.name });
        setAttachedFile(null);
        setMode('chat');
        setError(null);
      };
      reader.readAsDataURL(file);
      return;
    }

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
      setError('Unsupported file type. Supported: Images, PDF, .txt, .md, .json, .csv, .js, .ts, .py, .html, .css');
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

  function toggleVoiceGroup(key: string) {
    setOpenVoiceGroups((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function toggleImageGroup(key: string) {
    setOpenImageGroups((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
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
  const selectedVoice = VOICE_MODELS.find((v) => v.id === voiceModel) ?? VOICE_MODELS[0];
  const selectedImage = IMAGE_MODELS.find((im) => im.id === imageModel) ?? IMAGE_MODELS[0];

  const activeProvider = mode === 'voice' 
    ? selectedVoice.provider 
    : mode === 'generate' 
    ? selectedImage.provider 
    : selectedModel.provider;

  const activeLabel = mode === 'voice' 
    ? selectedVoice.label 
    : mode === 'generate' 
    ? selectedImage.label 
    : selectedModel.label;

  const isFreeSelected = mode === 'chat' && Number(selectedModel.multiplier) === 0;
  
  const estimatedCredits = mode === 'voice'
    ? selectedVoice.credits
    : mode === 'generate'
    ? selectedImage.credits
    : creditsForTokens(model, estimatedTokens);

  const theme = providerTheme(activeProvider);
  const supportsVision = mode === 'chat' ? selectedModel.supportsVision : false;

  useEffect(() => {
    if (activeLabel) {
      setSelectedModelName(activeLabel);
    }
  }, [activeLabel, setSelectedModelName]);

  useEffect(() => {
    if (!supportsVision) {
      if (attachedImage) setAttachedImage(null);
      if (attachedFile?.kind === 'pdf') setAttachedFile(null);
    }
  }, [supportsVision, attachedImage, attachedFile]);

  useEffect(() => {
    if (modelMenuOpen) {
      setOpenGroups([]);
      setOpenVoiceGroups([]);
      setOpenImageGroups([]);
      setOpenCategory(null);
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
    shouldAutoScrollRef.current = true;
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

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
        const result = await apiFetch<{ url: string; tokensUsed: number; newBalance: number; conversationId?: string | null }>('/api/generate-image', {
          method: 'POST', body: JSON.stringify({ prompt, model: imageModel, conversationId }),
        });
        setBalance(result.newBalance);
        setMessages((prev) => prev.map((m) =>
          m.streaming ? { ...m, content: '', generatedImage: result.url, streaming: false, tokensUsed: result.tokensUsed } : m
        ));

        // If a new conversation was created, update the sidebar and navigate to it
        if (result.conversationId && !conversationId) {
          const newConv: ConversationSummary = {
            id: result.conversationId,
            title: prompt.slice(0, 60) || 'Image generation',
            model: imageModel as any,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setConversations((prevList) => [newConv, ...prevList]);
          refreshConversations();
          onConversationCreated?.(result.conversationId);
          router.replace(`/chat/${result.conversationId}`);
        }
      } catch (err) {
        const status = (err as { status?: number }).status;
        const msg = (err as Error).message || '';
        if (status === 402) setError('Insufficient tokens. Top up to continue.');
        else setError(msg || 'Image generation failed. Please try again.');
        setMessages((prev) => prev.map((m) => m.streaming ? { ...m, streaming: false, content: '' } : m));
      } finally {
        setGenerating(false);
      }
      return;
    }

    // ── Voice generation mode ────────────────────────────────────────────────
    if (mode === 'voice') {
      const text = getInput().trim();
      if (!text || generating) return;
      clearInput();
      setError(null);

      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };
      const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: 'Generating speech...', streaming: true };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setGenerating(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      try {
        // Simulate speech generation with a mock delay
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        const newBal = Math.max(0, balance - estimatedCredits);
        setBalance(newBal);

        setMessages((prev) => prev.map((m) =>
          m.streaming ? {
            ...m,
            content: `Speech generated successfully using **${selectedVoice.label}** (${selectedVoice.provider}):\n\n*(Audio output simulation)*`,
            streaming: false,
            tokensUsed: estimatedCredits,
          } : m
        ));
      } catch (err) {
        const msg = (err as Error).message || '';
        setError(msg || 'Speech generation failed. Please try again.');
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
              setMessages((prev) => {
                const updated = prev.map((m) =>
                  m.id === msgId ? { ...m, streaming: false, tokensUsed: done.tokensUsed } : m
                );
                if (done.conversationId && !conversationId) {
                  setPendingNewChat({
                    id: done.conversationId,
                    messages: updated,
                  });
                }
                return updated;
              });
              if (done.conversationId && !conversationId) {
                const newConv: ConversationSummary = {
                  id: done.conversationId,
                  title: content.slice(0, 60) || 'New conversation',
                  model: model,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                setConversations((prevList) => [newConv, ...prevList]);
                refreshConversations();
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
      // ── Presentation: call Anthropic directly via dedicated endpoint ──────
      if (isPresentation) {
        await apiStreamPresentation(content, (code, tokensUsed, newBalance) => {
          setBalance(newBalance);
          setMessages((prev) => prev.map((m) =>
            m.streaming ? { ...m, streaming: false, content: code, tokensUsed } : m
          ));
        });
        return;
      }

      // ── Chat: stream via OpenRouter ───────────────────────────────────────
      let newConvId: string | null = null;

      await apiStream(
        '/api/chat',
        {
          conversationId,
          content,
          model,
          imageUrl: imageSnapshot?.dataUrl,
          fileText: fileSnapshot?.kind === 'text' ? fileSnapshot.text : undefined,
          fileData: fileSnapshot?.kind === 'pdf' ? fileSnapshot.dataUrl : undefined,
          fileName: fileSnapshot?.kind === 'pdf' ? fileSnapshot.name : undefined,
          contextMessages: linkedContext ? linkedContext.messages : undefined,
          webSearch,
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
          setMessages((prev) => {
            const updated = prev.map((m) =>
              m.streaming ? {
                ...m,
                streaming: false,
                tokensUsed: done.tokensUsed,
                balanceExhausted: done.balanceExhausted,
              } : m
            );
            if (newConvId && !conversationId) {
              setPendingNewChat({
                id: newConvId,
                messages: updated,
              });
            }
            return updated;
          });
          if (done.balanceExhausted) setLowBalanceWarning(false);
          if (newConvId && !conversationId) {
            const newConv: ConversationSummary = {
              id: newConvId,
              title: content.slice(0, 60) || 'New conversation',
              model: model,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            setConversations((prevList) => [newConv, ...prevList]);
            refreshConversations();
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
      else if (status === 502) {
        // Strip internal error keys (e.g. "upstream_error: ") before showing to user
        const raw = (err as Error).message || '';
        const cleaned = raw.replace(/^[\w_]+:\s*/i, '');
        setError(cleaned || 'The AI provider returned an error. Please try again.');
      }
      else setError('Connection lost. The response may be incomplete.');
      setMessages((prev) => prev.map((m) => m.streaming ? { ...m, streaming: false } : m));
    } finally {
      setStreaming(false);
    }
  }, [mode, streaming, generating, model, modelB, messages, conversationId, attachedImage, attachedFile,
      linkedContext, router, setBalance, onConversationCreated, setConversations, refreshConversations, setPendingNewChat]);

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
      {/* Hidden inputs for Plus upload menu */}
      <input ref={fileInputRef} type="file" accept=".pdf,application/pdf,.txt,.md,.json,.csv,.js,.ts,.py,.html,.css" className="hidden" onChange={handleMediaSelected} />
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleMediaSelected} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleMediaSelected} />

      {/* ── Header: task selector + model ──────────────────────────────────── */}
      <div className="px-4 py-3 border-b" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="w-full space-y-2.5">

          {/* Task tabs */}
          <div className="inline-flex rounded-xl p-1 gap-1 max-w-full overflow-x-auto no-scrollbar whitespace-nowrap" style={{ background: 'var(--hover-bg)' }}>
            <button
              type="button"
              onClick={() => setMode('chat')}
              className={clsx(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors',
                mode === 'chat' ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'
              )}
            >
              <MessageSquare className="w-4 h-4 text-blue-600" /> {t('chat')}
            </button>

            {/* Image Creation */}
            <div className="relative">
              <button
                type="button"
                onClick={() => triggerSoon('image')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-400 hover:text-gray-600 dark:text-slate-500"
              >
                <Sparkles className="w-4 h-4 text-violet-400 opacity-60" /> {t('imageCreation')}
              </button>
              {soonTab === 'image' && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-lg animate-fade-in bg-gray-900 dark:bg-slate-800 border border-gray-700">
                  Soon... 🚀
                </div>
              )}
            </div>

            {/* Presentation */}
            <div className="relative">
              <button
                type="button"
                onClick={() => triggerSoon('presentation')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-400 hover:text-gray-600 dark:text-slate-500"
              >
                <LayoutTemplate className="w-4 h-4 text-teal-400 opacity-60" /> {t('presentation')}
              </button>
              {soonTab === 'presentation' && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-lg animate-fade-in bg-gray-900 dark:bg-slate-800 border border-gray-700">
                  Soon... 🚀
                </div>
              )}
            </div>

            {/* Compare */}
            <div className="relative">
              <button
                type="button"
                onClick={() => triggerSoon('compare')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-400 hover:text-gray-600 dark:text-slate-500"
              >
                <Scale className="w-4 h-4 opacity-60" /> Compare
              </button>
              {soonTab === 'compare' && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-lg animate-fade-in bg-gray-900 dark:bg-slate-800 border border-gray-700">
                  Soon... 🚀
                </div>
              )}
            </div>
          </div>

          {/* Mode-specific banners */}
          {mode === 'presentation' && (
            <div className="flex items-center gap-2 mt-2 rounded-xl border border-teal-200 bg-teal-50 dark:bg-teal-900/20 dark:border-teal-800 px-3.5 py-2.5">
              <LayoutTemplate className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
              <span className="text-xs text-teal-700 dark:text-teal-300">
                Just describe your topic naturally — no special format needed. The AI will create professional slides automatically.
              </span>
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
      <div ref={messagesRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="w-full">
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

          {messages.map((msg, index) => (
            <div key={msg.id} className={clsx(
              "w-full",
              index === 0 ? "mt-0" : (msg.role === 'user' ? "mt-6" : "mt-5")
            )}>
              {msg.role === 'user' ? (
                <div className="flex flex-col items-end gap-1.5 w-full">
                  <div className="max-w-[85%] space-y-1.5 group">
                    {msg.imagePreview && (
                      <div className="flex justify-end">
                        <img src={msg.imagePreview} alt="Attached" className="max-w-xs max-h-48 rounded-xl border border-gray-200 object-cover" />
                      </div>
                    )}
                    {msg.content && (
                      <>
                        <div dir="auto" className={clsx('text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm sm:text-[15px] md:text-base whitespace-pre-wrap leading-relaxed', theme.userBubble)}>
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
                </div>
              ) : msg.compareContent !== undefined ? (
                /* ── Compare split view ────────────────────────────────────── */
                <div className="flex flex-col items-start gap-1.5 w-full">
                  <ProviderAvatar provider="Compare" />
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
                                {side.tokens === 0 ? 'Free' : `${formatTokens(side.tokens)} credits (${formatUSD(side.tokens)})`}
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
                  {/* Light line under compare AI response */}
                  <div className="w-full border-b border-gray-300 dark:border-slate-600 mt-6" />
                </div>
              ) : (
                <div className="flex flex-col items-start gap-1.5 w-full">
                  <ProviderAvatar provider={AI_MODELS.find((m) => m.id === msg.model)?.provider} />
                  <div
                    data-role="assistant"
                    className="w-full rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm border"
                    style={{ background: 'var(--msg-assistant-bg)', borderColor: 'var(--msg-assistant-border)' }}
                  >
                    {msg.generatedImage || (msg.content?.startsWith('data:image') || msg.content?.startsWith('https://') && msg.content?.match(/\.(png|jpg|jpeg|webp|gif)($|\?)/i)) ? (
                      (() => {
                        const imgSrc = msg.generatedImage || msg.content || '';
                        const openImage = () => {
                          if (imgSrc.startsWith('data:')) {
                            // Convert base64 data URL → Blob URL so the browser can show it in a new tab
                            const [meta, b64] = imgSrc.split(',');
                            const mime = meta.split(':')[1]?.split(';')[0] ?? 'image/png';
                            const binary = atob(b64);
                            const bytes = new Uint8Array(binary.length);
                            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                            const blob = new Blob([bytes], { type: mime });
                            const blobUrl = URL.createObjectURL(blob);
                            const win = window.open(blobUrl, '_blank');
                            // Revoke after the tab has loaded the blob
                            if (win) setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
                          } else {
                            window.open(imgSrc, '_blank', 'noopener,noreferrer');
                          }
                        };
                        return (
                          <div className="space-y-2">
                            <img
                              src={imgSrc}
                              alt="Generated"
                              onClick={openImage}
                              className="rounded-xl max-w-full border border-gray-100 hover:opacity-90 transition-opacity cursor-zoom-in"
                              title="Click to open full size"
                            />
                            <button
                              onClick={openImage}
                              className="text-xs text-blue-600 hover:underline"
                            >Open full size ↗</button>
                          </div>
                        );
                      })()
                    ) : msg.isPresentation && !msg.streaming && msg.content ? (
                      <SlideViewer content={msg.content} />
                    ) : (
                      <>
                        {msg.streaming && !msg.content && (
                          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium py-1 animate-pulse">
                            <Globe className="w-4 h-4 animate-spin-slow" />
                            <span>{webSearch ? 'Searching the web and generating answer...' : 'Writing response...'}</span>
                          </div>
                        )}
                        <MarkdownMessage content={msg.content} />
                        {msg.streaming && msg.content && (
                          <span className="inline-block w-1.5 h-4 bg-blue-500 ml-0.5 animate-pulse rounded-sm align-middle" />
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
                            : `${formatTokens(msg.tokensUsed ?? msg.tokens_used ?? 0)} credits (${formatUSD(msg.tokensUsed ?? msg.tokens_used ?? 0)})`}
                        </span>
                        {!msg.generatedImage && msg.content && (
                          <button onClick={() => copyMessage(msg.id, msg.content)} title="Copy" className="ml-auto p-1 rounded transition-colors" style={{ color: 'var(--text-muted)' }}>
                            {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Light line under normal AI response */}
                  <div className="w-full border-b border-gray-300 dark:border-slate-600 mt-6" />
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
        <div className="w-full">
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

              {/* Selected Model Indicator Box directly ABOVE user input */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 shadow-2xs">
                  <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400">{t('selectedModelLabel')}:</span>
                  <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">{activeLabel}</span>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {mode !== 'compare' && (
                      <div className="relative" ref={modelMenuRef}>
                        <button
                          type="button"
                          onClick={() => setModelMenuOpen((o) => !o)}
                          aria-haspopup="listbox"
                          aria-expanded={modelMenuOpen}
                          className="flex-shrink-0 focus:outline-none transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                          title={activeLabel}
                        >
                          <ProviderAvatar provider={activeProvider} />
                        </button>

                        {modelMenuOpen && (
                          <div
                            role="listbox"
                            className="absolute z-20 bottom-full mb-2.5 left-0 w-80 max-h-[30rem] overflow-y-auto rounded-xl border shadow-lg py-1 animate-fade-in divide-y divide-gray-100 dark:divide-slate-800"
                            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                          >
                            {/* Category Accordion: Chat */}
                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => setOpenCategory(openCategory === 'chat' ? null : 'chat')}
                                className="w-full flex items-center justify-between px-3.5 py-2 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors border-0"
                              >
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="w-4 h-4 text-blue-500" />
                                  <span>Chat (Text)</span>
                                </div>
                                <ChevronDown className={clsx('w-4 h-4 transition-transform', openCategory === 'chat' && 'rotate-180')} />
                              </button>

                              {openCategory === 'chat' && (
                                <div className="bg-gray-50/50 dark:bg-slate-900/50 py-1">
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
                                            className="w-full flex items-center gap-2 px-3.5 py-2 text-left hover:bg-white/40 transition-colors border-0"
                                          >
                                            <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', pt.userBubble)} />
                                            <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{m.provider}</span>
                                            <ChevronDown className={clsx('w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ml-auto', isOpen && 'rotate-180')} />
                                          </button>
                                          {isOpen && (
                                            <button
                                              role="option"
                                              aria-selected={model === m.id}
                                              onClick={() => {
                                                selectModel(m);
                                                setMode('chat');
                                              }}
                                              className={clsx(
                                                'w-full flex items-center gap-2 px-3.5 py-2.5 text-left transition-colors border-0',
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
                                            className="w-full flex items-center gap-2 px-3.5 py-2 text-left hover:bg-white/40 transition-colors border-0"
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
                                              onClick={() => {
                                                selectModel(m);
                                                setMode('chat');
                                              }}
                                              className={clsx(
                                                'w-full flex items-center gap-2 px-3.5 py-2.5 text-left transition-colors border-0',
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

                            {/* Category Accordion: Voice */}
                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => setOpenCategory(openCategory === 'voice' ? null : 'voice')}
                                className="w-full flex items-center justify-between px-3.5 py-2 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors border-0"
                              >
                                <div className="flex items-center gap-2">
                                  <Mic className="w-4 h-4 text-emerald-500" />
                                  <span>Voice (Text to Audio)</span>
                                </div>
                                <ChevronDown className={clsx('w-4 h-4 transition-transform', openCategory === 'voice' && 'rotate-180')} />
                              </button>

                              {openCategory === 'voice' && (
                                <div className="bg-gray-50/50 dark:bg-slate-900/50 py-1">
                                  {VOICE_PROVIDERS.map((group) => {
                                    const items = VOICE_MODELS.filter((v) => v.provider === group.provider);
                                    if (items.length === 0) return null;
                                    const isOpen = openVoiceGroups.includes(group.provider);
                                    const pt = providerTheme(group.provider);
                                    return (
                                      <div key={group.provider} className={clsx('py-1', pt.groupBg, 'dark:bg-opacity-10')}>
                                        <button
                                          type="button"
                                          onClick={() => toggleVoiceGroup(group.provider)}
                                          aria-expanded={isOpen}
                                          className="w-full flex items-center gap-2 px-3.5 py-2 text-left hover:bg-white/40 transition-colors border-0"
                                        >
                                          <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', pt.userBubble)} />
                                          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{group.title}</span>
                                          <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">{items.length}</span>
                                          <ChevronDown className={clsx('w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
                                        </button>
                                        {isOpen && items.map((v) => (
                                          <button
                                            key={v.id}
                                            role="option"
                                            aria-selected={voiceModel === v.id}
                                            onClick={() => {
                                              setVoiceModel(v.id);
                                              setMode('voice');
                                              setModelMenuOpen(false);
                                            }}
                                            className={clsx(
                                              'w-full flex items-center gap-2 px-3.5 py-2.5 text-left transition-colors border-0',
                                              voiceModel === v.id ? 'bg-white shadow-sm dark:bg-slate-700' : 'hover:bg-white/60'
                                            )}
                                          >
                                            <span className="w-4 flex-shrink-0 flex items-center justify-center">
                                              {voiceModel === v.id ? <Check className="w-4 h-4 text-blue-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{v.label}</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                                  {v.quality}
                                                </span>
                                              </div>
                                              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {v.provider} · {formatTokens(v.credits)} tokens
                                              </div>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Category Accordion: Images */}
                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => setOpenCategory(openCategory === 'image' ? null : 'image')}
                                className="w-full flex items-center justify-between px-3.5 py-2 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors border-0"
                              >
                                <div className="flex items-center gap-2">
                                  <Sparkles className="w-4 h-4 text-violet-500" />
                                  <span>Images (Text to Image)</span>
                                </div>
                                <ChevronDown className={clsx('w-4 h-4 transition-transform', openCategory === 'image' && 'rotate-180')} />
                              </button>

                              {openCategory === 'image' && (
                                <div className="bg-gray-50/50 dark:bg-slate-900/50 py-1">
                                  {IMAGE_PROVIDERS.map((group) => {
                                    const items = IMAGE_MODELS.filter((im) => im.provider === group.provider);
                                    if (items.length === 0) return null;
                                    const isOpen = openImageGroups.includes(group.provider);
                                    const pt = providerTheme(group.provider);
                                    return (
                                      <div key={group.provider} className={clsx('py-1', pt.groupBg, 'dark:bg-opacity-10')}>
                                        <button
                                          type="button"
                                          onClick={() => toggleImageGroup(group.provider)}
                                          aria-expanded={isOpen}
                                          className="w-full flex items-center gap-2 px-3.5 py-2 text-left hover:bg-white/40 transition-colors border-0"
                                        >
                                          <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', pt.userBubble)} />
                                          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{group.title}</span>
                                          <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">{items.length}</span>
                                          <ChevronDown className={clsx('w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
                                        </button>
                                        {isOpen && items.map((im) => (
                                          <button
                                            key={im.id}
                                            role="option"
                                            aria-selected={imageModel === im.id}
                                            onClick={() => {
                                              setImageModel(im.id);
                                              setMode('generate');
                                              setModelMenuOpen(false);
                                            }}
                                            className={clsx(
                                              'w-full flex items-center gap-2 px-3.5 py-2.5 text-left transition-colors border-0',
                                              imageModel === im.id ? 'bg-white shadow-sm dark:bg-slate-700' : 'hover:bg-white/60'
                                            )}
                                          >
                                            <span className="w-4 flex-shrink-0 flex items-center justify-center">
                                              {imageModel === im.id ? <Check className="w-4 h-4 text-blue-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{im.label}</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400">
                                                  {im.quality}
                                                </span>
                                              </div>
                                              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {im.provider} · {formatTokens(im.credits)} tokens
                                              </div>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {mode === 'chat' && (
                              <div className="border-t mt-1 pt-1.5 px-3 pb-1 text-center border-gray-100 dark:border-slate-800">
                                <a href="/pricing" className="text-xs text-blue-600 hover:underline">View full pricing →</a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <textarea
                      ref={textareaRef}
                      onChange={(e) => { setHasInput(e.target.value.trim().length > 0); autoResize(); }}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        isPresentationMode
                          ? t('describePresentation')
                          : isGenerateMode
                          ? 'Describe the image you want to generate...'
                          : mode === 'voice'
                          ? 'Type text to generate speech...'
                          : attachedImage
                          ? 'What would you like to know about this image?'
                          : attachedFile
                          ? 'Ask a question about this file...'
                          : placeholder
                      }
                      rows={1}
                      className={clsx('flex-1 border rounded-xl px-4 py-3 text-[15px] sm:text-base resize-none focus:outline-none focus:ring-2', theme.focusRing)}
                      style={{
                        minHeight: '44px',
                        background: 'var(--input-bg)',
                        borderColor: 'var(--input-border)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>

                  {/* Bottom toolbar */}
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                     {!isGenerateMode && !isPresentationMode && mode !== 'voice' && (
                      <div className="relative" ref={plusMenuRef}>
                        <button
                          onClick={() => setPlusMenuOpen((v) => !v)}
                          title="Add attachment"
                          className={clsx(
                            'w-8 h-8 rounded-xl flex items-center justify-center transition-all border shadow-xs',
                            (attachedImage || attachedFile || plusMenuOpen)
                              ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
                              : 'border-gray-200 hover:bg-gray-100 dark:border-slate-600 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300'
                          )}
                        >
                          <Plus className={clsx('w-4 h-4 transition-transform duration-200', plusMenuOpen && 'rotate-45')} />
                        </button>

                        {/* Dropdown Menu */}
                        {plusMenuOpen && (
                          <div
                            className="absolute z-30 bottom-full mb-2 left-0 w-56 rounded-xl border shadow-xl py-1 animate-fade-in divide-y divide-gray-100 dark:divide-slate-800"
                            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                          >
                            <div className="py-1">
                              <button
                                onClick={() => { setPlusMenuOpen(false); fileInputRef.current?.click(); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                <span>{t('pickFile')}</span>
                              </button>

                              <button
                                onClick={() => { setPlusMenuOpen(false); galleryInputRef.current?.click(); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                <ImageIcon className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                <span>{t('pickGallery')}</span>
                              </button>

                              <button
                                onClick={() => { setPlusMenuOpen(false); cameraInputRef.current?.click(); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                <Camera className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                <span>{t('openCamera')}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Feature 3: Voice input button */}
                    {!isGenerateMode && mode !== 'voice' && (
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


                    {/* Web Search toggle */}
                    {!isGenerateMode && !isPresentationMode && mode !== 'voice' && (
                      <button
                        type="button"
                        onClick={() => setWebSearch((v) => !v)}
                        title={webSearch ? 'Web search enabled — click to disable' : 'Enable web search'}
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border shadow-sm',
                          webSearch
                            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                            : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'
                        )}
                      >
                        <Globe className={clsx('w-3.5 h-3.5', webSearch && 'animate-spin-slow text-white')} />
                        <span>{webSearch ? 'Web Search 🌐 (Enabled)' : 'Web Search'}</span>
                      </button>
                    )}

                    {/* Feature 5: Link context conversation */}
                    {!isGenerateMode && mode !== 'voice' && (
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
                    {hasInput && mode !== 'compare' && (
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
                  {ratePopup.multiplier === CHEAPEST_PAID_MODEL.multiplier ? 'baseline rate — cheapest paid model' : `compared to ${CHEAPEST_PAID_MODEL.label}`}
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="px-5 pb-5 space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <p>
                {ratePopup.multiplier === CHEAPEST_PAID_MODEL.multiplier
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
