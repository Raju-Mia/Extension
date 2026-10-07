import { build } from "esbuild";
import { writeFileSync } from "fs";
await build({
  bundle: true, format: "esm", platform: "node", target: "node18",
  entryPoints: ["src/utils/excel.ts"], outfile: "/tmp/excel-bundle.mjs", logLevel: "silent",
});
const { toXlsxBytes } = await import("/tmp/excel-bundle.mjs");
const leads = [
  { name: "John Doe", username: "johndoe", phone: "+8801712345678", telegramId: "123456789", role: "admin", source: "visible-ui" },
  { name: "রাজু আহমেদ", username: null, phone: null, telegramId: "987654321", role: "member", source: "visible-ui" },
  { name: 'Quote "and" <tag>', username: "qt", phone: null, telegramId: "555", role: "bot", source: "visible-ui" },
];
writeFileSync("/tmp/test.xlsx", Buffer.from(toXlsxBytes(leads)));
console.log("wrote /tmp/test.xlsx");
