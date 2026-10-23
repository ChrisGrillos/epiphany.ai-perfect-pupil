import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { pupil } from '@/api/pupilClient';
import AIProviderSetup from '@/components/customization/AIProviderSetup';
import ModelLab from '@/components/customization/ModelLab';

export default function AISettings() {
  const [config, setConfig] = useState(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    pupil.entities.AIProviderConfig.list().then(rows => setConfig(rows.find(row => row.is_active) || null)).catch(error => setError(error.message));
  }, []);
  async function save(form) {
    const { data } = await pupil.functions.invoke('saveAIProviderConfig', form);
    if (data.error) throw new Error(data.error);
    setConfig(data.config);
  }
  return <main className="max-w-5xl mx-auto p-6 space-y-8">
    <Link to="/Home" className="text-violet-600">← Back to your pupil</Link>
    <div><h1 className="text-3xl font-bold text-slate-800">Your pupil’s intelligence</h1><p className="text-slate-500 mt-2">Choose where conversations run. Local data stays on this PC unless you enable a cloud model or export it.</p></div>
    {error && <p role="alert">{error}</p>}
    {config === undefined ? <p>Loading model settings…</p> : <AIProviderSetup key={config?.id || 'new'} currentConfig={config} onSave={save} />}
    <ModelLab />
  </main>;
}
