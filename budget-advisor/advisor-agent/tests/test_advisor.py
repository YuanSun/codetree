"""
Unit tests for Budget Advisor Agent
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock, MagicMock
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from advisor import BudgetAdvisor


class TestBudgetAdvisor:
    """Test BudgetAdvisor class"""

    def test_init(self):
        """Test advisor initialization"""
        advisor = BudgetAdvisor(ollama_model="llama3.2")
        assert advisor.ollama_model == "llama3.2"
        assert advisor.session is None

    def test_init_default_model(self):
        """Test advisor initialization with default model"""
        advisor = BudgetAdvisor()
        assert advisor.ollama_model is not None

    def test_format_weekly_data_empty(self):
        """Test formatting empty weekly data"""
        advisor = BudgetAdvisor()
        result = advisor._format_weekly_data([])
        assert "No expenses" in result

    def test_format_weekly_data(self):
        """Test formatting weekly data"""
        advisor = BudgetAdvisor()
        data = [
            {
                'category': 'Food',
                'total_amount': 150.50,
                'transaction_count': 5
            },
            {
                'category': 'Transport',
                'total_amount': 45.25,
                'transaction_count': 3
            }
        ]

        result = advisor._format_weekly_data(data)

        assert "Food" in result
        assert "$150.50" in result
        assert "5 transactions" in result
        assert "Transport" in result
        assert "$45.25" in result
        assert "3 transactions" in result
        assert "$195.75" in result  # Total

    def test_format_monthly_data_empty(self):
        """Test formatting empty monthly data"""
        advisor = BudgetAdvisor()
        result = advisor._format_monthly_data([])
        assert "No expenses" in result

    def test_format_monthly_data(self):
        """Test formatting monthly data"""
        advisor = BudgetAdvisor()
        data = [
            {
                'category': 'Food',
                'total_amount': 650.00,
                'transaction_count': 25,
                'avg_amount': 26.00
            },
            {
                'category': 'Utilities',
                'total_amount': 200.00,
                'transaction_count': 2,
                'avg_amount': 100.00
            }
        ]

        result = advisor._format_monthly_data(data)

        assert "Food" in result
        assert "$650.00" in result
        assert "avg: $26.00" in result
        assert "count: 25" in result
        assert "Utilities" in result
        assert "$850.00" in result  # Total

    @patch('advisor.ollama.chat')
    def test_generate_advice(self, mock_ollama):
        """Test advice generation"""
        advisor = BudgetAdvisor(ollama_model="test-model")

        # Mock Ollama response
        mock_ollama.return_value = {
            'message': {
                'content': 'Great job on your spending this week!'
            }
        }

        weekly_data = [{'category': 'Food', 'total_amount': 100, 'transaction_count': 5}]
        monthly_data = [{'category': 'Food', 'total_amount': 400, 'transaction_count': 20, 'avg_amount': 20}]

        advice = advisor.generate_advice(weekly_data, monthly_data)

        assert advice == 'Great job on your spending this week!'
        assert mock_ollama.called
        call_args = mock_ollama.call_args

        # Check that the model was used
        assert call_args.kwargs['model'] == 'test-model'

        # Check that the prompt contains expense data
        prompt = call_args.kwargs['messages'][0]['content']
        assert 'Food' in prompt
        assert '$100.00' in prompt

    @pytest.mark.asyncio
    async def test_get_weekly_expenses_no_session(self):
        """Test getting weekly expenses without session"""
        advisor = BudgetAdvisor()

        with pytest.raises(RuntimeError, match="Not connected"):
            await advisor.get_weekly_expenses()

    @pytest.mark.asyncio
    async def test_get_monthly_summary_no_session(self):
        """Test getting monthly summary without session"""
        advisor = BudgetAdvisor()

        with pytest.raises(RuntimeError, match="Not connected"):
            await advisor.get_monthly_summary()

    @pytest.mark.asyncio
    async def test_query_expenses_no_session(self):
        """Test querying expenses without session"""
        advisor = BudgetAdvisor()

        with pytest.raises(RuntimeError, match="Not connected"):
            await advisor.query_expenses("SELECT * FROM expenses")

    @pytest.mark.asyncio
    async def test_get_weekly_expenses_with_session(self):
        """Test getting weekly expenses with mocked session"""
        advisor = BudgetAdvisor()

        # Mock session
        mock_session = AsyncMock()
        mock_result = Mock()
        mock_result.content = [Mock(text='[{"category": "Food", "total_amount": 100}]')]
        mock_session.call_tool.return_value = mock_result

        advisor.session = mock_session

        result = await advisor.get_weekly_expenses(weeks_back=0)

        assert len(result) == 1
        assert result[0]['category'] == 'Food'
        assert result[0]['total_amount'] == 100

        # Verify tool was called correctly
        mock_session.call_tool.assert_called_once_with(
            "get_weekly_expenses",
            arguments={"weeks_back": 0}
        )

    @pytest.mark.asyncio
    async def test_get_monthly_summary_with_session(self):
        """Test getting monthly summary with mocked session"""
        advisor = BudgetAdvisor()

        # Mock session
        mock_session = AsyncMock()
        mock_result = Mock()
        mock_result.content = [Mock(text='[{"category": "Transport", "total_amount": 200}]')]
        mock_session.call_tool.return_value = mock_result

        advisor.session = mock_session

        result = await advisor.get_monthly_summary(month="2024-12")

        assert len(result) == 1
        assert result[0]['category'] == 'Transport'

        # Verify tool was called with month argument
        mock_session.call_tool.assert_called_once_with(
            "get_monthly_summary",
            arguments={"month": "2024-12"}
        )

    @pytest.mark.asyncio
    async def test_query_expenses_with_session(self):
        """Test custom query with mocked session"""
        advisor = BudgetAdvisor()

        # Mock session
        mock_session = AsyncMock()
        mock_result = Mock()
        mock_result.content = [Mock(text='[{"id": 1, "amount": 50}]')]
        mock_session.call_tool.return_value = mock_result

        advisor.session = mock_session

        query = "SELECT * FROM expenses LIMIT 10"
        result = await advisor.query_expenses(query)

        assert len(result) == 1
        assert result[0]['id'] == 1

        # Verify query was passed
        mock_session.call_tool.assert_called_once_with(
            "query_expenses",
            arguments={"query": query}
        )


class TestIntegration:
    """Integration tests (require mocking external services)"""

    @pytest.mark.skip(reason="Requires complex async context manager mocking")
    @pytest.mark.asyncio
    async def test_connect_to_mcp_server(self):
        """Test MCP server connection (skipped - requires running MCP server)"""
        pass

    @pytest.mark.asyncio
    async def test_close_without_session(self):
        """Test closing advisor without active session"""
        advisor = BudgetAdvisor()
        await advisor.close()  # Should not raise error

    @pytest.mark.asyncio
    async def test_close_with_session(self):
        """Test closing advisor with active session"""
        advisor = BudgetAdvisor()

        # Mock session
        mock_session = AsyncMock()
        advisor.session = mock_session

        await advisor.close()

        # Verify session was closed
        assert mock_session.__aexit__.called
