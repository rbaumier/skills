import type { QueryResult } from "./db";
import type { Mailer } from "./mailer";
import type { Cache } from "./cache";
import type { Logger } from "./logger";
import type { Db } from "./db";

// --- Types ---

interface Order {
  id: string;
  amount: number;
  date: Date;
  active: boolean;
}

interface User {
  id: string;
  name: string;
}

type SortField = "date" | "amount";
type ReportFormat = "csv" | "json" | "text";

interface ReportQuery {
  userId: string;
  startDate: Date;
  endDate: Date;
  filterInactive?: boolean;
  sortBy?: SortField;
}

interface ReportOutput {
  format: ReportFormat;
  includeCharts?: boolean;
  compress?: boolean;
}

interface EmailDelivery {
  enabled: boolean;
  to: string;
}

interface ReportDeps {
  db: Db;
  cache: Cache;
  logger: Logger;
  mailer: Mailer;
  gzip: (input: string) => Promise<string>;
}

// --- Pure functions ---

function filterOrders(orders: Order[], filterInactive: boolean): Order[] {
  return filterInactive ? orders.filter((o) => o.active) : orders;
}

function sortOrders(orders: Order[], sortBy?: SortField): Order[] {
  if (!sortBy) return orders;

  const sorted = [...orders];
  const comparators: Record<SortField, (a: Order, b: Order) => number> = {
    date: (a, b) => +a.date - +b.date,
    amount: (a, b) => a.amount - b.amount,
  };

  return sorted.sort(comparators[sortBy]);
}

function computeStats(orders: Order[]): { total: number; count: number; avg: number } {
  const total = orders.reduce((sum, o) => sum + o.amount, 0);
  const count = orders.length;
  return { total, count, avg: count === 0 ? 0 : total / count };
}

function formatCsv(orders: Order[]): string {
  return orders.map((o) => `${o.id},${o.amount},${o.date}`).join("\n");
}

function formatJson(user: User, orders: Order[], total: number, avg: number): string {
  return JSON.stringify({ user, orders, total, avg });
}

function formatText(userName: string, count: number, total: number, avg: number): string {
  return `Report for ${userName}: ${count} orders, total ${total}, avg ${avg}`;
}

function renderReport(
  format: ReportFormat,
  user: User,
  orders: Order[],
  stats: { total: number; count: number; avg: number },
): string {
  switch (format) {
    case "csv":
      return formatCsv(orders);
    case "json":
      return formatJson(user, orders, stats.total, stats.avg);
    case "text":
      return formatText(user.name, stats.count, stats.total, stats.avg);
  }
}

function buildChartSuffix(orders: Order[]): string {
  const chartData = orders.map((o) => ({ x: o.date, y: o.amount }));
  return "\n" + JSON.stringify(chartData);
}

function formatReport(
  user: User,
  orders: Order[],
  stats: { total: number; count: number; avg: number },
  output: ReportOutput,
): string {
  let result = renderReport(output.format, user, orders, stats);

  if (output.includeCharts) {
    result += buildChartSuffix(orders);
  }

  return result;
}

// --- Data access (thin wrappers) ---

async function fetchUser(db: Db, userId: string): Promise<User> {
  const result: QueryResult<User> = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
  return result.rows[0];
}

async function fetchOrders(
  db: Db,
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<Order[]> {
  const result: QueryResult<Order> = await db.query(
    "SELECT * FROM orders WHERE user_id = $1 AND date BETWEEN $2 AND $3",
    [userId, startDate, endDate],
  );
  return result.rows;
}

// --- Orchestrator ---

export async function generateReport(
  query: ReportQuery,
  output: ReportOutput,
  email: EmailDelivery,
  deps: ReportDeps,
): Promise<string> {
  const { db, cache, logger, mailer, gzip } = deps;

  // Fetch data
  const [user, rawOrders] = await Promise.all([
    fetchUser(db, query.userId),
    fetchOrders(db, query.userId, query.startDate, query.endDate),
  ]);

  // Transform (pure)
  const filtered = filterOrders(rawOrders, query.filterInactive ?? false);
  const sorted = sortOrders(filtered, query.sortBy);
  const stats = computeStats(sorted);
  let result = formatReport(user, sorted, stats, output);

  // Post-process
  if (output.compress) {
    result = await gzip(result);
  }

  // Side effects
  if (email.enabled) {
    await mailer.send(email.to, "Report", result);
  }

  cache.set(`report:${query.userId}`, result);
  logger.info(`Report generated for ${query.userId}`);

  return result;
}
