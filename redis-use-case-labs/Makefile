.PHONY: up down install install-dev test demo clean

up:
	docker compose up -d --wait

down:
	docker compose down

install:
	pip install -r requirements.txt

install-dev:
	pip install -r requirements-dev.txt

test: up install-dev
	pytest tests/ -v

demo: up install
	./scripts/demo-tour.sh

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	rm -rf .pytest_cache
