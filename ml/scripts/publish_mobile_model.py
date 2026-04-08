from pathlib import Path
import shutil


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "ml" / "models" / "gesture_model.tflite"
TARGET = ROOT / "mobile" / "assets" / "models" / "gesture_model.tflite"


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"TFLite model not found at {SOURCE}")

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SOURCE, TARGET)
    print(f"Copied {SOURCE} -> {TARGET}")


if __name__ == "__main__":
    main()
