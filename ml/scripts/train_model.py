from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split


ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "data" / "gesture_features.csv"
MODEL_PATH = ROOT / "models" / "gesture_rf.joblib"


def main() -> None:
    frame = pd.read_csv(DATASET_PATH)
    X = frame[["duration_ms", "average_speed", "max_speed", "total_distance", "direction_changes"]]
    y = frame["gesture"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.5, random_state=42, stratify=y)
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(classification_report(y_test, predictions))
    print(f"Saved model to {MODEL_PATH}")
    print("Next step: convert this model or an equivalent neural network to TensorFlow Lite for mobile inference.")


if __name__ == "__main__":
    main()
