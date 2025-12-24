"""
Unit tests for Budget Advisor PostgreSQL MCP Server
"""

import os
import pytest
from unittest.mock import Mock, patch, MagicMock
from psycopg2.extras import RealDictCursor
import sys
import json

# Add parent directory to path to import server
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import server


class TestDatabaseConnection:
    """Test database connection and initialization"""

    @patch('server.pool.SimpleConnectionPool')
    def test_init_database_success(self, mock_pool):
        """Test successful database initialization"""
        server.connection_pool = None
        server.init_database()

        assert mock_pool.called
        mock_pool.assert_called_once_with(
            minconn=1,
            maxconn=10,
            host=server.DB_CONFIG['host'],
            port=server.DB_CONFIG['port'],
            database=server.DB_CONFIG['database'],
            user=server.DB_CONFIG['user'],
            password=server.DB_CONFIG['password']
        )

    @patch('server.pool.SimpleConnectionPool')
    def test_init_database_failure(self, mock_pool):
        """Test database initialization failure"""
        mock_pool.side_effect = Exception("Connection failed")

        with pytest.raises(Exception, match="Connection failed"):
            server.init_database()

    def test_get_connection_without_init(self):
        """Test getting connection before initialization"""
        server.connection_pool = None

        with pytest.raises(RuntimeError, match="Database not initialized"):
            server.get_connection()

    @patch('server.connection_pool')
    def test_get_connection_success(self, mock_pool):
        """Test successful connection retrieval"""
        mock_conn = Mock()
        mock_pool.getconn.return_value = mock_conn

        conn = server.get_connection()

        assert conn == mock_conn
        mock_pool.getconn.assert_called_once()

    @patch('server.connection_pool')
    def test_release_connection(self, mock_pool):
        """Test releasing connection back to pool"""
        mock_conn = Mock()

        server.release_connection(mock_conn)

        mock_pool.putconn.assert_called_once_with(mock_conn)


class TestQueryExecution:
    """Test SQL query execution"""

    def test_execute_query_security_select_allowed(self):
        """Test that SELECT queries are allowed"""
        with patch('server.get_connection') as mock_get_conn:
            mock_conn = Mock()
            mock_cursor = Mock()
            mock_cursor.fetchall.return_value = [{'id': 1, 'amount': 100}]
            mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
            mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)
            mock_get_conn.return_value = mock_conn

            with patch('server.release_connection'):
                result = server.execute_query("SELECT * FROM expenses")

                assert len(result) == 1
                assert result[0]['amount'] == 100

    def test_execute_query_security_insert_blocked(self):
        """Test that INSERT queries are blocked"""
        with pytest.raises(ValueError, match="Only SELECT queries are allowed"):
            server.execute_query("INSERT INTO expenses VALUES (1, 100)")

    def test_execute_query_security_update_blocked(self):
        """Test that UPDATE queries are blocked"""
        with pytest.raises(ValueError, match="Only SELECT queries are allowed"):
            server.execute_query("UPDATE expenses SET amount = 100")

    def test_execute_query_security_delete_blocked(self):
        """Test that DELETE queries are blocked"""
        with pytest.raises(ValueError, match="Only SELECT queries are allowed"):
            server.execute_query("DELETE FROM expenses")

    def test_execute_query_security_drop_blocked(self):
        """Test that DROP queries are blocked"""
        with pytest.raises(ValueError, match="Only SELECT queries are allowed"):
            server.execute_query("DROP TABLE expenses")

    def test_execute_query_whitespace_handling(self):
        """Test that queries with leading whitespace are handled correctly"""
        with patch('server.get_connection') as mock_get_conn:
            mock_conn = Mock()
            mock_cursor = Mock()
            mock_cursor.fetchall.return_value = []
            mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
            mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)
            mock_get_conn.return_value = mock_conn

            with patch('server.release_connection'):
                # Should work with leading whitespace
                server.execute_query("  SELECT * FROM expenses")
                mock_cursor.execute.assert_called_once()


class TestWeeklyExpenses:
    """Test weekly expenses functionality"""

    @patch('server.execute_query')
    def test_get_weekly_expenses_current_week(self, mock_execute):
        """Test getting expenses for current week"""
        expected_result = [
            {'category': 'Food', 'total_amount': 150.00, 'transaction_count': 5}
        ]
        mock_execute.return_value = expected_result

        result = server.get_weekly_expenses(0)

        assert result == expected_result
        assert mock_execute.called

    @patch('server.execute_query')
    def test_get_weekly_expenses_past_week(self, mock_execute):
        """Test getting expenses for past weeks"""
        expected_result = [
            {'category': 'Transport', 'total_amount': 75.50, 'transaction_count': 3}
        ]
        mock_execute.return_value = expected_result

        result = server.get_weekly_expenses(1)

        assert result == expected_result
        assert mock_execute.called

    @patch('server.execute_query')
    def test_get_weekly_expenses_query_structure(self, mock_execute):
        """Test that weekly expenses generates correct query structure"""
        server.get_weekly_expenses(0)

        call_args = mock_execute.call_args[0][0]
        assert 'DATE_TRUNC' in call_args
        assert 'category' in call_args
        assert 'SUM(amount)' in call_args
        assert 'GROUP BY category' in call_args


