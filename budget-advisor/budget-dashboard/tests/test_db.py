import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db


class FakeUploadedFile:
    def __init__(self, name: str, content: bytes):
        self.name = name
        self._content = content

    def getbuffer(self):
        return self._content


class TestSanitizeFilename:
    def test_strips_directory_components(self):
        assert db._sanitize_filename("../../etc/passwd") == "passwd"

    def test_replaces_unsafe_characters(self):
        assert db._sanitize_filename("my receipt (1).pdf") == "my_receipt_1_.pdf"

    def test_falls_back_when_empty(self):
        assert db._sanitize_filename("") == "upload"


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


class TestSaveUploadedFile:
    def test_writes_file_and_returns_relative_path(self, tmp_path):
        with patch.object(db, "ATTACHMENT_STORAGE_DIR", str(tmp_path)):
            uploaded = FakeUploadedFile("receipt.pdf", b"hello world")
            relative_path = db.save_uploaded_file(uploaded, row_id=UUID_ID, category="expense")

            assert relative_path.startswith(os.path.join("expense", UUID_ID))
            assert relative_path.endswith("receipt.pdf")

            absolute_path = os.path.join(str(tmp_path), relative_path)
            assert os.path.exists(absolute_path)
            with open(absolute_path, "rb") as f:
                assert f.read() == b"hello world"


class TestUpdateExpenseAttachment:
    def test_issues_parameterized_update(self):
        with patch.object(db, "_execute") as mock_execute:
            db.update_expense_attachment(UUID_ID, f"expense/{UUID_ID}/receipt.pdf")
            mock_execute.assert_called_once_with(
                'UPDATE family_budget."DailyExpense" SET attachment = %s WHERE id = %s;',
                (f"expense/{UUID_ID}/receipt.pdf", UUID_ID),
            )


class TestUpdateIncomeAttachment:
    def test_raises_not_implemented(self):
        try:
            db.update_income_attachment(UUID_ID, "some/path")
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
