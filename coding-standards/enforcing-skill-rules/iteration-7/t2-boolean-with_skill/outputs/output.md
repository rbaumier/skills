```typescript
function sendUrgentNotification(userId: string, message: string) {
  return pushToPhone(userId, message, { priority: 'critical' });
}

function sendNormalNotification(userId: string, message: string) {
  return queueEmail(userId, message);
}
```