class TestMonthlySummary:
    """Test monthly summary functionality"""

    @patch('server.execute_query')
    def test_get_monthly_summary_current_month(self, mock_execute):
        """Test getting summary for current month"""
        expected_result = [
            {
                'category': 'Food',
                'total_amount': 500.00,
                'transaction_count': 20,
                'avg_amount': 25.00,
                'min_amount': 10.00,
                'max_amount': 75.00
            }
        ]
        mock_execute.return_value = expected_result

        result = server.get_monthly_summary()

        assert result == expected_result
        assert mock_execute.called

    @patch('server.execute_query')
    def test_get_monthly_summary_specific_month(self, mock_execute):
        """Test getting summary for specific month"""
        expected_result = [
            {'category': 'Entertainment', 'total_amount': 200.00}
        ]
        mock_execute.return_value = expected_result

        result = server.get_monthly_summary('2024-12')

        assert result == expected_result
        assert mock_execute.called

    @patch('server.execute_query')
    def test_get_monthly_summary_query_structure(self, mock_execute):
        """Test that monthly summary generates correct query structure"""
        server.get_monthly_summary()

        call_args = mock_execute.call_args[0][0]
        assert 'SUM(amount)' in call_args
        assert 'AVG(amount)' in call_args
        assert 'MIN(amount)' in call_args
        assert 'MAX(amount)' in call_args
        assert 'GROUP BY category' in call_args


class TestMCPServer:
    """Test MCP server endpoints"""

    @pytest.mark.asyncio
    async def test_list_tools(self):
        """Test that list_tools returns all expected tools"""
        tools = await server.list_tools()

        assert len(tools) == 3
        tool_names = [tool.name for tool in tools]
        assert 'query_expenses' in tool_names
        assert 'get_weekly_expenses' in tool_names
        assert 'get_monthly_summary' in tool_names

    @pytest.mark.asyncio
    async def test_list_tools_schema(self):
        """Test that tools have proper schema"""
        tools = await server.list_tools()

        for tool in tools:
            assert hasattr(tool, 'name')
            assert hasattr(tool, 'description')
            assert hasattr(tool, 'inputSchema')
            assert 'type' in tool.inputSchema
            assert 'properties' in tool.inputSchema

    @pytest.mark.asyncio
    @patch('server.execute_query')
    async def test_call_tool_query_expenses(self, mock_execute):
        """Test calling query_expenses tool"""
        mock_execute.return_value = [{'id': 1, 'amount': 100}]

        result = await server.call_tool('query_expenses', {'query': 'SELECT * FROM expenses'})

        assert len(result) == 1
        assert result[0].type == 'text'
        data = json.loads(result[0].text)
        assert data[0]['amount'] == 100

    @pytest.mark.asyncio
    async def test_call_tool_query_expenses_missing_param(self):
        """Test query_expenses with missing query parameter"""
        result = await server.call_tool('query_expenses', {})

        assert len(result) == 1
        assert 'Error' in result[0].text

    @pytest.mark.asyncio
    @patch('server.get_weekly_expenses')
    async def test_call_tool_get_weekly_expenses(self, mock_weekly):
        """Test calling get_weekly_expenses tool"""
        mock_weekly.return_value = [{'category': 'Food', 'total_amount': 150}]

        result = await server.call_tool('get_weekly_expenses', {'weeks_back': 0})

        assert len(result) == 1
        data = json.loads(result[0].text)
        assert data[0]['category'] == 'Food'

    @pytest.mark.asyncio
    @patch('server.get_monthly_summary')
    async def test_call_tool_get_monthly_summary(self, mock_monthly):
        """Test calling get_monthly_summary tool"""
        mock_monthly.return_value = [{'category': 'Transport', 'total_amount': 200}]

        result = await server.call_tool('get_monthly_summary', {'month': '2024-12'})

        assert len(result) == 1
        data = json.loads(result[0].text)
        assert data[0]['category'] == 'Transport'

    @pytest.mark.asyncio
    async def test_call_tool_unknown(self):
        """Test calling unknown tool"""
        result = await server.call_tool('unknown_tool', {})

        assert len(result) == 1
        assert 'Error' in result[0].text
        assert 'Unknown tool' in result[0].text


class TestConfiguration:
    """Test configuration and environment variables"""

    def test_db_config_defaults(self):
        """Test database configuration defaults"""
        # Save original env
        original_env = os.environ.copy()

        # Clear relevant env vars
        for key in ['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD']:
            os.environ.pop(key, None)

        # Reload server module to get defaults
        import importlib
        importlib.reload(server)

        assert server.DB_CONFIG['host'] == 'localhost'
        assert server.DB_CONFIG['port'] == 5432
        assert server.DB_CONFIG['database'] == 'budget'
        assert server.DB_CONFIG['user'] == 'postgres'

        # Restore original env
        os.environ.clear()
        os.environ.update(original_env)

    def test_db_config_from_env(self):
        """Test database configuration from environment variables"""
        # Set environment variables
        os.environ['POSTGRES_HOST'] = 'testhost'
        os.environ['POSTGRES_PORT'] = '5433'
        os.environ['POSTGRES_DB'] = 'testdb'
        os.environ['POSTGRES_USER'] = 'testuser'
        os.environ['POSTGRES_PASSWORD'] = 'testpass'

        # Reload server module
        import importlib
        importlib.reload(server)

        assert server.DB_CONFIG['host'] == 'testhost'
        assert server.DB_CONFIG['port'] == 5433
        assert server.DB_CONFIG['database'] == 'testdb'
        assert server.DB_CONFIG['user'] == 'testuser'
        assert server.DB_CONFIG['password'] == 'testpass'
