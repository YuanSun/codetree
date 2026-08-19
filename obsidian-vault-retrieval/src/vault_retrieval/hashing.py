"""Content hashing used to decide whether a note needs re-embedding."""

from __future__ import annotations

import hashlib


def content_hash(raw_text: str) -> str:
    return hashlib.sha256(raw_text.encode("utf-8")).hexdigest()
