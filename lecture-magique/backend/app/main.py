"""FastAPI app: JSON API under /api, the built React app (frontend/dist) at /.

    uv run uvicorn app.main:app --host 0.0.0.0 --port 8090
"""
from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .routers import auth, lookups, reading, review

app = FastAPI(title="Lecture Magique", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(GZipMiddleware, minimum_size=1000)
for r in (auth.router, reading.router, lookups.router, review.router):
    app.include_router(r, prefix="/api")


@app.get("/api/health")
def health():
    return {"ok": True}


if (settings.frontend_dist / "index.html").exists():
    app.mount("/", StaticFiles(directory=settings.frontend_dist, html=True), name="frontend")
else:
    @app.get("/", response_class=HTMLResponse)
    def no_frontend():
        return ("<p>Frontend not built yet: <code>cd frontend &amp;&amp; npm install &amp;&amp; npm run build</code>,"
                " then restart.</p>")
