"""Settings from environment / .env (never committed). See deploy/env.example."""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]  # lecture-magique/
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "backend" / ".env")


@dataclass
class Settings:
    database_url: str = os.environ.get("DATABASE_URL", "postgresql+psycopg://lecture_app@localhost:5432/postgres")
    admin_url: str = os.environ.get("DATABASE_ADMIN_URL", "") or os.environ.get("DATABASE_URL", "")
    session_secret: str = os.environ.get("SESSION_SECRET", "")
    robert_ld2_path: str = os.environ.get("ROBERT_LD2_PATH", "")
    port: int = int(os.environ.get("PORT", "8090"))
    frontend_dist: Path = Path(os.environ.get("FRONTEND_DIST", str(ROOT / "frontend" / "dist")))
    session_days: int = 30


settings = Settings()
