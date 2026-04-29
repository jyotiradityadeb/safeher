from pathlib import Path

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW_PATH = ROOT / "data" / "LeapGestRecog"
OUTPUT_PATH = ROOT / "data" / "gesture_features.csv"


def _sample_rows(
    rng: np.random.Generator,
    gesture: str,
    count: int,
    duration: tuple[int, int, int],
    avg_speed: tuple[float, float, float],
    max_speed: tuple[float, float, float],
    distance: tuple[int, int, int],
    direction_changes: tuple[int, int],
) -> list[dict]:
    rows = []
    for _ in range(count):
        duration_ms = int(np.clip(rng.normal(duration[0], duration[1]), duration[2], duration[0] + duration[1] * 3))
        average_speed = round(float(np.clip(rng.normal(avg_speed[0], avg_speed[1]), avg_speed[2], avg_speed[0] + avg_speed[1] * 3)), 4)
        max_speed_value = round(float(np.clip(rng.normal(max_speed[0], max_speed[1]), max_speed[2], max_speed[0] + max_speed[1] * 3)), 4)
        total_distance = round(float(np.clip(rng.normal(distance[0], distance[1]), distance[2], distance[0] + distance[1] * 3)), 4)
        rows.append(
            {
                "gesture": gesture,
                "duration_ms": duration_ms,
                "average_speed": average_speed,
                "max_speed": max_speed_value,
                "total_distance": total_distance,
                "direction_changes": int(rng.integers(direction_changes[0], direction_changes[1] + 1)),
            }
        )
    return rows


def build_demo_rows() -> pd.DataFrame:
    rng = np.random.default_rng(42)
    rows = []
    rows.extend(
        _sample_rows(
            rng,
            "normal_interaction",
            160,
            duration=(2200, 300, 900),
            avg_speed=(0.12, 0.04, 0.03),
            max_speed=(0.26, 0.09, 0.08),
            distance=(120, 30, 40),
            direction_changes=(0, 2),
        )
    )
    rows.extend(
        _sample_rows(
            rng,
            "distress_swipe",
            140,
            duration=(950, 170, 320),
            avg_speed=(0.59, 0.1, 0.28),
            max_speed=(1.2, 0.2, 0.6),
            distance=(305, 45, 180),
            direction_changes=(3, 8),
        )
    )
    rows.extend(
        _sample_rows(
            rng,
            "need_help_tap",
            120,
            duration=(700, 120, 250),
            avg_speed=(0.42, 0.08, 0.18),
            max_speed=(0.9, 0.15, 0.45),
            distance=(135, 28, 60),
            direction_changes=(2, 6),
        )
    )
    rows.extend(
        _sample_rows(
            rng,
            "safe_arrival_confirm",
            120,
            duration=(1500, 240, 600),
            avg_speed=(0.2, 0.05, 0.06),
            max_speed=(0.45, 0.09, 0.18),
            distance=(165, 40, 65),
            direction_changes=(1, 3),
        )
    )
    return pd.DataFrame(rows)


def main() -> None:
    RAW_PATH.mkdir(parents=True, exist_ok=True)
    dataset = build_demo_rows()
    dataset.to_csv(OUTPUT_PATH, index=False)
    print(f"Saved engineered dataset to {OUTPUT_PATH}")
    print(
        "This is still synthetic demo data. Replace with real captured gesture features "
        "before production rollout."
    )


if __name__ == "__main__":
    main()
