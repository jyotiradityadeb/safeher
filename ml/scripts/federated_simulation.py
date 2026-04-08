from dataclasses import dataclass
from statistics import mean


@dataclass
class ClientUpdate:
    user_id: str
    sample_count: int
    weights: list[float]
    loss: float
    accuracy: float


def federated_average(updates: list[ClientUpdate]) -> dict:
    total_samples = sum(update.sample_count for update in updates)
    width = len(updates[0].weights)
    aggregated = [0.0] * width

    for update in updates:
        share = update.sample_count / total_samples
        for index, value in enumerate(update.weights):
            aggregated[index] += value * share

    return {
        "participant_count": len(updates),
        "aggregated_weights": [round(value, 6) for value in aggregated],
        "metrics": {
            "loss": round(mean(update.loss for update in updates), 4),
            "accuracy": round(mean(update.accuracy for update in updates), 4),
        },
    }


if __name__ == "__main__":
    sample_updates = [
        ClientUpdate("user-1", 24, [0.11, 0.23, 0.38, 0.52], 0.28, 0.91),
        ClientUpdate("user-2", 16, [0.15, 0.20, 0.35, 0.57], 0.31, 0.88),
        ClientUpdate("user-3", 32, [0.09, 0.25, 0.33, 0.60], 0.25, 0.93),
    ]
    print(federated_average(sample_updates))
