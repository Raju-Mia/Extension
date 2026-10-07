import type { Participant } from "../shared/types";

/** Shape written to the JSON export file. */
interface JsonExport {
  group: { name: string | null };
  exportedAt: string;
  count: number;
  participants: Array<{ name: string | null; phone: string | null; role: string | null }>;
}

function isValid(p: Participant): boolean {
  return Boolean((p.name && p.name.length) || (p.phone && p.phone.length));
}

/** Produce a clean, pretty-printed JSON export string. */
export function toJson(groupName: string | null, participants: Participant[]): string {
  const payload: JsonExport = {
    group: { name: groupName },
    exportedAt: new Date().toISOString(),
    count: participants.filter(isValid).length,
    participants: participants
      .filter(isValid)
      .map((p) => ({
        name: p.name,
        phone: p.phone ?? p.normalizedPhone ?? null,
        role: p.role,
      })),
  };
  return JSON.stringify(payload, null, 2);
}
