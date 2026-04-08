from datetime import datetime, timezone

import pytest

from app.schemas.federated import ModelUpdateCreate
from app.services.federated_service import FederatedService

from .conftest import FakeDatabase


@pytest.mark.asyncio
async def test_aggregate_round_returns_weighted_average():
    db = FakeDatabase()
    service = FederatedService(db)
    now = datetime.now(timezone.utc)

    await service.submit_update(
        ModelUpdateCreate(
            user_id="user-1",
            round_id=1,
            sample_count=2,
            metrics={"accuracy": 0.8},
            weights=[0.2, 0.4],
            submitted_at=now,
        )
    )
    await service.submit_update(
        ModelUpdateCreate(
            user_id="user-2",
            round_id=1,
            sample_count=1,
            metrics={"accuracy": 0.9},
            weights=[0.5, 0.1],
            submitted_at=now,
        )
    )

    summary = await service.aggregate_round(1)

    assert summary["participant_count"] == 2
    assert summary["aggregated_weights"] == [0.3, 0.3]
    assert summary["metrics"]["accuracy"] == 0.85
