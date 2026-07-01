import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db


class TestBuildFilterClause:
    def test_no_filters_returns_empty_clause(self):
        clause, params = db._build_filter_clause({}, "date", "typeName", "merchantName", "merchantCountry")
        assert clause == ""
        assert params == ()

    def test_date_range_filter(self):
        clause, params = db._build_filter_clause(
            {"start_date": "2024-01-01", "end_date": "2024-01-31"},
            "date", "typeName", "merchantName", "merchantCountry",
        )
        assert clause == 'WHERE "date" >= %s AND "date" <= %s'
        assert params == ("2024-01-01", "2024-01-31")

    def test_types_filter_uses_in_clause(self):
        clause, params = db._build_filter_clause(
            {"types": ["Groceries", "Dining"]},
            "date", "typeName", "merchantName", "merchantCountry",
        )
        assert clause == 'WHERE "typeName" IN (%s, %s)'
        assert params == ("Groceries", "Dining")

    def test_name_search_uses_ilike(self):
        clause, params = db._build_filter_clause(
            {"name_search": "Costco"},
            "date", "typeName", "merchantName", "merchantCountry",
        )
        assert clause == 'WHERE "merchantName" ILIKE %s'
        assert params == ("%Costco%",)


UUID_ID = "8cfecc1a-513c-428e-924e-20d51f0e6bd6"


class TestUpdateExpenseAttachment:
    def test_issues_parameterized_update_with_binary_wrapped_bytes(self):
        with patch.object(db, "_execute") as mock_execute, patch.object(
            db.psycopg2, "Binary", side_effect=lambda b: b
        ):
            db.update_expense_attachment(UUID_ID, b"%PDF-1.4 fake receipt bytes")
            mock_execute.assert_called_once_with(
                'UPDATE family_budget."DailyExpense" SET attachment = %s WHERE id = %s;',
                (b"%PDF-1.4 fake receipt bytes", UUID_ID),
            )


class TestGetExpenseAttachment:
    def _mock_pool(self, fetchone_result):
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = fetchone_result
        mock_cursor.__enter__.return_value = mock_cursor
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_pool = MagicMock()
        mock_pool.getconn.return_value = mock_conn
        return mock_pool

    def test_returns_bytes_when_attachment_present(self):
        mock_pool = self._mock_pool((memoryview(b"file contents"),))
        with patch.object(db, "_get_pool", return_value=mock_pool):
            assert db.get_expense_attachment(UUID_ID) == b"file contents"

    def test_returns_none_when_attachment_missing(self):
        mock_pool = self._mock_pool((None,))
        with patch.object(db, "_get_pool", return_value=mock_pool):
            assert db.get_expense_attachment(UUID_ID) is None

    def test_returns_none_when_row_missing(self):
        mock_pool = self._mock_pool(None)
        with patch.object(db, "_get_pool", return_value=mock_pool):
            assert db.get_expense_attachment(UUID_ID) is None


class TestUpdateIncomeAttachment:
    def test_raises_not_implemented(self):
        try:
            db.update_income_attachment(UUID_ID, b"some bytes")
            assert False, "expected NotImplementedError"
        except NotImplementedError:
            pass


class TestUpdateExpenseFields:
    def test_issues_parameterized_update(self):
        with patch.object(db, "_execute") as mock_execute:
            db.update_expense_fields(UUID_ID, "2024-01-15", 42.5, "corrected amount")
            mock_execute.assert_called_once_with(
                'UPDATE family_budget."DailyExpense" SET date = %s, expense_numeric = %s, comment = %s WHERE id = %s;',
                ("2024-01-15", 42.5, "corrected amount", UUID_ID),
            )
