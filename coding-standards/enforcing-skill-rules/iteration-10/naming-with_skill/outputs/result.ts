/**
 * Processes a record by resolving the user, closing their account,
 * and calculating the cost based on payload size and elapsed time.
 *
 * @returns Account closure result with calculated amount, or null if inactive.
 */
function processRecord(record: Record, isActive: boolean) {
  if (!isActive) return null;

  const { startTimestamp, endTimestamp, buffer, userId } = record;
  const elapsedMs = startTimestamp - endTimestamp;
  const payloadSize = buffer.length;

  const user = getUser(userId);
  const closureResult = closeAccount(user.accountId);
  const amount = calculateAmount(payloadSize, elapsedMs);

  return { closureResult, amount, user };
}
