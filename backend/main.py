from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.settings import get_settings
from routers import map_router, chat_router, search_router, report_router, obstacle_router
from middlewares.auth_middleware import SupabaseAuthMiddleware
settings = get_settings()

app = FastAPI(
    title="FPTU Student Guide API",
    description="Backend API for FPTU Student Guide App",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add Auth Middleware
app.add_middleware(SupabaseAuthMiddleware)

# Include Routers
app.include_router(map_router.router)
app.include_router(chat_router.router)
app.include_router(search_router.router)
app.include_router(report_router.router)
app.include_router(obstacle_router.router)

@app.get("/")
async def root():
    return {"message": "Welcome to FPTU Student Guide API", "env": settings.APP_ENV}
