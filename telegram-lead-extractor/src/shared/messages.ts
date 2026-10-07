import type { ExtractResult, Lead } from "./types";

/**
 * Central definition of all runtime messages exchanged between the popup
 * window and the content script. Keeping them here avoids string drift.
 */

export type Message =
  | { type: "GET_STATUS" }
  | { type: "START_EXTRACT" }
  | { type: "STOP_EXTRACT" }
  | { type: "GET_RESULTS" }
  | { type: "EXTRACT_PROGRESS"; count: number; phase: string }
  | { type: "EXTRACT_COMPLETE"; payload: ExtractResult }
  | { type: "EXTRACT_ERROR"; message: string };

/** Response shape for GET_STATUS. */
export interface StatusResponse {
  telegramReady: boolean;
  isExtractable: boolean;
  groupName: string | null;
  extracting: boolean;
  count: number;
}

/** Response shape for GET_RESULTS. */
export interface ResultsResponse {
  leads: Lead[];
  groupName: string | null;
}
