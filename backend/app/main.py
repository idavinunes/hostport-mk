from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.routes_audit_logs import router as audit_router
from app.api.routes_auth import router as auth_router
from app.api.routes_clients import router as clients_router
from app.api.routes_devices import router as devices_router
from app.api.routes_mikrotik import router as mikrotik_router
from app.api.routes_plans import router as plans_router
from app.api.routes_routers import router as routers_router
from app.api.routes_sessions import router as sessions_router
from app.api.routes_settings import router as settings_router
from app.api.routes_vouchers import router as vouchers_router
from app.core.config import settings
from app.core.rate_limit import limiter

app = FastAPI(
    title="Wi-Fi Portal API",
    version="0.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": exc.__class__.__name__},
    )


app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(clients_router, prefix="/api/clients", tags=["clients"])
app.include_router(devices_router, prefix="/api/devices", tags=["devices"])
app.include_router(plans_router, prefix="/api/plans", tags=["plans"])
app.include_router(routers_router, prefix="/api/routers", tags=["routers"])
app.include_router(sessions_router, prefix="/api/sessions", tags=["sessions"])
app.include_router(audit_router, prefix="/api/audit-logs", tags=["audit"])
app.include_router(settings_router, prefix="/api/settings", tags=["settings"])
app.include_router(vouchers_router, prefix="/api/vouchers", tags=["vouchers"])
app.include_router(mikrotik_router, prefix="/api/mikrotik", tags=["mikrotik"])
