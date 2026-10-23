import { useState, useEffect } from 'react';
import { pupil } from '@/api/pupilClient';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ModelLab() {
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState(false);
  async function load() {
    try { setRuns(await pupil.entities.ModelRun.list('-created_date', 30)); }
    catch (error) { toast.error(error.message); }
  }
  useEffect(() => { load(); }, []);
  async function review(run, status, allowed) {
    setBusy(true);
    try {
      const { data } = await pupil.functions.invoke('reviewModelRun', { run_id: run.id, review: status, training_allowed: allowed });
      if (data.error) throw new Error(data.error);
      await load();
    } catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  }
  async function download() {
    setBusy(true);
    try {
      const { data } = await pupil.functions.invoke('exportTrainingDataset');
      if (data.error) throw new Error(data.error);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `perfect-pupil-dataset-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Exported ${data.manifest.training_examples} training and ${data.manifest.evaluation_examples} evaluation examples.`);
    } catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Learning lab</h2><p className="text-sm text-slate-500">Review responses before including them in a training dataset.</p></div><div className="flex gap-2"><Button variant="outline" onClick={load}>Refresh</Button><Button onClick={download} disabled={busy}>Export approved dataset</Button></div></div>
    <p className="text-sm bg-slate-50 border rounded-xl p-4">Training is optional and does not run automatically. Export includes the selected responses and their full input context, including saved memories. Keep exports private. Sessions stay together in train/evaluation splits; at least two sessions are needed for held-out evaluation. Basic replies and fallback responses are excluded.</p>
    {!runs.length && <p className="text-slate-500">Chat with your pupil to create a run history.</p>}
    {runs.map(run => <article key={run.id} className="bg-white rounded-xl border p-4 space-y-3">
      <div className="text-xs text-slate-500">{run.provider} · {run.model || 'scripted-v1'} · {run.duration_ms} ms · {run.prompt_version} · {run.review}{run.fallback ? ' · fallback' : ''}</div>
      <p className="text-sm">{run.output?.response}</p>
      {run.response_source === 'memory_confirmation' && <p className="text-xs text-slate-500">App memory confirmation; excluded from training. Original model response: {run.model_output?.response}</p>}
      <details className="text-xs"><summary className="cursor-pointer text-violet-600">Inspect input context</summary><pre className="whitespace-pre-wrap max-h-64 overflow-auto bg-slate-50 p-3 mt-2">{JSON.stringify(run.input_context, null, 2)}</pre></details>
      {run.provider !== 'builtin' && !run.fallback && run.response_source !== 'memory_confirmation' && <><label className="flex gap-2 text-sm"><input type="checkbox" checked={run.training_allowed} disabled={busy} onChange={e => review(run, 'unreviewed', e.target.checked)} />Allow this response and its full context in training exports</label><div className="flex gap-2"><Button size="sm" disabled={busy || !run.training_allowed} onClick={() => review(run, 'approved', true)}>Approve</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => review(run, 'rejected', run.training_allowed)}>Reject</Button></div></>}
    </article>)}
  </section>;
}
