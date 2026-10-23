import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { request } from '@/api/pupilClient';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { request('/api/settings').then(setSettings).catch(error => setError(error.message)); }, []);
  return <main className="max-w-3xl mx-auto p-6 space-y-6">
    <Link to="/Home" className="text-violet-600">← Back to your pupil</Link>
    <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
    {error && <p role="alert">{error}</p>}
    <section className="bg-white rounded-2xl border p-6 space-y-3"><h2 className="text-xl font-semibold">Local edition</h2><p>All companion features are available on this device. There is no subscription or simulated checkout. Cloud model services may charge separately.</p><Link to="/AISettings" className="inline-block text-violet-600 underline">Manage models and training data</Link></section>
    <section className="bg-white rounded-2xl border p-6 space-y-3"><h2 className="text-xl font-semibold">Storage and privacy</h2><p>Companions, conversations, and memories are stored in a local SQLite database. The database is not encrypted; protect your Windows account and disk.</p><p className="text-sm break-all">{settings?.data_path}</p><p>Saved API keys use {settings?.credential_protection || 'Windows account protection'}. Brain exports are encrypted with your chosen passphrase. Training exports contain readable conversation context.</p></section>
    <section className="bg-white rounded-2xl border p-6 space-y-3"><h2 className="text-xl font-semibold">Backup</h2><p>Use the brain export panel on Home for a portable encrypted companion package. For a complete backup, stop the app and copy the PerfectPupil data folder, including the database and any WAL files. Saved credentials are tied to this Windows account.</p></section>
  </main>;
}
