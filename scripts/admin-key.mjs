#!/usr/bin/env node
// Skapar en post till hemligheten ADMIN_KEYS med ett slumpat tillfälligt lösenord.
//   node scripts/admin-key.mjs "Förnamn Efternamn" användarnamn [admin|member]
// Ge lösenordet till personen på ett säkert sätt; hen tvingas byta det vid första inloggningen.
import { createHash, randomBytes } from "node:crypto";

const [displayName, rawUsername, role = "member"] = process.argv.slice(2);
if (!displayName || !rawUsername || !["admin", "member"].includes(role) || /[:,]/.test(displayName + rawUsername)) {
  console.error('Användning: node scripts/admin-key.mjs "Namn" användarnamn [admin|member]  (inga : eller , i namnen)');
  process.exit(1);
}
const username = rawUsername.trim().toLowerCase();
const password = randomBytes(9).toString("base64url");
const hash = createHash("sha256").update(`${username}:${password}`).digest("hex");

console.log(`Post till ADMIN_KEYS (separera flera med kommatecken):\n${displayName}:${username}:${role}:${hash}\n`);
console.log(`Tillfälligt lösenord för ${username}: ${password}`);
