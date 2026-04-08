import pytest

from app.schemas.contact import EmergencyContactCreate
from app.services.contact_service import ContactService

from .conftest import seeded_db


@pytest.mark.asyncio
async def test_add_and_list_contacts():
    db, user_id = seeded_db()
    service = ContactService(db)

    await service.add_contact(
        user_id,
        EmergencyContactCreate(
            name="Friend",
            phone_number="+917777777777",
            relationship="Friend",
            channel="whatsapp",
        ),
    )
    contacts = await service.list_contacts(user_id)

    assert len(contacts) == 2
    assert contacts[0]["name"] in {"Friend", "Mother"}
    assert all("id" in contact for contact in contacts)


@pytest.mark.asyncio
async def test_remove_contact():
    db, user_id = seeded_db()
    service = ContactService(db)
    contacts = await service.list_contacts(user_id)
    contact_id = contacts[0]["id"]

    result = await service.remove_contact(user_id, contact_id)
    remaining = await service.list_contacts(user_id)

    assert result["id"] == contact_id
    assert len(remaining) == 0
