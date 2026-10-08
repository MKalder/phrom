/**
 * gh-env.js – Environment for GitHub CLI calls in the seed scripts.
 *
 * The analysis token (GITHUB_TOKEN in .env, Issues: Read-only) must never be used for writes.
 * The GitHub CLI would prefer GITHUB_TOKEN/GH_TOKEN over its own login, so both are removed here.
 * Seeding then uses the account from `gh auth login`, or SEED_GITHUB_TOKEN if it is set
 * (fine-grained token, demo repository only, Issues: Read & Write).
 */

export function ghEnv() {
  const env = { ...process.env };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  if (process.env.SEED_GITHUB_TOKEN) env.GH_TOKEN = process.env.SEED_GITHUB_TOKEN;
  return env;
}
