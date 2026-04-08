from pathlib import Path
import json

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.model_selection import train_test_split


ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "data" / "gesture_features.csv"
MODEL_DIR = ROOT / "models"
KERAS_MODEL_PATH = MODEL_DIR / "gesture_nn.keras"
TFLITE_MODEL_PATH = MODEL_DIR / "gesture_model.tflite"
LABELS_PATH = MODEL_DIR / "gesture_labels.json"
METRICS_PATH = MODEL_DIR / "gesture_nn_metrics.json"

FEATURE_COLUMNS = [
    "duration_ms",
    "average_speed",
    "max_speed",
    "total_distance",
    "direction_changes",
]


def build_model(input_shape: int, output_shape: int) -> tf.keras.Model:
    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(input_shape,)),
            tf.keras.layers.Normalization(),
            tf.keras.layers.Dense(32, activation="relu"),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(output_shape, activation="softmax"),
        ]
    )
    model.compile(
        optimizer="adam",
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def main() -> None:
    frame = pd.read_csv(DATASET_PATH)
    features = frame[FEATURE_COLUMNS].astype("float32").to_numpy()
    labels = sorted(frame["gesture"].unique().tolist())
    label_to_index = {label: index for index, label in enumerate(labels)}
    targets = frame["gesture"].map(label_to_index).astype("int32").to_numpy()

    X_train, X_test, y_train, y_test = train_test_split(
        features,
        targets,
        test_size=0.5,
        random_state=42,
        stratify=targets,
    )

    model = build_model(len(FEATURE_COLUMNS), len(labels))
    normalization = model.layers[0]
    normalization.adapt(X_train)

    model.fit(X_train, y_train, validation_data=(X_test, y_test), epochs=25, verbose=0)
    loss, accuracy = model.evaluate(X_test, y_test, verbose=0)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model.save(KERAS_MODEL_PATH)

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    TFLITE_MODEL_PATH.write_bytes(tflite_model)

    LABELS_PATH.write_text(json.dumps(labels, indent=2), encoding="utf-8")
    METRICS_PATH.write_text(
        json.dumps(
            {
                "loss": round(float(loss), 4),
                "accuracy": round(float(accuracy), 4),
                "features": FEATURE_COLUMNS,
                "labels": labels,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"Saved Keras model to {KERAS_MODEL_PATH}")
    print(f"Saved TFLite model to {TFLITE_MODEL_PATH}")
    print(f"Saved labels to {LABELS_PATH}")
    print(f"Saved metrics to {METRICS_PATH}")


if __name__ == "__main__":
    main()
