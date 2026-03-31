/**
 * Report generation module.
 *
 * Architecture: Functional Core, Imperative Shell.
 * - Pure functions handle filtering, sorting, formatting, and aggregation.
 * - The orchestrator (`generateReport`) is the only function with side effects
 *   (DB, cache, email, logging) — kept at the boundary.
 *
 * Data flows top-down: fetch → filter → sort → aggregate → format → deliver.
 */

import { db } from "./db";
import { cache } from "./cache";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Order {
  readonly id: string;
  readonly amount: number;
  readonly date: number;
  readonly active: boolean;
}

interface User {
  readonly id: string;
  readonly name: string;
}

type ReportFormat = "csv" | "json" | "text";
type SortField = "date" | "amount";

interface ReportOptions {
  readonly userId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly format: ReportFormat;
  readonly includeCharts: boolean;
  readonly email?: {
    readonly to: string;
  };
  readonly compress: boolean;
  readonly locale: string;
  readonly timezone: string;
  readonly filterInactive: boolean;
  readonly sortBy: SortField;
}

interface ReportAggregates {
  readonly total: number;
  readonly count: number;
  readonly avg: number;
}

// ---------------------------------------------------------------------------
// Pure: filtering & sorting
// ---------------------------------------------------------------------------

/** Keep only active orders when `filterInactive` is set. */
const filterOrders = (orders: readonly Order[], filterInactive: boolean): readonly Order[] =>
  filterInactive ? orders.filter((order) => order.active) : orders;

/** Sort comparators keyed by field name — object map over if/else chain. */
const sortComparators: Record<SortField, (a: Order, b: Order) => number> = {
  date: (a, b) => a.date - b.date,
  amount: (a, b) => a.amount - b.amount,
};

const sortOrders = (orders: readonly Order[], sortBy: SortField): readonly Order[] =>
  [...orders].sort(sortComparators[sortBy]);

// ---------------------------------------------------------------------------
// Pure: aggregation
// ---------------------------------------------------------------------------

const aggregateOrders = (orders: readonly Order[]): ReportAggregates => {
  const total = orders.reduce((sum, order) => sum + order.amount, 0);
  const count = orders.length;
  return { total, count, avg: count === 0 ? 0 : total / count };
};

// ---------------------------------------------------------------------------
// Pure: formatting
// ---------------------------------------------------------------------------

const formatCsv = (orders: readonly Order[]): string =>
  orders.map((order) => `${order.id},${order.amount},${order.date}`).join("\n");

const formatJson = (user: User, orders: readonly Order[], aggregates: ReportAggregates): string =>
  JSON.stringify({ user, orders, ...aggregates });

const formatText = (user: User, aggregates: ReportAggregates): string =>
  `Report for ${user.name}: ${aggregates.count} orders, total ${aggregates.total}, avg ${aggregates.avg}`;

/** Format dispatch — object map replaces if/else chain. */
const formatters: Record<
  ReportFormat,
  (user: User, orders: readonly Order[], aggregates: ReportAggregates) => string
> = {
  csv: (_user, orders) => formatCsv(orders),
  json: (user, orders, aggregates) => formatJson(user, orders, aggregates),
  text: (user, _orders, aggregates) => formatText(user, aggregates),
};

const formatReport = (
  format: ReportFormat,
  user: User,
  orders: readonly Order[],
  aggregates: ReportAggregates,
): string => formatters[format](user, orders, aggregates);

/** Append chart data (date/amount pairs) when requested. */
const appendChartData = (
  output: string,
  orders: readonly Order[],
  includeCharts: boolean,
): string => {
  if (!includeCharts) return output;
  const chartData = orders.map((order) => ({ x: order.date, y: order.amount }));
  return `${output}\n${JSON.stringify(chartData)}`;
};

// ---------------------------------------------------------------------------
// Imperative Shell: side-effect boundary
// ---------------------------------------------------------------------------

/** Fetch user by id. Throws if not found. */
const fetchUser = async (userId: string): Promise<User> => {
  const result = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
  return result.rows[0] as User;
};

/** Fetch orders for a user within a date range. */
const fetchOrders = async (
  userId: string,
  startDate: string,
  endDate: string,
): Promise<Order[]> => {
  const result = await db.query(
    "SELECT * FROM orders WHERE user_id = $1 AND date BETWEEN $2 AND $3",
    [userId, startDate, endDate],
  );
  return result.rows as Order[];
};

/**
 * Generate a report for a given user and date range.
 *
 * Orchestrates the pipeline: fetch → filter → sort → aggregate → format → deliver.
 * All business logic is delegated to pure functions; this function owns only I/O.
 */
export async function generateReport(options: ReportOptions): Promise<string> {
  const { userId, startDate, endDate, format, includeCharts, compress, filterInactive, sortBy } =
    options;

  // Fetch data — parallelized since queries are independent
  const [user, rawOrders] = await Promise.all([
    fetchUser(userId),
    fetchOrders(userId, startDate, endDate),
  ]);

  // Pure transform pipeline
  const filtered = filterOrders(rawOrders, filterInactive);
  const sorted = sortOrders(filtered, sortBy);
  const aggregates = aggregateOrders(sorted);
  const formatted = formatReport(format, user, sorted, aggregates);
  const withCharts = appendChartData(formatted, sorted, includeCharts);
  const output = compress ? await gzip(withCharts) : withCharts;

  // Side effects at the boundary
  if (options.email) {
    await mailer.send(options.email.to, "Report", output);
  }

  cache.set(`report:${userId}`, output);
  logger.info(`Report generated for ${userId}`);

  return output;
}
