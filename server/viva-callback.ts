export function isVivaCancelCallback(query: Record<string, unknown>): boolean {
  // Express preserves query-key casing; Viva returns this flag as `Cancel=1`.
  return Object.keys(query).some((key) => key.toLowerCase() === "cancel");
}
