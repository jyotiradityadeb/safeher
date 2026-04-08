from pathlib import Path

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW_PATH = ROOT / "data" / "LeapGestRecog"
OUTPUT_PATH = ROOT / "data" / "gesture_features.csv"


def build_demo_rows() -> pd.DataFrame:
    rng = np.random.default_rng(42)
    rows = []

    for _ in range(160):
      duration_ms = int(np.clip(rng.normal(2100, 320), 900, 3200))
      average_speed = round(float(np.clip(rng.normal(0.12, 0.04), 0.03, 0.24)), 4)
      max_speed = round(float(np.clip(rng.normal(0.26, 0.09), 0.08, 0.5)), 4)
      total_distance = round(float(np.clip(rng.normal(125, 30), 40, 220)), 4)
      rows.append(
          {
              "gesture": "normal_interaction",
              "duration_ms": duration_ms,
              "average_speed": average_speed,
              "max_speed": max_speed,
              "total_distance": total_distance,
              "direction_changes": int(rng.integers(0, 2)),
          }
      )

    for _ in range(140):
      duration_ms = int(np.clip(rng.normal(900, 180), 350, 1700))
      average_speed = round(float(np.clip(rng.normal(0.57, 0.1), 0.28, 0.88)), 4)
      max_speed = round(float(np.clip(rng.normal(1.18, 0.2), 0.6, 1.7)), 4)
      total_distance = round(float(np.clip(rng.normal(305, 45), 180, 420)), 4)
      rows.append(
          {
              "gesture": "distress_swipe",
              "duration_ms": duration_ms,
              "average_speed": average_speed,
              "max_speed": max_speed,
              "total_distance": total_distance,
              "direction_changes": int(rng.integers(2, 7)),
          }
      )

    return pd.DataFrame(rows)


def main() -> None:
    RAW_PATH.mkdir(parents=True, exist_ok=True)
    dataset = build_demo_rows()
    dataset.to_csv(OUTPUT_PATH, index=False)
    print(f"Saved engineered dataset to {OUTPUT_PATH}")
    print("Replace the demo rows with LeapGestRecog-derived features for full training.")


if __name__ == "__main__":
    main()
