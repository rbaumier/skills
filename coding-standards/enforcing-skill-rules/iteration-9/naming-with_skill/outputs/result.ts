function closeAccount(record: AccountRecord, isActive: boolean) {
  if (!isActive) return null;

  const elapsedMs = record.endTimestamp - record.startTimestamp;
  const bufferSizeBytes = record.buffer.length;

  const user = getUser(record.userId);
  const result = closeAccount(user.accountId);
  const amount = calculateAmount(bufferSizeBytes, elapsedMs);

  return { result, amount, user };
}
