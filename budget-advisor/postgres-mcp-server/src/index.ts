#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import pkg from "pg";
const { Pool } = pkg;

// PostgreSQL connection pool
let pool: pkg.Pool | null = null;

// Database configuration from environment variables
const DB_CONFIG = {
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  database: process.env.POSTGRES_DB || "budget",
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "",
};

// Initialize database connection
function initDatabase() {
  pool = new Pool(DB_CONFIG);
  pool.on("error", (err) => {
    console.error("Unexpected database error:", err);
  });
}

// Available tools for the MCP server
const TOOLS: Tool[] = [
  {
    name: "query_expenses",
    description:
      "Execute a SQL query to retrieve expense data from the budget database. Returns the query results as JSON.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL query to execute (SELECT statements only)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_weekly_expenses",
    description:
      "Get total expenses for the current week grouped by category",
    inputSchema: {
      type: "object",
      properties: {
        weeks_back: {
          type: "number",
          description: "Number of weeks back from current week (default: 0 for current week)",
          default: 0,
        },
      },
    },
  },
  {
    name: "get_monthly_summary",
    description:
      "Get monthly expense summary with totals by category",
    inputSchema: {
      type: "object",
      properties: {
        month: {
          type: "string",
          description: "Month in YYYY-MM format (default: current month)",
        },
      },
    },
  },
];

// Execute SQL query
async function executeQuery(query: string): Promise<any[]> {
  if (!pool) {
    throw new Error("Database not initialized");
  }

  // Basic SQL injection protection - only allow SELECT statements
  const trimmedQuery = query.trim().toUpperCase();
  if (!trimmedQuery.startsWith("SELECT")) {
    throw new Error("Only SELECT queries are allowed");
  }

  const result = await pool.query(query);
  return result.rows;
}

// Get weekly expenses
async function getWeeklyExpenses(weeksBack: number = 0): Promise<any[]> {
  const query = `
    SELECT
      category,
      SUM(amount) as total_amount,
      COUNT(*) as transaction_count,
      DATE_TRUNC('week', date) as week_start
    FROM expenses
    WHERE date >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '${weeksBack} weeks')
      AND date < DATE_TRUNC('week', CURRENT_DATE - INTERVAL '${weeksBack - 1} weeks')
    GROUP BY category, DATE_TRUNC('week', date)
    ORDER BY total_amount DESC;
  `;
  return executeQuery(query);
}

// Get monthly summary
async function getMonthlySummary(month?: string): Promise<any[]> {
  const monthCondition = month
    ? `DATE_TRUNC('month', date) = DATE_TRUNC('month', '${month}-01'::date)`
    : `DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)`;

  const query = `
    SELECT
      category,
      SUM(amount) as total_amount,
      COUNT(*) as transaction_count,
      AVG(amount) as avg_amount,
      MIN(amount) as min_amount,
      MAX(amount) as max_amount
    FROM expenses
    WHERE ${monthCondition}
    GROUP BY category
    ORDER BY total_amount DESC;
  `;
  return executeQuery(query);
}

// Create and start the MCP server
async function main() {
  console.error("Starting Budget Advisor PostgreSQL MCP Server...");

  // Initialize database
  initDatabase();

  // Create MCP server
  const server = new Server(
    {
      name: "budget-advisor-postgres",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS,
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "query_expenses": {
          const query = (args as { query: string }).query;
          const results = await executeQuery(query);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(results, null, 2),
              },
            ],
          };
        }

        case "get_weekly_expenses": {
          const weeksBack = (args as { weeks_back?: number }).weeks_back || 0;
          const results = await getWeeklyExpenses(weeksBack);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(results, null, 2),
              },
            ],
          };
        }

        case "get_monthly_summary": {
          const month = (args as { month?: string }).month;
          const results = await getMonthlySummary(month);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(results, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Budget Advisor PostgreSQL MCP Server running");
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.error("Shutting down...");
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
