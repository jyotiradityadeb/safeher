from scripts.prepare_dataset import build_demo_rows


def test_build_demo_rows_contains_expected_columns():
    frame = build_demo_rows()

    assert set(
        [
            "gesture",
            "duration_ms",
            "average_speed",
            "max_speed",
            "total_distance",
            "direction_changes",
        ]
    ).issubset(frame.columns)
    assert len(frame) >= 4
