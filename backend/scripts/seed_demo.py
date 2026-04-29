import asyncio
from datetime import datetime, timezone

from app.db.database import close_mongo_connection, connect_to_mongo, get_database
from app.core.config import get_settings
from app.utils.security import get_password_hash


async def seed() -> None:
    settings = get_settings()
    await connect_to_mongo()
    db = get_database()

    existing = await db["users"].find_one({"email": settings.demo_user_email})
    if existing:
        print("Demo user already exists.")
        await close_mongo_connection()
        return

    user = {
        "full_name": "Demo User",
        "email": settings.demo_user_email,
        "password_hash": get_password_hash(settings.demo_user_password),
        "phone_number": "+919999999999",
        "is_admin": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await db["users"].insert_one(user)
    await db["contacts"].insert_many(
        [
            {
                "user_id": str(result.inserted_id),
                "name": "Mother",
                "phone_number": "+918888888888",
                "relationship": "Mother",
                "channel": "sms",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
            {
                "user_id": str(result.inserted_id),
                "name": "Friend",
                "phone_number": "+917777777777",
                "relationship": "Friend",
                "channel": "whatsapp",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
        ]
    )
    admin_existing = await db["users"].find_one({"email": settings.admin_user_email})
    if not admin_existing:
        await db["users"].insert_one(
            {
                "full_name": "SafeHer Admin",
                "email": settings.admin_user_email,
                "password_hash": get_password_hash(settings.admin_user_password),
                "phone_number": "+911111111111",
                "is_admin": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
    print(f"Seeded demo user: {settings.demo_user_email} / {settings.demo_user_password}")
    print(f"Seeded admin user: {settings.admin_user_email} / {settings.admin_user_password}")
    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(seed())
