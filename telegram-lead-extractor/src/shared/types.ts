/**
 * Core data models shared across the content script, popup window, and
 * background worker. Only fields genuinely visible in the Telegram Web UI are
 * stored, and every record carries a provenance marker.
 */

/** Visible membership role in a Telegram group/channel. */
export type MemberRole = "owner" | "admin" | "bot" | "member";

/** A single member collected from the visible Telegram Web UI. */
export interface Lead {
  /** Display name as rendered by Telegram Web (required for a valid lead). */
  name: string | null;
  /** @username without the leading '@', or null when not set/visible. */
  username: string | null;
  /** Phone only when actually shown in the UI (rare); normalized when possible. */
  phone: string | null;
  /** Numeric peer/user id when present in the DOM (data-peer-id, links). */
  telegramId: string | null;
  /** Visible role; "member" is the default for a valid member row. */
  role: MemberRole | null;
  /** Provenance marker: data always comes from the rendered UI. */
  source: "visible-ui";
}

/** Type of the currently open Telegram chat. */
export type ChatType = "group" | "channel" | "direct" | "unknown";

/** Context describing the currently open chat. */
export interface ChatContext {
  /** Whether an extractable chat (group/channel with a member list) is open. */
  isExtractable: boolean;
  type: ChatType;
  name: string | null;
  /** Best-effort stable identifier for detecting chat switches. */
  identifier: string | null;
}

/** Result returned to the UI when an extraction finishes or stops. */
export interface ExtractResult {
  leads: Lead[];
  groupName: string | null;
  /** Whether the scan reached the bottom naturally. */
  completed: boolean;
  /** Human-readable reason if the scan stopped early. */
  stopReason: ExtractStopReason | null;
}

export type ExtractStopReason =
  | "user-stopped"
  | "timeout"
  | "group-changed"
  | "list-unavailable"
  | "no-group";

/** UI state machine for the popup window. */
export type ExtractState =
  | "IDLE"
  | "CHECKING"
  | "READY"
  | "EXTRACTING"
  | "COMPLETED"
  | "STOPPED"
  | "ERROR";
