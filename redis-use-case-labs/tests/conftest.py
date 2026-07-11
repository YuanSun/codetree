import importlib.util
import pathlib

import pytest
import redis

ROOT = pathlib.Path(__file__).resolve().parent.parent


def _load_lab_module(rel_path: str):
    path = ROOT / rel_path
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="session", autouse=True)
def _require_redis():
    client = redis.Redis(host="localhost", port=6379)
    try:
        client.ping()
    except redis.exceptions.ConnectionError:
        pytest.skip("Redis isn't reachable on localhost:6379 — run `docker compose up -d` first.")


@pytest.fixture(scope="module")
def cache_lab():
    return _load_lab_module("01-cache/cache_lab.py")


@pytest.fixture(scope="module")
def lock_lab():
    return _load_lab_module("02-distributed-lock/lock_lab.py")


@pytest.fixture(scope="module")
def leaderboard_lab():
    return _load_lab_module("03-leaderboard/leaderboard_lab.py")


@pytest.fixture(scope="module")
def rate_limit_lab():
    return _load_lab_module("04-rate-limiting/rate_limit_lab.py")


@pytest.fixture(scope="module")
def event_sourcing_lab():
    return _load_lab_module("05-event-sourcing/event_sourcing_lab.py")


@pytest.fixture(scope="module")
def pubsub_lab():
    return _load_lab_module("06-pubsub/pubsub_lab.py")
