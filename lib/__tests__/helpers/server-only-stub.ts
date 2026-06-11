// Test-only stub for the `server-only` marker package so server modules
// (provider clients, gateway) can be unit-tested under vitest. The real
// package throws when imported outside a React Server environment; aliasing
// it here changes nothing about production behavior.
export {};
