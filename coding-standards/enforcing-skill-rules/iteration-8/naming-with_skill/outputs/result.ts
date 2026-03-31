function closeAccountAndBill(request, isActive) {
  const durationMs = request.ts - request.ts2;
  const bufferSizeBytes = request.buf.length;

  if (!isActive) return null;

  const user = getUser(request.uid);
  const closeResult = closeAccount(user.accountId);
  const billedAmount = calculateBilledAmount(bufferSizeBytes, durationMs);

  return { closeResult, billedAmount, user };
}
