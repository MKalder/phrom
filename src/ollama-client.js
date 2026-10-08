/**
 * ollama-client.js – Single Ollama client for all AI calls (checks, type inference, drafts).
 *
 * Configuration through .env:
 *   OLLAMA_HOST=http://localhost:11434   (default: http://127.0.0.1:11434)
 *   MODEL_NAME=qwen3:30b-instruct
 *
 * Why a dedicated module: the default export of the `ollama` package always talks to
 * 127.0.0.1:11434 and ignores OLLAMA_HOST. Creating the client explicitly makes the configured
 * host the one that is actually used, and lets the demo report exactly that host.
 */

import { Ollama } from "ollama";

export const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
export const MODEL_NAME = process.env.MODEL_NAME || "qwen3:30b-instruct";

export const ollama = new Ollama({ host: OLLAMA_HOST });

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Hostname of OLLAMA_HOST, or "" if it cannot be parsed. */
export function ollamaHostname(host = OLLAMA_HOST) {
  try {
    return new URL(host).hostname;
  } catch {
    return "";
  }
}

/** Ollama cloud models are addressed through the local server but run on ollama.com (e.g. "gemma4:cloud"). */
export function isCloudModel(model = MODEL_NAME) {
  return /(?::|-)cloud$/i.test(String(model).trim());
}

/**
 * Where issue content goes when the AI runs.
 * local = Ollama on this machine with a locally executed model.
 */
export function describeAiEndpoint(host = OLLAMA_HOST, model = MODEL_NAME) {
  const hostname = ollamaHostname(host);
  const localHost = LOCAL_HOSTNAMES.has(hostname);
  const cloudModel = isCloudModel(model);
  return {
    host,
    hostname,
    model,
    localHost,
    cloudModel,
    isLocal: localHost && !cloudModel,
  };
}
