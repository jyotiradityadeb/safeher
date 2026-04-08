from scripts.federated_simulation import ClientUpdate, federated_average


def test_federated_average_computes_weighted_result():
    result = federated_average(
        [
            ClientUpdate("user-1", 2, [0.2, 0.4], 0.2, 0.9),
            ClientUpdate("user-2", 1, [0.5, 0.1], 0.4, 0.8),
        ]
    )

    assert result["participant_count"] == 2
    assert result["aggregated_weights"] == [0.3, 0.3]
    assert result["metrics"]["accuracy"] == 0.85
