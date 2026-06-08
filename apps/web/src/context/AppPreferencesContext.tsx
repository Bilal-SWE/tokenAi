'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type Language = 'en' | 'ar';

const translations = {
  en: {
    newChat: 'New Chat',
    chat: 'Chat',
    imageCreation: 'Image creation',
    presentation: 'Presentation',
    typeMessage: 'Type a message...',
    continueConversation: 'Continue the conversation...',
    uploadImage: 'Upload image',
    uploadFile: 'Upload file',
    voice: 'Voice',
    listening: 'Listening...',
    addContext: 'Add context',
    settings: 'Settings',
    signOut: 'Sign out',
    wallet: 'Wallet',
    theme: 'Theme',
    language: 'Language',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    english: 'English',
    arabic: 'العربية',
    appearance: 'Appearance',
    quoteReply: 'Quote & Reply',
    chooseTemplate: 'Choose a template',
    generatePresentation: 'Generate presentation',
    describePresentation: 'Describe your presentation topic...',
    contextLinked: 'Context linked',
    removeContext: 'Remove context',
    selectConversation: 'Select a conversation for context',
    deleteConversation: 'Delete conversation',
    confirmDelete: 'Confirm?',
    cancel: 'Cancel',
    startConversation: 'Start a conversation',
    chooseModelAndType: 'Choose a model above and type a message below',
  },
  ar: {
    newChat: 'محادثة جديدة',
    chat: 'محادثة',
    imageCreation: 'إنشاء صورة',
    presentation: 'عرض تقديمي',
    typeMessage: 'اكتب رسالة...',
    continueConversation: 'واصل المحادثة...',
    uploadImage: 'رفع صورة',
    uploadFile: 'رفع ملف',
    voice: 'صوت',
    listening: 'جارٍ الاستماع...',
    addContext: 'إضافة سياق',
    settings: 'الإعدادات',
    signOut: 'تسجيل الخروج',
    wallet: 'المحفظة',
    theme: 'المظهر',
    language: 'اللغة',
    light: 'فاتح',
    dark: 'داكن',
    system: 'النظام',
    english: 'English',
    arabic: 'العربية',
    appearance: 'المظهر',
    quoteReply: 'رد على التحديد',
    chooseTemplate: 'اختر قالباً',
    generatePresentation: 'إنشاء عرض تقديمي',
    describePresentation: 'صف موضوع العرض التقديمي...',
    contextLinked: 'السياق مرتبط',
    removeContext: 'إزالة السياق',
    selectConversation: 'اختر محادثة كسياق',
    deleteConversation: 'حذف المحادثة',
    confirmDelete: 'تأكيد؟',
    cancel: 'إلغاء',
    startConversation: 'ابدأ محادثة',
    chooseModelAndType: 'اختر نموذجاً واكتب رسالة',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

interface AppPreferences {
  theme: Theme;
  language: Language;
  isDark: boolean;
  setTheme: (t: Theme) => void;
  setLanguage: (l: Language) => void;
  t: (key: TranslationKey) => string;
}

const Ctx = createContext<AppPreferences>({
  theme: 'light',
  language: 'en',
  isDark: false,
  setTheme: () => {},
  setLanguage: () => {},
  t: (key) => translations.en[key],
});

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [language, setLanguageState] = useState<Language>('en');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = (localStorage.getItem('tokenai-theme') as Theme) || 'light';
    const savedLang = (localStorage.getItem('tokenai-language') as Language) || 'en';
    setThemeState(savedTheme);
    setLanguageState(savedLang);
  }, []);

  useEffect(() => {
    function applyTheme() {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const dark = theme === 'dark' || (theme === 'system' && systemDark);
      setIsDark(dark);
      document.documentElement.classList.toggle('dark', dark);
    }
    applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem('tokenai-theme', t);
  }, []);

  const setLanguage = useCallback((l: Language) => {
    setLanguageState(l);
    localStorage.setItem('tokenai-language', l);
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return translations[language][key] ?? translations.en[key];
  }, [language]);

  return (
    <Ctx.Provider value={{ theme, language, isDark, setTheme, setLanguage, t }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAppPreferences() {
  return useContext(Ctx);
}
