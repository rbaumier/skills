/**
 * Report generation module.
 *
 * Architecture: Factory-function DI — all I/O dependencies injected via
 * `createReportService(deps)`. Business logic is pure; side effects live
 * at the edges. Formatters use an object map for exhaustive format handling.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported output formats for reports. */
type ReportFormat = "csv" | "json" | "text";

/** Supported sort dimensions. */
type SortField = "date" | "amount";

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

interface DbClient {
  query<T>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

interface CacheClient {
  set(key: string, value: unknown): void;
}

interface Logger {
  info(message: string): void;
}

interface Mailer {
  send(to: string, subject: string, body: string): Promise<void>;
}

type Compressor = (input: string) => Promise<string>;

/** External I/O dependencies — injected, never hard-imported. */
interface ReportDependencies {
  readonly db: DbClient;
  readonly cache: CacheClient;
  readonly logger: Logger;
  readonly mailer: Mailer;
  readonly gzip: Compressor;
}

/** All report configuration travels in a single options object (max 3 positional args rule). */
interface ReportOptions {
  readonly userId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly format: ReportFormat;
  readonly includeCharts: boolean;
  readonly sendEmail: boolean;
  readonly emailTo: string;
  readonly compress: boolean;
  readonly locale: string;
  readonly timezone: string;
  readonly filterInactive: boolean;
  readonly sortBy: SortField;
}

interface ReportData {
  readonly user: User;
  readonly orders: readonly Order[];
  readonly total: number;
  readonly averageAmount: number;
}

// ---------------------------------------------------------------------------
// Pure business logic (functional core)
// ---------------------------------------------------------------------------

/** Filter inactive orders when requested. */
function filterOrders(orders: readonly Order[], filterInactive: boolean): readonly Order[] {
  if (!filterInactive) return orders;
  return orders.filter((order) => order.active);
}

/** Sort orders by the requested field. Returns a new array — no mutation. */
function sortOrders(orders: readonly Order[], sortBy: SortField): readonly Order[] {
  const comparators: Record<SortField, (a: Order, b: Order) => number> = {
    date: (a, b) => a.date - b.date,
    amount: (a, b) => a.amount - b.amount,
  };
  return [...orders].sort(comparators[sortBy]);
}

/** Compute aggregate statistics from an order list. */
function computeAggregates(orders: readonly Order[]): {
  total: number;
  averageAmount: number;
} {
  const total = orders.reduce((sum, order) => sum + order.amount, 0);
  const averageAmount = orders.length === 0 ? 0 : total / orders.length;
  return { total, averageAmount };
}

// ---------------------------------------------------------------------------
// Formatters — object map, no if/else chain
// ---------------------------------------------------------------------------

const formatters: Record<ReportFormat, (data: ReportData) => string> = {
  csv: ({ orders }) =>
    orders.map((order) => `${order.id},${order.amount},${order.date}`).join("\n"),

  json: (data) =>
    JSON.stringify({
      user: data.user,
      orders: data.orders,
      total: data.total,
      averageAmount: data.averageAmount,
    }),

  text: ({ user, orders, total, averageAmount }) =>
    `Report for ${user.name}: ${orders.length} orders, total ${total}, avg ${averageAmount}`,
};

/** Append chart data payload when requested. */
function appendChartData(output: string, orders: readonly Order[], includeCharts: boolean): string {
  if (!includeCharts) return output;
  const chartData = orders.map((order) => ({ x: order.date, y: order.amount }));
  return `${output}\n${JSON.stringify(chartData)}`;
}

// ---------------------------------------------------------------------------
// Service factory (imperative shell)
// ---------------------------------------------------------------------------

/** Create a report service with injected dependencies. */
function createReportService(deps: ReportDependencies) {
  const { db, cache, logger, mailer, gzip } = deps;

  async function fetchUser(userId: string): Promise<User> {
    const result = await db.query<User>("SELECT * FROM users WHERE id = $1", [userId]);
    return result.rows[0];
  }

  async function fetchOrders(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<readonly Order[]> {
    const result = await db.query<Order>(
      "SELECT * FROM orders WHERE user_id = $1 AND date BETWEEN $2 AND $3",
      [userId, startDate, endDate],
    );
    return result.rows;
  }

  /** Generate a report for the given user and date range. */
  async function generateReport(options: ReportOptions): Promise<string> {
    const {
      userId,
      startDate,
      endDate,
      format,
      includeCharts,
      sendEmail,
      emailTo,
      compress,
      filterInactive,
      sortBy,
    } = options;

    // -- Fetch data (parallelize independent I/O) --
    const [user, rawOrders] = await Promise.all([
      fetchUser(userId),
      fetchOrders(userId, startDate, endDate),
    ]);

    // -- Pure transforms --
    const filtered = filterOrders(rawOrders, filterInactive);
    const sorted = sortOrders(filtered, sortBy);
    const { total, averageAmount } = computeAggregates(sorted);

    const reportData: ReportData = { user, orders: sorted, total, averageAmount };

    let output = formatters[format](reportData);
    output = appendChartData(output, sorted, includeCharts);

    // -- Side effects at the boundary --
    if (compress) output = await gzip(output);
    if (sendEmail) await mailer.send(emailTo, "Report", output);

    cache.set(`report:${userId}`, output);
    logger.info(`Report generated for ${userId}`);

    return output;
  }

  return { generateReport } as const;
}

export { createReportService };
export type { ReportOptions, ReportFormat, ReportDependencies, ReportData, Order, User };
