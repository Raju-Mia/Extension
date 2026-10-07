import type { Participant, ScanResult } from "./types";

/**
 * Central definition of all runtime messages exchanged between the popup and
 * the content script. Keeping them here avoids string drift between modules.
 */

export type Message =
  | { type: "GET_STATUS" }
  | { type: "START_SCAN" }
  | { type: "STOP_SCAN" }
  | { type: "GET_RESULTS" }
  | { type: "EXPORT_CSV"; payload: ScanResult }
  | { type: "EXPORT_JSON"; payload: ScanResult }
  | { type: "SCAN_PROGRESS"; count: number; phase: string }
  | { type: "SCAN_COMPLETE"; payload: ScanResult }
  | { type: "SCAN_ERROR"; message: string };

/** Response shape for GET_STATUS. */
export interface StatusResponse {
  whatsappReady: boolean;
  isGroup: boolean;
  groupName: string | null;
  scanning: boolean;
  count: number;
}

/** Response shape for GET_RESULTS. */
export interface ResultsResponse {
  participants: Participant[];
  groupName: string | null;
}
