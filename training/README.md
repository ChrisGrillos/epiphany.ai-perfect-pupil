# Optional distillation and adapter training

The app runs without this environment. Nothing in this folder is invoked by
chat, care actions, XP, evolution, or an app restart.

## Workflow

1. Connect a teacher model whose terms permit your intended use of its outputs.
   Have representative conversations across distinct sessions. Training consent
   includes their complete model input context, including retrieved memories.
2. In the Learning lab, inspect context and responses, enable consent, and
   approve useful examples. Reject errors. Export the reviewed dataset bundle.
   App-generated memory confirmations are excluded; the original model output
   remains visible for review but is not exported as a training target.
3. Choose a small student/base model with a compatible chat template and a
   license permitting adaptation. Record a full pinned repository commit SHA.
4. Run preflight in a separate Python environment. It verifies dataset hashes,
   provenance, train/evaluation separation, disk space and available CUDA VRAM.
   It does not download models.
5. Explicitly run adapter training when hardware permits, evaluate the candidate,
   then serve it with your chosen local inference engine. Keep the previous
   model available for rollback and select the new model ID in the app.

This implements **response-based distillation / supervised LoRA adaptation**.
It does not collect teacher logits or implement full-logit knowledge
distillation, full-model pretraining, or continual automatic retraining.

## Separate environment

Use a supported Python environment for your chosen CUDA/PyTorch stack. Install
the appropriate PyTorch build separately, then install `requirements.txt`.
Use a compatible bitsandbytes build only if using `--four-bit`. Requirements
are compatibility ranges, not a reproduced training lockfile. Record/pin the
actual environment for any model you intend to distribute.

```powershell
python -m venv training/.venv
training/.venv/Scripts/Activate.ps1
# Install a hardware-compatible PyTorch CUDA build first.
python -m pip install -r training/requirements.txt

python training/train_adapter.py --dataset path/to/export.json `
  --base-model organization/student-model --revision FULL_40_CHARACTER_COMMIT_SHA `
  --preflight
```

To start a training job, supply **`--train`** instead of `--preflight`; optionally
add `--four-bit`, a fresh `--output` directory, and an appropriate
`--max-length`. The trainer masks prompt tokens so loss targets only the final
assistant response. It rejects overlong examples and incompatible chat-template
boundaries instead of silently truncating the target. Existing output folders
are never overwritten. `trust_remote_code` is disabled.

The default gate requires **6 GiB free CUDA VRAM** and 15 GiB free disk. Passing
the gate does not guarantee a run fits. The inspected RTX 2050 has 4 GiB VRAM,
so the default training gate intentionally blocks it. Experts can explicitly
lower `--minimum-free-vram-gib` for small experiments; no successful training
run has been demonstrated on this machine. Inference has separate requirements.

Outputs include adapter weights, tokenizer files, held-out loss metrics and a
`pupil-model-manifest.json` marked **candidate** with dataset, model revision,
artifact hashes and settings. Loss metrics do not establish behavioral quality.

## Evaluation and release

Serve a candidate separately, select it in the app, then use:

```powershell
npm test
npm run eval:harness -- --live --output output/student-evaluation.json
```

Use the held-out conversations and manually inspect memory accuracy, personality
consistency, uncertainty, instruction handling, context limits and latency.
Compare teacher, baseline student, and adapted student using the same scenarios.
The included live smoke checks are small and cannot establish broad quality.
Also benchmark peak RAM/VRAM and first-token/total latency on target devices.

The app does not yet merge adapters, convert/quantize models, distribute model
files, schedule training jobs, or automatically promote candidates. Those steps
depend on the chosen architecture and serving runtime. Add a runtime-specific
adapter/conversion workflow only after choosing and testing that model.
