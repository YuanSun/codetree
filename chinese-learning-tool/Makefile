.PHONY: help install install-dev test run cli clean

help:
	@echo "Chinese Learning AI Tool - Makefile Commands"
	@echo ""
	@echo "  make install      - Install production dependencies"
	@echo "  make install-dev  - Install development dependencies"
	@echo "  make run          - Run Streamlit web interface"
	@echo "  make cli          - Run interactive CLI mode"
	@echo "  make test         - Run all tests"
	@echo "  make clean        - Remove temporary files"
	@echo ""

install:
	pip install -r requirements.txt

install-dev:
	pip install -r requirements.txt
	pip install -r requirements-dev.txt

run:
	streamlit run app.py

cli:
	python cli_tutor.py --interactive

test:
	pytest tests/ -v

test-cov:
	pytest tests/ --cov=. --cov-report=term-missing

clean:
	find . -type f -name '*.pyc' -delete
	find . -type d -name '__pycache__' -delete
	find . -type d -name '*.egg-info' -exec rm -rf {} +
	find . -type f -name '.coverage' -delete
	find . -type d -name '.pytest_cache' -exec rm -rf {} +
