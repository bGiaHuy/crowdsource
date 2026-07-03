from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from config.settings import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

from sqlalchemy import event
import pgvector.asyncpg

@event.listens_for(engine.sync_engine, "connect")
def register_custom_types(dbapi_connection, connection_record):
    try:
        dbapi_connection.run_async(pgvector.asyncpg.register_vector)
    except Exception:
        pass

async def get_db():
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
