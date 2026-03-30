```typescript
/** Score active customer records for the loyalty program. */
function scoreLoyaltyCustomers(records: DataRecord[]): ScoredRecord[] {
  return records
    .filter((record) => record.active)
    .map((record) => ({
      ...record,
      score: computeScore(record),
    }));
}
```
