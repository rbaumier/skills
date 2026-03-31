async function handleOrder(order, isUrgent) {
  if (order.items.length === 0) {
    return { error: "empty order" };
  }
  if (!order.customer) {
    return { error: "no customer" };
  }
  if (!order.customer.verified) {
    return { error: "not verified" };
  }

  const result = isUrgent ? await processUrgent(order) : await processNormal(order);

  if (result.ok && order.needsShipping) {
    await ship(order);
  }

  order.status = result.ok ? "completed" : "failed";
  return result;
}
