"""Watches the vault for changes and incrementally re-indexes edited notes."""

from __future__ import annotations

import logging
import threading
import time
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from ..config import Settings
from ..db import connect, delete_note
from ..embeddings import EmbeddingClient
from .scan import index_note, relative_path

logger = logging.getLogger(__name__)


class _DebouncedMarkdownHandler(FileSystemEventHandler):
    """Coalesces bursts of filesystem events (e.g. editor autosave) into a
    single re-index per file after `debounce_seconds` of quiet."""

    def __init__(self, settings: Settings, on_change, on_delete):
        self._settings = settings
        self._on_change = on_change
        self._on_delete = on_delete
        self._timers: dict[str, threading.Timer] = {}
        self._lock = threading.Lock()

    def _schedule(self, path: Path, callback) -> None:
        key = str(path)
        with self._lock:
            existing = self._timers.get(key)
            if existing:
                existing.cancel()
            timer = threading.Timer(self._settings.watch_debounce_seconds, callback, args=(path,))
            timer.daemon = True
            self._timers[key] = timer
            timer.start()

    def on_created(self, event):
        if not event.is_directory and event.src_path.endswith(".md"):
            self._schedule(Path(event.src_path), self._on_change)

    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith(".md"):
            self._schedule(Path(event.src_path), self._on_change)

    def on_deleted(self, event):
        if not event.is_directory and event.src_path.endswith(".md"):
            self._schedule(Path(event.src_path), self._on_delete)

    def on_moved(self, event):
        if event.is_directory:
            return
        if event.src_path.endswith(".md"):
            self._schedule(Path(event.src_path), self._on_delete)
        if event.dest_path.endswith(".md"):
            self._schedule(Path(event.dest_path), self._on_change)


def watch_vault(settings: Settings) -> None:
    embedder = EmbeddingClient(settings)

    def handle_change(path: Path) -> None:
        if not path.exists():
            return
        conn = connect(settings)
        try:
            index_note(conn, embedder, settings, path)
            conn.commit()
        except Exception:
            logger.exception("Failed to index %s", path)
            conn.rollback()
        finally:
            conn.close()

    def handle_delete(path: Path) -> None:
        conn = connect(settings)
        try:
            delete_note(conn, relative_path(settings, path))
            conn.commit()
            logger.info("Removed %s", relative_path(settings, path))
        except Exception:
            logger.exception("Failed to remove %s", path)
            conn.rollback()
        finally:
            conn.close()

    handler = _DebouncedMarkdownHandler(settings, handle_change, handle_delete)
    observer = Observer()
    observer.schedule(handler, str(settings.vault_path), recursive=True)
    observer.start()
    logger.info("Watching %s for changes", settings.vault_path)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
