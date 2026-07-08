// Publishable key is public by design: RLS + security-definer RPCs prevent any
// server-side read of plaintext. typeof guard keeps this safe in the browser bundle.
const env = typeof process !== "undefined" ? process.env : undefined;

export const SUPABASE_URL = env?.PINPOINT_SUPABASE_URL ?? "https://hdstvjfnniwacnjexong.supabase.co";
export const SUPABASE_ANON_KEY =
  env?.PINPOINT_SUPABASE_KEY ?? "sb_publishable_jHDDcGPx6UUFmW5lAWkT6A_yV-_L-Jm";
