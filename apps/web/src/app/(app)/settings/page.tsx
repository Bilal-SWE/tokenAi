'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Lock, Trash2, Loader2, Check, Sun, Moon, Monitor, Globe, Palette } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppPreferences } from '@/context/AppPreferencesContext';
import type { Theme, Language } from '@/context/AppPreferencesContext';
import clsx from 'clsx';

export default function SettingsPage() {
  const router = useRouter();
  const { theme, language, setTheme, setLanguage, t } = useAppPreferences();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setEmail(user.email || '');
      setFullName(user.user_metadata?.full_name || '');
    }
    load();
  }, [router]);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess(false);
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    if (error) setProfileError(error.message);
    else { setProfileSuccess(true); setTimeout(() => setProfileSuccess(false), 3000); }
    setProfileLoading(false);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return; }
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters'); return; }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setPasswordError(error.message);
    else {
      setPasswordSuccess(true);
      setNewPassword(''); setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
    setPasswordLoading(false);
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE') return;
    setDeleteLoading(true);
    await supabase.auth.signOut();
    router.push('/');
  }

  const themeOptions: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: 'light',  icon: <Sun className="w-4 h-4" />,     label: t('light') },
    { value: 'dark',   icon: <Moon className="w-4 h-4" />,    label: t('dark') },
    { value: 'system', icon: <Monitor className="w-4 h-4" />, label: t('system') },
  ];

  const langOptions: { value: Language; label: string; native: string }[] = [
    { value: 'en', label: 'English',  native: 'English' },
    { value: 'ar', label: 'Arabic',   native: 'العربية' },
  ];

  const cardStyle = { background: 'var(--card-bg)', borderColor: 'var(--card-border)' };
  const inputStyle = { background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-primary)' };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Account settings</h1>

      {/* ── Appearance ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border p-6" style={cardStyle}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center">
            <Palette className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('appearance')}</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Choose your theme and interface language</p>
          </div>
        </div>

        {/* Theme */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('theme')}</label>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={clsx(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                  theme === opt.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-transparent hover:border-gray-300 dark:hover:border-slate-600'
                )}
                style={{ background: theme === opt.value ? undefined : 'var(--hover-bg)' }}
              >
                <div className={clsx('p-2 rounded-lg', theme === opt.value ? 'bg-blue-100 dark:bg-blue-800 text-blue-600' : 'text-gray-400')}>
                  {opt.icon}
                </div>
                <span className={clsx('text-sm font-medium', theme === opt.value ? 'text-blue-700 dark:text-blue-300' : '')}
                  style={{ color: theme === opt.value ? undefined : 'var(--text-secondary)' }}>
                  {opt.label}
                </span>
                {theme === opt.value && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('language')}</label>
          <div className="grid grid-cols-2 gap-2">
            {langOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLanguage(opt.value)}
                className={clsx(
                  'flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                  language === opt.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-transparent hover:border-gray-300 dark:hover:border-slate-600'
                )}
                style={{ background: language === opt.value ? undefined : 'var(--hover-bg)' }}
              >
                <Globe className={clsx('w-5 h-5', language === opt.value ? 'text-blue-600' : 'text-gray-400')} />
                <div className="text-left">
                  <div className={clsx('text-sm font-semibold', language === opt.value ? 'text-blue-700 dark:text-blue-300' : '')}
                    style={{ color: language === opt.value ? undefined : 'var(--text-primary)' }}>
                    {opt.native}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{opt.label}</div>
                </div>
                {language === opt.value && <Check className="w-3.5 h-3.5 text-blue-600 ml-auto" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Profile ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border p-6" style={cardStyle}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Profile</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Update your display name</p>
          </div>
        </div>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full border rounded-lg px-3 py-2 text-sm cursor-not-allowed"
              style={{ ...inputStyle, opacity: 0.6 }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Email cannot be changed</p>
          </div>
          {profileError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{profileError}</p>}
          {profileSuccess && (
            <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Profile updated
            </p>
          )}
          <button
            type="submit"
            disabled={profileLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors flex items-center gap-2"
          >
            {profileLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save changes
          </button>
        </form>
      </div>

      {/* ── Password ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border p-6" style={cardStyle}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center">
            <Lock className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Change password</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Update your account password</p>
          </div>
        </div>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={inputStyle}
            />
          </div>
          {passwordError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{passwordError}</p>}
          {passwordSuccess && (
            <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Password updated
            </p>
          )}
          <button
            type="submit"
            disabled={passwordLoading || !newPassword}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors flex items-center gap-2"
          >
            {passwordLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Update password
          </button>
        </form>
      </div>

      {/* ── Danger zone ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-red-200 dark:border-red-800 p-6" style={{ background: 'var(--card-bg)' }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center justify-center">
            <Trash2 className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Delete account</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Permanently remove your account and all data</p>
          </div>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          This action is <strong>irreversible</strong>. All your conversations, wallet balance, and data will be permanently deleted.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Type <strong>DELETE</strong> to confirm
          </label>
          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            style={inputStyle}
          />
        </div>
        <button
          onClick={handleDeleteAccount}
          disabled={deleteConfirm !== 'DELETE' || deleteLoading}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors flex items-center gap-2"
        >
          {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          Delete my account
        </button>
      </div>
    </div>
  );
}
