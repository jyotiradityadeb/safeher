from pathlib import Path
import json

import joblib
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models" / "gesture_rf.joblib"
TF_LITE_LABELS_PATH = ROOT / "models" / "gesture_labels.json"


def predict(features: list[float]) -> dict:
    model = joblib.load(MODEL_PATH)
    probabilities = model.predict_proba(np.array([features]))[0]
    label_index = int(np.argmax(probabilities))
    return {
        "label": model.classes_[label_index],
        "confidence": float(probabilities[label_index]),
    }


if __name__ == "__main__":
    sample = [900, 0.52, 1.35, 320, 4]
    print(predict(sample))
    if TF_LITE_LABELS_PATH.exists():
        print(json.loads(TF_LITE_LABELS_PATH.read_text(encoding="utf-8")))
