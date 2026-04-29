from collections import defaultdict
from datetime import datetime
from statistics import mean

from app.schemas.federated import ModelUpdateCreate


class FederatedService:
    def __init__(self, db):
        self.updates = db["model_updates"]
        self.global_models = db["global_models"]

    async def submit_update(self, payload: ModelUpdateCreate, authenticated_user_id: str | None = None) -> dict:
        if authenticated_user_id and payload.user_id != authenticated_user_id:
            raise ValueError("Model update user_id does not match authenticated user.")
        document = payload.model_dump()
        result = await self.updates.insert_one(document)
        document["_id"] = str(result.inserted_id)
        return document

    async def aggregate_round(self, round_id: int) -> dict:
        updates = await self.updates.find({"round_id": round_id}).to_list(length=500)
        if not updates:
            return {
                "round_id": round_id,
                "participant_count": 0,
                "aggregated_weights": [],
                "metrics": {"message": "No updates submitted."},
            }

        total_samples = sum(update["sample_count"] for update in updates)
        weight_length = len(updates[0]["weights"])
        aggregated = [0.0] * weight_length
        metrics_bucket = defaultdict(list)

        for update in updates:
            factor = update["sample_count"] / total_samples
            for index, value in enumerate(update["weights"]):
                aggregated[index] += value * factor
            for key, value in update.get("metrics", {}).items():
                if isinstance(value, (int, float)):
                    metrics_bucket[key].append(value)

        summary = {
            "round_id": round_id,
            "participant_count": len(updates),
            "aggregated_weights": aggregated,
            "metrics": {key: round(mean(values), 4) for key, values in metrics_bucket.items()},
        }
        await self.global_models.update_one({"round_id": round_id}, {"$set": summary}, upsert=True)
        return summary

    async def get_latest_model(self) -> dict:
        latest = await self.global_models.find_one(sort=[("round_id", -1)])
        if not latest:
            return {"round_id": 0, "aggregated_weights": [], "metrics": {}}
        latest["id"] = str(latest["_id"])
        latest.pop("_id", None)
        return latest

    async def simulate_device_round(self, user_id: str) -> dict:
        latest = await self.get_latest_model()
        next_round = int(latest.get("round_id", 0)) + 1
        base_weights = latest.get("aggregated_weights") or [0.12, 0.24, 0.36, 0.48]
        sample_count = 18 + (sum(ord(char) for char in user_id) % 7)
        adjustment_seed = (sum(ord(char) for char in user_id) % 5) - 2
        adjusted_weights = [
            round(float(weight) + (adjustment_seed * 0.005) + (index * 0.002), 4)
            for index, weight in enumerate(base_weights)
        ]
        accuracy = round(0.88 + ((sample_count % 5) * 0.015), 4)
        loss = round(max(0.08, 0.32 - (sample_count * 0.006)), 4)

        update = await self.submit_update(
            ModelUpdateCreate(
                user_id=user_id,
                round_id=next_round,
                sample_count=sample_count,
                metrics={"accuracy": accuracy, "loss": loss, "privacy_mode": 1.0},
                weights=adjusted_weights,
                submitted_at=datetime.utcnow(),
            ),
            authenticated_user_id=user_id,
        )
        global_model = await self.aggregate_round(next_round)
        return {
            "message": "Local model update submitted and global model aggregated.",
            "update": update,
            "global_model": global_model,
        }
