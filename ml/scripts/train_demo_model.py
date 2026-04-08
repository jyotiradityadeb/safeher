from pathlib import Path
import json

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "data" / "gesture_features.csv"
MODEL_DIR = ROOT / "models"
MODEL_PATH = MODEL_DIR / "gesture_demo_model.json"
METRICS_PATH = MODEL_DIR / "gesture_demo_metrics.json"
LABELS_PATH = MODEL_DIR / "gesture_labels.json"

FEATURE_COLUMNS = [
    "duration_ms",
    "average_speed",
    "max_speed",
    "total_distance",
    "direction_changes",
]


def softmax(values: np.ndarray) -> np.ndarray:
    shifted = values - np.max(values)
    exps = np.exp(shifted)
    return exps / np.sum(exps)


def main() -> None:
    frame = pd.read_csv(DATASET_PATH)
    labels = sorted(frame["gesture"].unique().tolist())
    features = frame[FEATURE_COLUMNS].astype("float64")
    mean = features.mean()
    std = features.std().replace(0, 1)
    normalized = (features - mean) / std

    centroids = {}
    for label in labels:
        centroids[label] = normalized[frame["gesture"] == label].mean().tolist()

    predictions = []
    confidences = []
    for _, row in normalized.iterrows():
        distances = {
            label: float(np.linalg.norm(np.array(row.tolist()) - np.array(centroid)))
            for label, centroid in centroids.items()
        }
        scores = np.array([-distance for distance in distances.values()], dtype="float64")
        probabilities = softmax(scores)
        best_index = int(np.argmax(probabilities))
        predictions.append(labels[best_index])
        confidences.append(float(probabilities[best_index]))

    accuracy = float(np.mean(frame["gesture"].tolist() == np.array(predictions)))

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_PATH.write_text(
        json.dumps(
            {
                "type": "nearest_centroid",
                "features": FEATURE_COLUMNS,
                "labels": labels,
                "mean": mean.round(6).to_dict(),
                "std": std.round(6).to_dict(),
                "centroids": {
                    label: [round(float(value), 6) for value in centroid]
                    for label, centroid in centroids.items()
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    METRICS_PATH.write_text(
        json.dumps(
            {
                "accuracy": round(accuracy, 4),
                "avg_confidence": round(float(np.mean(confidences)), 4),
                "sample_count": int(len(frame)),
                "labels": labels,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    LABELS_PATH.write_text(json.dumps(labels, indent=2), encoding="utf-8")

    print(f"Saved demo model to {MODEL_PATH}")
    print(f"Saved metrics to {METRICS_PATH}")


if __name__ == "__main__":
    main()
