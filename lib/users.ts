import { getDb } from "@/lib/db";
import { isRole, type Role } from "@/lib/auth/permissions";

type UserRow = {
  id: number;
  username: string;
  display_name: string;
  role: string;
  password_hash: string | null;
  password_changed_at: string | null;
  must_change: number;
  disabled_at: string | null;
  last_login_at: string | null;
  created_at: string;
};

export type User = {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  passwordHash: string | null;
  passwordChangedAt: string | null;
  mustChange: boolean;
  disabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

/** Det som får lämna servern (ingen hash). */
export type PublicUser = Pick<User, "id" | "username" | "displayName" | "role" | "mustChange">;

export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: isRole(row.role) ? row.role : "member",
    passwordHash: row.password_hash,
    passwordChangedAt: row.password_changed_at,
    mustChange: row.must_change === 1,
    disabled: row.disabled_at !== null,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

export function toPublicUser(u: User): PublicUser {
  return { id: u.id, username: u.username, displayName: u.displayName, role: u.role, mustChange: u.mustChange };
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const row = await getDb().prepare("SELECT * FROM users WHERE username = ?").bind(username).first<UserRow>();
  return row ? rowToUser(row) : null;
}

export async function findUserById(id: number): Promise<User | null> {
  const row = await getDb().prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  return row ? rowToUser(row) : null;
}

export async function createUserFromKey(input: { username: string; displayName: string; role: Role }): Promise<User> {
  const row = await getDb()
    .prepare(
      "INSERT INTO users (username, display_name, role, must_change, created_at) VALUES (?, ?, ?, 1, ?) RETURNING *",
    )
    .bind(input.username, input.displayName, input.role, new Date().toISOString())
    .first<UserRow>();
  if (!row) throw new Error("Kunde inte skapa användaren");
  return rowToUser(row);
}

export async function recordLogin(id: number): Promise<void> {
  await getDb().prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
}

/** Sätter nytt lösenord. Returnerar nya password_changed_at (ogiltigförklarar andra sessioner). */
export async function setPassword(id: number, passwordHash: string): Promise<string> {
  const now = new Date().toISOString();
  await getDb()
    .prepare("UPDATE users SET password_hash = ?, password_changed_at = ?, must_change = 0 WHERE id = ?")
    .bind(passwordHash, now, id)
    .run();
  return now;
}
