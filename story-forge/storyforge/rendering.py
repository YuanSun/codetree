from __future__ import annotations

from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    trim_blocks=True,
    lstrip_blocks=True,
    keep_trailing_newline=True,
)


def render(template_name: str, **context) -> str:
    template = _env.get_template(template_name)
    return template.render(**context)


def to_yaml(data: dict) -> str:
    if not data:
        return "(none yet)"
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=100)
