import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Save } from 'lucide-react';
import { authFetch } from '../../lib/api';

interface Profile {
  id: number;
  email: string;
  first_name: string;
}

export const ProfileSection: React.FC = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');

  useEffect(() => {
    authFetch('/api/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setProfile(data);
          setName(data.first_name || '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameMessage('');
    setNameSaving(true);
    try {
      const res = await authFetch('/api/me', {
        method: 'PUT',
        body: JSON.stringify({ first_name: name.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile((p) => (p ? { ...p, first_name: data.first_name } : null));
        setNameMessage('Name saved.');
      } else {
        setNameMessage(data.error || 'Failed to save');
      }
    } catch {
      setNameMessage('Failed to save');
    } finally {
      setNameSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage('');
    if (newPassword !== confirmPassword) {
      setPasswordMessage('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage('New password must be at least 8 characters');
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await authFetch('/api/me/password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMessage('Password changed.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMessage(data.error || 'Failed to change password');
      }
    } catch {
      setPasswordMessage('Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface rounded-card border border-border shadow-card p-8 animate-pulse">
        <div className="h-6 bg-surfaceElevated rounded w-1/3 mb-6" />
        <div className="h-4 bg-surfaceElevated rounded w-2/3 mb-4" />
        <div className="h-10 bg-surfaceElevated rounded w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-surface rounded-card border border-border shadow-card p-8">
        <p className="text-muted">Could not load profile.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <User className="w-5 h-5 text-primary" /> Profile
        </h2>
        <p className="text-muted text-sm mt-1">Your account and password</p>
      </div>

      <div className="p-6 space-y-8">
        {/* Email (read-only) */}
        <div>
          <label className="block text-sm font-medium text-muted mb-2">Your email</label>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surfaceElevated border border-border">
            <Mail className="w-4 h-4 text-muted shrink-0" />
            <span className="text-foreground font-mono text-sm">{profile.email}</span>
          </div>
          <p className="text-muted text-xs mt-1">This is the email you use to sign in. It cannot be changed here.</p>
        </div>

        {/* Name */}
        <form onSubmit={handleSaveName} className="space-y-3">
          <label htmlFor="profile-name" className="block text-sm font-medium text-muted">Name</label>
          <div className="flex gap-3">
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <button
              type="submit"
              disabled={nameSaving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary-glow transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" /> {nameSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {nameMessage && (
            <p className={`text-sm ${nameMessage === 'Name saved.' ? 'text-primary' : 'text-red-400'}`}>{nameMessage}</p>
          )}
        </form>

        {/* Change password */}
        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-primary" /> Change password
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium text-muted mb-1">Current password</label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-muted mb-1">New password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-muted mb-1">Confirm new password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={passwordSaving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary-glow transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" /> {passwordSaving ? 'Saving…' : 'Change password'}
            </button>
            {passwordMessage && (
              <p className={`text-sm ${passwordMessage === 'Password changed.' ? 'text-primary' : 'text-red-400'}`}>{passwordMessage}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
