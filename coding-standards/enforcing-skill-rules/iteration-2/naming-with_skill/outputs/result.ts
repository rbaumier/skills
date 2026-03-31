/**
 * Process a data record: resolve the user, close their account,
 * and compute the billing amount based on payload size and elapsed time.
 *
 * Returns null when the record is inactive.
 */
function processRecord(
  record: { timestamp: number; previousTimestamp: number; buffer: Buffer; userId: string },
  options: { isActive: boolean },
) {
  if (!options.isActive) return null;

  const elapsedMs = record.timestamp - record.previousTimestamp;
  const bufferSizeBytes = record.buffer.length;

  const user = getUser(record.userId);
  const closeResult = closeAccount(user.accountId);
  const billingAmount = calculateAmount(bufferSizeBytes, elapsedMs);

  return { closeResult, billingAmount, user };
}
