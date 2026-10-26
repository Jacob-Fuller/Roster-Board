// Opens the Allowances Owed list from elsewhere in the app (a tapped payday notification).
let pending = false;
const listeners = new Set<() => void>();

export function requestOwed() {
  pending = true;
  listeners.forEach((f) => f());
}
// Returns true once if a request is waiting.
export function takeOwedRequest() {
  const p = pending;
  pending = false;
  return p;
}
export function onOwedRequest(f: () => void) {
  listeners.add(f);
  return () => { listeners.delete(f); };
}
