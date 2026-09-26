import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings


async def test_connection():
    print("Connecting to MongoDB...")

    client = AsyncIOMotorClient(settings.mongodb_uri)

    try:
        result = await client.admin.command("ping")

        print("MongoDB connection successful!")
        print(result)
        print(f"Database: {settings.mongodb_database}")

    except Exception as e:
        print("MongoDB connection failed!")
        print(e)

    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(test_connection())