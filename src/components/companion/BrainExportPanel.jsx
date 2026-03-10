import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, Upload, Brain, Loader2, Lock, FileJson } from 'lucide-react';

export default function BrainExportPanel({ companion, subscription }) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const tier = subscription?.tier || 'free';
  const isPaid = tier !== 'free';

  const handleExport = async () => {
    if (!companion?.id) return;
    const passphrase = window.prompt('Enter an export passphrase (minimum 8 characters):');
    if (!passphrase) return;
    if (passphrase.length < 8) {
      toast.error('Passphrase must be at least 8 characters.');
      return;
    }
    setExporting(true);

    const response = await base44.functions.invoke('exportBrain', {
      companion_id: companion.id,
      passphrase
    });

    if (response.data.error) {
      toast.error(response.data.error);
      setExporting(false);
      return;
    }

    // Download as .pupilbrain (JSON) file
    const blob = new Blob(
      [JSON.stringify(response.data.brain_package, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companion.name}_brain.pupilbrain`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`${companion.name}'s encrypted brain backup was exported successfully.`);
    setExporting(false);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !companion?.id) return;
    setImporting(true);

    const text = await file.text();
    let brainData;
    try {
      brainData = JSON.parse(text);
    } catch {
      toast.error('Invalid brain file. Please select a valid .pupilbrain file.');
      setImporting(false);
      return;
    }

    const passphrase = window.prompt('Enter the passphrase used for this backup:');
    if (!passphrase) {
      setImporting(false);
      e.target.value = '';
      return;
    }

    const response = await base44.functions.invoke('importBrain', {
      companion_id: companion.id,
      brain_package: brainData,
      passphrase
    });

    if (response.data.error) {
      toast.error(response.data.error);
    } else {
      toast.success(`Encrypted brain backup imported to ${companion.name}!`);
    }

    setImporting(false);
    e.target.value = '';
  };

  return (
    <Card className="bg-white rounded-3xl border border-slate-200 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-6 h-6 text-violet-500" />
          <h3 className="font-semibold text-slate-800">Brain Export / Import</h3>
          {isPaid ? (
            <Badge className="bg-emerald-100 text-emerald-700">Available</Badge>
          ) : (
            <Badge className="bg-slate-100 text-slate-500">Paid Only</Badge>
          )}
        </div>

        <p className="text-sm text-slate-500 mb-4">
          Save your companion's memories, personality, behavior rules, and evolution history in an encrypted local backup.
          Import with the same passphrase to restore.
        </p>

        {!isPaid ? (
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl text-sm text-slate-500">
            <Lock className="w-5 h-5 flex-shrink-0" />
            <span>Upgrade to Basic or higher to export and import brain data.</span>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="flex-1 bg-violet-600 hover:bg-violet-700"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {exporting ? 'Exporting...' : 'Export Brain'}
            </Button>

            <label className="flex-1">
              <input
                type="file"
                accept=".pupilbrain,.json"
                onChange={handleImport}
                className="hidden"
                disabled={importing}
              />
              <Button
                asChild
                disabled={importing}
                variant="outline"
                className="w-full cursor-pointer"
              >
                <span>
                  {importing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {importing ? 'Importing...' : 'Import Brain'}
                </span>
              </Button>
            </label>
          </div>
        )}

        {isPaid && (
          <div className="mt-4 p-3 bg-violet-50 rounded-lg">
            <p className="text-xs text-violet-600">
              <FileJson className="w-3 h-3 inline mr-1" />
              Files use the <strong>.pupilbrain</strong> format. 
              Export includes encrypted memories, behavior rules, chat history, evolution data, trait affinity, and algorithm state.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
