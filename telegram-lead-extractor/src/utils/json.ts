import type { Lead } from "../shared/types";

/** Shape written to the JSON export file. */
interface JsonExport {
  group: { name: string | null };
  exportedAt: string;
  count: number;
  leads: Array<{
    name: string | null;
    username: string | null;
    phone: string | null;
    telegramId: string | null;
    role: string | null;
  }>;
}

function isValid(p: Lead): boolean {
  const hasName = Boolean(p.name && p.name.length);
  const hasId = Boolean(p.username || p.phone || p.telegramId);
  return hasName && hasId;
}

/** Produce a clean, pretty-printed JSON export string. */
export function toJson(groupName: string | null, leads: Lead[]): string {
  const valid = leads.filter(isValid);
  const payload: JsonExport = {
    group: { name: groupName },
    exportedAt: new Date().toISOString(),
    count: valid.length,
    leads: valid.map((p) => ({
      name: p.name,
      username: p.username ? `@${p.username}` : null,
      phone: p.phone,
      telegramId: p.telegramId,
      role: p.role,
    })),
  };
  return JSON.stringify(payload, null, 2);
}
