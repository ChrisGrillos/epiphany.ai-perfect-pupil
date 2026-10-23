import { useState } from 'react';
import { Cpu, Cloud, Server, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { pupil } from '@/api/pupilClient';
import { toast } from 'sonner';

const PROVIDERS = [
  { id: 'builtin', name: 'Basic companion', icon: Cpu, description: 'Scripted replies. No model, download, or network connection.' },
  { id: 'local', name: 'Local model', icon: Server, description: 'Connect llama.cpp, LM Studio, or another compatible server on this PC.' },
  { id: 'cloud', name: 'Cloud model', icon: Cloud, description: 'Use an HTTPS service with a compatible chat completions API.' },
];

export default function AIProviderSetup({ currentConfig, onSave }) {
  const [form, setForm] = useState({ provider_name: currentConfig?.provider_name || 'builtin', api_endpoint: currentConfig?.api_endpoint || 'http://127.0.0.1:8080/v1', model_name: currentConfig?.model_name || '', api_key: '', allow_cloud: currentConfig?.allow_cloud || false, fallback_to_default: currentConfig?.fallback_to_default ?? true, context_chars: currentConfig?.context_chars || 12000, max_output_tokens: currentConfig?.max_output_tokens || 512, temperature: currentConfig?.temperature ?? 0.3, structured_output: currentConfig?.structured_output || 'json_object', clear_api_key: false });
  const [busy, setBusy] = useState(false);
  const update = patch => setForm(value => ({ ...value, ...patch }));
  async function save(event) {
    event.preventDefault(); setBusy(true);
    try { await onSave(form); update({ api_key: '', clear_api_key: false }); toast.success('Model settings saved'); }
    catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  }
  async function test() {
    setBusy(true);
    try {
      const response = await pupil.functions.invoke('testAIProvider');
      if (response.data.error) throw new Error(response.data.error);
      toast.success(response.data.message);
    } catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-6">
    <div className="grid md:grid-cols-3 gap-3" role="group" aria-label="Model provider">
      {PROVIDERS.map(provider => <button key={provider.id} type="button" aria-pressed={form.provider_name === provider.id} onClick={() => update({ provider_name: provider.id, api_key: '', allow_cloud: false, model_name: provider.id === currentConfig?.provider_name ? currentConfig.model_name : '', api_endpoint: provider.id === currentConfig?.provider_name ? currentConfig.api_endpoint : provider.id === 'local' ? 'http://127.0.0.1:8080/v1' : '' })} className={`p-4 text-left rounded-2xl border-2 ${form.provider_name === provider.id ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white'}`}>
        <provider.icon className="w-5 h-5 text-violet-600 mb-3" /><strong>{provider.name}</strong><p className="text-sm text-slate-500 mt-2">{provider.description}</p>
      </button>)}
    </div>
    {form.provider_name !== 'builtin' && <div className="bg-white rounded-2xl border p-5 space-y-4">
      <div><Label htmlFor="api-endpoint">API base URL</Label><Input id="api-endpoint" type="url" required value={form.api_endpoint} onChange={e => update({ api_endpoint: e.target.value })} placeholder="http://127.0.0.1:8080/v1" /></div>
      <div><Label htmlFor="model-id">Model ID</Label><Input id="model-id" required value={form.model_name} onChange={e => update({ model_name: e.target.value })} placeholder="Exact model ID from your model server" /></div>
      <div><Label htmlFor="api-key">API key (optional for local models)</Label><Input id="api-key" type="password" autoComplete="off" value={form.api_key} onChange={e => update({ api_key: e.target.value })} placeholder={currentConfig?.has_api_key ? 'Saved key; leave blank to keep' : 'Enter a key if your server requires it'} /><p className="text-xs text-slate-500 mt-1">Saved credentials are protected by your Windows account using DPAPI.</p></div>
      {currentConfig?.has_api_key && <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.clear_api_key} onChange={e => update({ clear_api_key: e.target.checked })} />Remove saved key</label>}
      {form.provider_name === 'cloud' && <label className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 text-sm"><input type="checkbox" required checked={form.allow_cloud} onChange={e => update({ allow_cloud: e.target.checked })} /><span>Allow this cloud provider to process my messages, companion identity, selected memories, and recent conversation history. Its terms and charges apply.</span></label>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div><Label htmlFor="context-budget">Context budget (characters)</Label><Input id="context-budget" type="number" min="4000" max="48000" value={form.context_chars} onChange={e => update({ context_chars: Number(e.target.value) })} /></div>
        <div><Label htmlFor="output-budget">Maximum output tokens</Label><Input id="output-budget" type="number" min="128" max="2048" value={form.max_output_tokens} onChange={e => update({ max_output_tokens: Number(e.target.value) })} /></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><Label htmlFor="model-temperature">Temperature</Label><Input id="model-temperature" type="number" min="0" max="2" step="0.1" value={form.temperature} onChange={e => update({ temperature: Number(e.target.value) })} /></div>
        <div><Label htmlFor="structured-output">Response format</Label><select id="structured-output" className="w-full h-10 rounded-md border bg-white px-3 text-sm" value={form.structured_output} onChange={e => update({ structured_output: e.target.value })}><option value="json_object">JSON object (compatible servers)</option><option value="json_schema">Strict JSON schema (managed local model)</option></select></div>
      </div>
      <label className="flex gap-3 text-sm"><input type="checkbox" checked={form.fallback_to_default} onChange={e => update({ fallback_to_default: e.target.checked })} />Use clearly labelled basic replies if the model fails. Fallback never switches to a cloud service.</label>
    </div>}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy} className="bg-violet-600 hover:bg-violet-700"><Check className="w-4 h-4 mr-2" />{busy ? 'Working…' : 'Save configuration'}</Button><Button type="button" variant="outline" disabled={busy} onClick={test}>Test saved connection</Button></div>
  </form>;
}
