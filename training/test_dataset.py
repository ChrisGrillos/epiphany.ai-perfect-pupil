"""Standard-library checks for the dataset gate; no ML packages or GPU required."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("train_adapter", Path(__file__).with_name("train_adapter.py"))
trainer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trainer)


class DatasetGateTests(unittest.TestCase):
    def bundle(self):
        lines = [json.dumps({"messages": [{"role": "user", "content": f"Question {n}"}, {"role": "assistant", "content": "Response"}]}) for n in range(2)]
        digest = lambda value: hashlib.sha256(value.encode()).hexdigest()
        return {"manifest": {"format": "perfect-pupil-dataset-v1", "training_examples": 1, "evaluation_examples": 1, "train_sha256": digest(lines[0] + "\n"), "evaluation_sha256": digest(lines[1] + "\n"), "sources": [{"split": split, "session_id": str(n), "sha256": digest(lines[n])} for n, split in enumerate(("train", "evaluation"))]}, "train_jsonl": lines[0] + "\n", "evaluation_jsonl": lines[1] + "\n"}

    def read(self, bundle):
        with tempfile.TemporaryDirectory(prefix="pupil-dataset-") as folder:
            path = Path(folder, "dataset.json")
            path.write_text(json.dumps(bundle), encoding="utf-8")
            return trainer.read_bundle(path)

    def test_valid_export(self):
        _, train, evaluation = self.read(self.bundle())
        self.assertEqual((len(train), len(evaluation)), (1, 1))

    def test_modified_content_is_rejected(self):
        bundle = self.bundle()
        bundle["train_jsonl"] += " "
        with self.assertRaisesRegex(ValueError, "checksum"):
            self.read(bundle)

    def test_session_leakage_is_rejected(self):
        bundle = self.bundle()
        bundle["manifest"]["sources"][1]["session_id"] = "0"
        with self.assertRaisesRegex(ValueError, "leakage"):
            self.read(bundle)

    def test_missing_provenance_is_rejected(self):
        bundle = copy.deepcopy(self.bundle())
        bundle["manifest"]["sources"] = []
        with self.assertRaisesRegex(ValueError, "provenance"):
            self.read(bundle)


if __name__ == "__main__":
    unittest.main()
