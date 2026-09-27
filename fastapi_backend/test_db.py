import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
import certifi

async def run():
    client = AsyncIOMotorClient(settings.mongodb_uri, tlsCAFile=certifi.where())
    db = client[settings.mongodb_database]
    cols = await db.list_collection_names()
    print("Collections:", cols)
    for c in cols:
        count = await db[c].count_documents({})
        print(f"{c}: {count}")

asyncio.run(run())
