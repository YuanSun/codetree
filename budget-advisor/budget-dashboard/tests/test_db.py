import os
import sys
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db


class TestParseMoney:
    def test_parses_plain_amount(self):
        assert db._parse_money("$1,234.56") == 1234.56

    def test_parses_negative_amount(self):
        assert db._parse_money("-$5.00") == -5.00

    def test_parses_parenthesized_negative_amount(self):
        assert db._parse_money("($5.00)") == -5.00

    def test_parses_amount_without_currency_symbol(self):
        assert db._parse_money("1234.56") == 1234.56

    def test_returns_none_for_none(self):
        assert db._parse_money(None) is None


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


class TestGetBalanceYears:
    def test_extracts_years_from_view_names(self):
        fake_df = pd.DataFrame({"table_name": ["balance_2024_vw", "balance_2026_vw", "balance_2025_vw"]})
        with patch.object(db, "_query_df", return_value=fake_df):
            assert db.get_balance_years() == [2024, 2025, 2026]

    def test_returns_empty_list_when_no_views(self):
        with patch.object(db, "_query_df", return_value=pd.DataFrame({"table_name": []})):
            assert db.get_balance_years() == []


class TestFetchBalance:
    def test_queries_the_year_specific_view(self):
        with patch.object(db, "_query_df") as mock_query_df:
            db.fetch_balance(2026)
            args, _ = mock_query_df.call_args
            assert "family_budget.balance_2026_vw" in args[0]

    @pytest.mark.parametrize("bad_year", ["2026", "2026; DROP TABLE x;--", 26, 20260, None])
    def test_rejects_non_plain_year_values(self, bad_year):
        with pytest.raises(ValueError):
            db.fetch_balance(bad_year)
