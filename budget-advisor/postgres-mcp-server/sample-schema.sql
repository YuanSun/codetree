-- Sample Database Schema for Budget Advisor
-- Customize this based on your actual expense data structure

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    merchant VARCHAR(200),
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_date_category ON expenses(date, category);

-- Sample data (optional - for testing)
INSERT INTO expenses (date, category, amount, description, merchant, payment_method) VALUES
    (CURRENT_DATE - INTERVAL '1 day', 'Groceries', 85.50, 'Weekly grocery shopping', 'Whole Foods', 'Credit Card'),
    (CURRENT_DATE - INTERVAL '2 days', 'Transportation', 45.00, 'Gas', 'Shell Station', 'Debit Card'),
    (CURRENT_DATE - INTERVAL '3 days', 'Dining', 32.75, 'Lunch', 'Local Restaurant', 'Credit Card'),
    (CURRENT_DATE - INTERVAL '4 days', 'Entertainment', 15.99, 'Streaming service', 'Netflix', 'Credit Card'),
    (CURRENT_DATE - INTERVAL '5 days', 'Utilities', 120.00, 'Electric bill', 'Power Company', 'Bank Transfer'),
    (CURRENT_DATE - INTERVAL '6 days', 'Groceries', 65.30, 'Grocery shopping', 'Trader Joes', 'Credit Card'),
    (CURRENT_DATE - INTERVAL '7 days', 'Healthcare', 25.00, 'Pharmacy', 'CVS', 'Debit Card');

-- Example queries you might want to use with the MCP server

-- Get all expenses for the last 7 days
-- SELECT * FROM expenses WHERE date >= CURRENT_DATE - INTERVAL '7 days' ORDER BY date DESC;

-- Get weekly spending by category
-- SELECT category, SUM(amount) as total, COUNT(*) as count
-- FROM expenses
-- WHERE date >= DATE_TRUNC('week', CURRENT_DATE)
-- GROUP BY category
-- ORDER BY total DESC;

-- Get monthly spending trends
-- SELECT
--     DATE_TRUNC('month', date) as month,
--     category,
--     SUM(amount) as total
-- FROM expenses
-- WHERE date >= CURRENT_DATE - INTERVAL '6 months'
-- GROUP BY DATE_TRUNC('month', date), category
-- ORDER BY month DESC, total DESC;

-- Get top merchants by spending
-- SELECT merchant, SUM(amount) as total_spent, COUNT(*) as visit_count
-- FROM expenses
-- WHERE date >= CURRENT_DATE - INTERVAL '30 days'
-- GROUP BY merchant
-- ORDER BY total_spent DESC
-- LIMIT 10;

-- Get daily average spending by category
-- SELECT
--     category,
--     AVG(amount) as avg_amount,
--     SUM(amount) as total_amount,
--     COUNT(*) as transaction_count
-- FROM expenses
-- WHERE date >= CURRENT_DATE - INTERVAL '30 days'
-- GROUP BY category
-- ORDER BY total_amount DESC;
