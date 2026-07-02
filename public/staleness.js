// Staleness check for the polling loops (issue #92).
// Data is stale when it was never fetched, or the last fetch is older than staleMs.
function isStale(lastUpdatedAt, now, staleMs) {
  return !lastUpdatedAt || now - lastUpdatedAt > staleMs;
}
