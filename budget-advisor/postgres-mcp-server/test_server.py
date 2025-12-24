#!/usr/bin/env python3
"""
Test script for Budget Advisor PostgreSQL MCP Server
This script tests database connectivity and query functionality
"""

import os
import sys
from psycopg2 import pool

# Database configuration from environment variables
DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
    "database": os.getenv("POSTGRES_DB", "budget"),
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD", ""),
}

def test_connection():
    """Test database connection"""
    print("Testing database connection...")
    print(f"  Host: {DB_CONFIG['host']}")
    print(f"  Port: {DB_CONFIG['port']}")
    print(f"  Database: {DB_CONFIG['database']}")
    print(f"  User: {DB_CONFIG['user']}")
    print()

    try:
        connection_pool = pool.SimpleConnectionPool(
            minconn=1,
            maxconn=2,
            **DB_CONFIG
        )
        print("✓ Database connection successful!")

        # Test a simple query
        conn = connection_pool.getconn()
        cursor = conn.cursor()

        # Check if expenses table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'expenses'
            );
        """)
        table_exists = cursor.fetchone()[0]

        if table_exists:
            print("✓ 'expenses' table exists")

            # Get row count
            cursor.execute("SELECT COUNT(*) FROM expenses;")
            row_count = cursor.fetchone()[0]
            print(f"✓ Found {row_count} expense records")

            # Get sample data
            cursor.execute("SELECT * FROM expenses LIMIT 3;")
            rows = cursor.fetchall()
            if rows:
                print("\nSample data:")
                for row in rows:
                    print(f"  {row}")
        else:
            print("✗ 'expenses' table does not exist")
            print("\nPlease create the expenses table using the schema in sample-schema.sql")

        cursor.close()
        connection_pool.putconn(conn)
        connection_pool.closeall()

        return True

    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return False

def test_queries():
    """Test the query functions"""
    print("\n" + "="*60)
    print("Testing Query Functions")
    print("="*60 + "\n")

    try:
        from psycopg2.extras import RealDictCursor
        connection_pool = pool.SimpleConnectionPool(minconn=1, maxconn=2, **DB_CONFIG)
        conn = connection_pool.getconn()

        # Test weekly expenses query
        print("1. Testing weekly expenses query...")
        query = """
            SELECT
                category,
                SUM(amount) as total_amount,
                COUNT(*) as transaction_count,
                DATE_TRUNC('week', date) as week_start
            FROM expenses
            WHERE date >= DATE_TRUNC('week', CURRENT_DATE)
              AND date < DATE_TRUNC('week', CURRENT_DATE + INTERVAL '1 week')
            GROUP BY category, DATE_TRUNC('week', date)
            ORDER BY total_amount DESC;
        """

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(query)
        results = cursor.fetchall()

        if results:
            print(f"✓ Found {len(results)} categories this week:")
            for row in results:
                print(f"  - {row['category']}: ${row['total_amount']:.2f} ({row['transaction_count']} transactions)")
        else:
            print("  No expenses found for current week")

        # Test monthly summary query
        print("\n2. Testing monthly summary query...")
        query = """
            SELECT
                category,
                SUM(amount) as total_amount,
                COUNT(*) as transaction_count,
                AVG(amount) as avg_amount
            FROM expenses
            WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
            GROUP BY category
            ORDER BY total_amount DESC;
        """

        cursor.execute(query)
        results = cursor.fetchall()

        if results:
            print(f"✓ Found {len(results)} categories this month:")
            for row in results:
                print(f"  - {row['category']}: ${row['total_amount']:.2f} (avg: ${row['avg_amount']:.2f}, count: {row['transaction_count']})")
        else:
            print("  No expenses found for current month")

        cursor.close()
        connection_pool.putconn(conn)
        connection_pool.closeall()

        print("\n✓ All query tests passed!")
        return True

    except Exception as e:
        print(f"✗ Query test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("="*60)
    print("Budget Advisor PostgreSQL MCP Server - Test Suite")
    print("="*60 + "\n")

    # Test connection
    if test_connection():
        # Test queries
        test_queries()
    else:
        print("\nPlease fix the database connection issue before testing queries.")
        print("\nMake sure to set these environment variables:")
        print("  - POSTGRES_HOST")
        print("  - POSTGRES_PORT")
        print("  - POSTGRES_DB")
        print("  - POSTGRES_USER")
        print("  - POSTGRES_PASSWORD")
        sys.exit(1)

    print("\n" + "="*60)
    print("Test suite completed!")
    print("="*60)
