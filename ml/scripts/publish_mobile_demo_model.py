from pathlib import Path
import shutil


ROOT = Path(__file__).resolve().parents[2]
SOURCE_MODEL = ROOT / "ml" / "models" / "gesture_demo_model.json"
SOURCE_METRICS = ROOT / "ml" / "models" / "gesture_demo_metrics.json"
TARGET_MODEL = ROOT / "mobile" / "assets" / "models" / "gesture_demo_model.json"
TARGET_METRICS = ROOT / "mobile" / "assets" / "models" / "gesture_demo_metrics.json"


def main() -> None:
    if not SOURCE_MODEL.exists():
        raise FileNotFoundError(f"Demo model not found at {SOURCE_MODEL}")
    if not SOURCE_METRICS.exists():
        raise FileNotFoundError(f"Demo metrics not found at {SOURCE_METRICS}")

    TARGET_MODEL.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SOURCE_MODEL, TARGET_MODEL)
    shutil.copyfile(SOURCE_METRICS, TARGET_METRICS)
    print(f"Copied {SOURCE_MODEL} -> {TARGET_MODEL}")
    print(f"Copied {SOURCE_METRICS} -> {TARGET_METRICS}")


if __name__ == "__main__":
    main()
