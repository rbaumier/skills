function closeAccountAndCalculateCost(data, format, isActive) {
  const elapsedMs = data.ts - data.ts2;
  const bufferSize = data.buf.length;
  if (!isActive) return null;
  const user = getUsr(data.uid);
  const closeResult = setStatusToClosed(user.acctId);
  const amount = calcAmt(bufferSize, elapsedMs);
  return { result: closeResult, amount, user };
}
