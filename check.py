import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres.ntcvnikvvostoufzidxx:03%40Huy45151533@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres')
    res = await conn.fetch("SELECT typname, typnamespace::regnamespace FROM pg_type WHERE typname = 'vector';")
    print('Vector type:', res)
    await conn.close()

asyncio.run(main())
