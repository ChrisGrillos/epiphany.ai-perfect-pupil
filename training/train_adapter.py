"""Optional, explicit LoRA/QLoRA training from a reviewed Perfect Pupil dataset.

This script never runs as part of the app. Start with --preflight. Model downloads
and training require a separate --train invocation and a pinned model revision.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys


def sha256(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def read_bundle(path):
    bundle = json.loads(Path(path).read_text(encoding="utf-8"))
    manifest = bundle["manifest"]
    if manifest["format"] != "perfect-pupil-dataset-v1":
        raise ValueError("Unsupported dataset format")
    for split in ("train", "evaluation"):
        if sha256(bundle[f"{split}_jsonl"]) != manifest[f"{split}_sha256"]:
            raise ValueError(f"{split} dataset checksum mismatch")
    train = [json.loads(line) for line in bundle["train_jsonl"].splitlines() if line.strip()]
    evaluation = [json.loads(line) for line in bundle["evaluation_jsonl"].splitlines() if line.strip()]
    if not train or not evaluation:
        raise ValueError("Training requires both training and held-out evaluation examples from separate sessions")
    if len(train) != manifest["training_examples"] or len(evaluation) != manifest["evaluation_examples"]:
        raise ValueError("Dataset counts do not match the manifest")
    sources = manifest["sources"]
    for split, rows in (("train", train), ("evaluation", evaluation)):
        provenance = [source for source in sources if source["split"] == split]
        if len(provenance) != len(rows):
            raise ValueError("Missing example provenance")
        raw_lines = [line for line in bundle[f"{split}_jsonl"].splitlines() if line.strip()]
        if any(source["sha256"] != sha256(line) for source, line in zip(provenance, raw_lines)):
            raise ValueError("Example provenance checksum mismatch")
    train_sessions = {s["session_id"] for s in sources if s["split"] == "train"}
    if train_sessions & {s["session_id"] for s in sources if s["split"] == "evaluation"}:
        raise ValueError("Session leakage across training and evaluation splits")
    return manifest, train, evaluation


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--base-model", required=True)
    parser.add_argument("--revision", required=True, help="Pinned Hugging Face commit SHA")
    parser.add_argument("--output", default="training/checkpoints/pupil-adapter")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--preflight", action="store_true")
    mode.add_argument("--train", action="store_true")
    parser.add_argument("--four-bit", action="store_true")
    parser.add_argument("--max-length", type=int, default=512)
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--minimum-free-vram-gib", type=float, default=6.0)
    args = parser.parse_args()
    if not re.fullmatch(r"[a-fA-F0-9]{40}", args.revision):
        parser.error("--revision must be a full 40-character model repository commit SHA")
    if not 128 <= args.max_length <= 4096 or not 1 <= args.epochs <= 10:
        parser.error("Use max-length 128..4096 and epochs 1..10")
    manifest, train, evaluation = read_bundle(args.dataset)
    if Path(args.output).exists():
        parser.error("Output already exists. Choose a fresh version directory; checkpoints are never overwritten.")
    print(json.dumps({"dataset": manifest["train_sha256"], "training_examples": len(train), "evaluation_examples": len(evaluation), "free_disk_gib": round(shutil.disk_usage(Path.cwd()).free / 2**30, 1), "base_model": args.base_model, "revision": args.revision}, indent=2))
    try:
        import torch
    except ImportError:
        print("PyTorch is not installed in this Python environment. Install an appropriate CUDA build in a separate virtual environment.")
        return 2 if args.train else 0
    if not torch.cuda.is_available():
        print("CUDA is unavailable. GPU training is disabled; local inference remains supported by the app.")
        return 2 if args.train else 0
    free, total = torch.cuda.mem_get_info()
    print(json.dumps({"gpu": torch.cuda.get_device_name(0), "free_vram_gib": round(free / 2**30, 2), "total_vram_gib": round(total / 2**30, 2)}, indent=2))
    if not args.train:
        print("Preflight only. No models were downloaded and no training was started.")
        return 0
    if free < args.minimum_free_vram_gib * 2**30:
        raise RuntimeError("Insufficient free VRAM for the configured budget. This is only a conservative gate, not a guarantee that training fits.")
    if shutil.disk_usage(Path.cwd()).free < 15 * 2**30:
        raise RuntimeError("At least 15 GiB free disk space is required before training.")
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, Trainer, TrainingArguments
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from datasets import Dataset

    torch.manual_seed(42)
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, revision=args.revision, trust_remote_code=False)
    if not tokenizer.chat_template:
        raise ValueError("The selected model needs a supported chat template")
    tokenizer.pad_token = tokenizer.pad_token or tokenizer.eos_token
    dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    quantization = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=dtype) if args.four_bit else None
    model = AutoModelForCausalLM.from_pretrained(args.base_model, revision=args.revision, trust_remote_code=False, device_map={"": 0}, torch_dtype=dtype, quantization_config=quantization)
    if args.four_bit:
        model = prepare_model_for_kbit_training(model)
    model.config.use_cache = False
    model = get_peft_model(model, LoraConfig(r=8, lora_alpha=16, lora_dropout=0.05, target_modules="all-linear", task_type="CAUSAL_LM"))

    def encode(row):
        messages = row["messages"]
        prompt = tokenizer.apply_chat_template(messages[:-1], tokenize=False, add_generation_prompt=True)
        complete = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
        # Fail closed if the template does not preserve a clear assistant-only training boundary.
        if not complete.startswith(prompt):
            raise ValueError("Model chat template does not preserve the assistant prefix")
        prompt_ids = tokenizer(prompt, add_special_tokens=False)["input_ids"]
        tokens = tokenizer(complete, add_special_tokens=False, truncation=False)["input_ids"]
        if tokens[:len(prompt_ids)] != prompt_ids:
            raise ValueError("Tokenizer boundary is incompatible with assistant-only loss")
        if len(tokens) > args.max_length:
            raise ValueError("An example exceeds max-length. Curate shorter contexts or increase the budget; examples are never silently truncated.")
        labels = [-100] * len(prompt_ids) + tokens[len(prompt_ids):]
        if not any(label != -100 for label in labels):
            raise ValueError("An example has no assistant training tokens")
        return {"input_ids": tokens, "attention_mask": [1] * len(tokens), "labels": labels}

    def collate(rows):
        length = max(len(row["input_ids"]) for row in rows)
        return {key: torch.tensor([row[key] + [(-100 if key == "labels" else tokenizer.pad_token_id if key == "input_ids" else 0)] * (length - len(row[key])) for row in rows]) for key in ("input_ids", "attention_mask", "labels")}

    training = Dataset.from_list([encode(row) for row in train])
    held_out = Dataset.from_list([encode(row) for row in evaluation])
    settings = TrainingArguments(output_dir=args.output, per_device_train_batch_size=1, per_device_eval_batch_size=1, gradient_accumulation_steps=8, num_train_epochs=args.epochs, learning_rate=1e-4, gradient_checkpointing=True, fp16=dtype == torch.float16, bf16=dtype == torch.bfloat16, eval_strategy="epoch", save_strategy="epoch", logging_steps=1, report_to=[], seed=42, data_seed=42)
    trainer = Trainer(model=model, args=settings, train_dataset=training, eval_dataset=held_out, data_collator=collate)
    trainer.train()
    metrics = trainer.evaluate()
    model.save_pretrained(args.output, safe_serialization=True)
    tokenizer.save_pretrained(args.output)
    artifacts = {str(path.relative_to(args.output)): hashlib.sha256(path.read_bytes()).hexdigest() for path in Path(args.output).glob("*") if path.is_file()}
    record = {"format": "perfect-pupil-adapter-v1", "status": "candidate", "base_model": args.base_model, "revision": args.revision, "dataset_sha256": manifest["train_sha256"], "prompt_version": manifest["prompt_version"], "metrics": metrics, "artifacts": artifacts, "training": vars(args), "torch_version": torch.__version__, "note": "Validation loss is not a behavioral quality or safety evaluation. This candidate has not been activated."}
    Path(args.output, "pupil-model-manifest.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, RuntimeError, KeyError) as error:
        print(f"Training stopped: {error}", file=sys.stderr)
        sys.exit(2)
