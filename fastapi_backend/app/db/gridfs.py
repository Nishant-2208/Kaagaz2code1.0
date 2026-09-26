from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from app.db.mongodb import get_db

def get_gridfs() -> AsyncIOMotorGridFSBucket:
    return AsyncIOMotorGridFSBucket(get_db(), bucket_name="documents")
