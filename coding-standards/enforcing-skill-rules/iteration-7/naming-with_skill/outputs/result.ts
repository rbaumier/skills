function processAccountClosure(data: AccountData, formatter: Formatter, isActive: boolean) {
  if (!isActive) return null;

  const elapsedMs = data.endTimestamp - data.startTimestamp;
  const bufferSize = data.buffer.length;

  const user = getUser(data.userId);
  const closureResult = closeAccount(user.accountId);
  const amount = calculateAmount(bufferSize, elapsedMs);

  return { closureResult, amount, user };
}
