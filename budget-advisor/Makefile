.PHONY: test test-mcp test-advisor install-deps clean help

help:
	@echo "Budget Advisor - Makefile Commands"
	@echo ""
	@echo "make test          - Run all tests (both MCP server and advisor)"
	@echo "make test-mcp      - Run only PostgreSQL MCP server tests"
	@echo "make test-advisor  - Run only Ollama advisor tests"
	@echo "make test-cov      - Run all tests with coverage report"
	@echo "make install-deps  - Install all dependencies"
	@echo "make clean         - Clean up cache and build files"
	@echo ""

test:
	@python3 run_all_tests.py

test-mcp:
	@echo "Running PostgreSQL MCP Server tests..."
	cd postgres-mcp-server && python3 -m pytest tests/ -v

test-advisor:
	@echo "Running Ollama Advisor tests..."
	cd advisor-agent && python3 -m pytest tests/ -v

test-cov:
	@echo "Running tests with coverage..."
	@echo "\n=== PostgreSQL MCP Server Coverage ==="
	cd postgres-mcp-server && python3 -m pytest tests/ --cov=. --cov-report=term-missing
	@echo "\n=== Ollama Advisor Agent Coverage ==="
	cd advisor-agent && python3 -m pytest tests/ --cov=. --cov-report=term-missing

install-deps:
	@echo "Installing dependencies..."
	pip3 install -r requirements-dev.txt
	pip3 install -r postgres-mcp-server/requirements.txt
	pip3 install -r advisor-agent/requirements.txt
	@echo "Dependencies installed successfully!"

clean:
	@echo "Cleaning up..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	rm -rf htmlcov .coverage
	@echo "Cleanup complete!"
