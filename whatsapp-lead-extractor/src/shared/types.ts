/**
 * Core data models shared across content script, popup, and background.
 * Only fields that are genuinely visible in the WhatsApp Web UI are stored.
 */

/** A single group participant collected from the visible UI. */
export interface Participant {
  /** Display name as rendered by WhatsApp Web, if available. */
  name: string | null;
  /** Phone exactly as displayed (may include country code), if visible. */
  phone: string | null;
  /** Normalized phone only when normalization is reliable. */
  normalizedPhone: string | null;
  /** Visible role such as "Admin" or "You"; null when not shown. */
  role: string | null;
  /** Provenance marker: data always comes from the rendered UI. */
  source: "visible-ui";
}

/** Context describing the currently open group. */
export interface GroupContext {
  isGroup: boolean;
  name: string | null;
  /** Best-effort stable identifier for detecting group switches. */
  identifier: string | null;
}

/** Result returned to the popup when a scan finishes or stops. */
export interface ScanResult {
  participants: Participant[];
  groupName: string | null;
  /** Whether the scan reached the bottom naturally. */
  completed: boolean;
  /** Human-readable reason if the scan stopped early. */
  stopReason: ScanStopReason | null;
}

export type ScanStopReason =
  | "user-stopped"
  | "timeout"
  | "group-changed"
  | "list-unavailable"
  | "no-group";

/** UI state machine for the popup. */
export type ScanState =
  | "IDLE"
  | "CHECKING"
  | "READY"
  | "SCANNING"
  | "COMPLETED"
  | "STOPPED"
  | "ERROR";
