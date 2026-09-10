import type {
  AdminSessionRecord,
  AdminUserRecord,
} from "@/modules/auth/domain/admin-auth.types";
import type { AdminAuthRepository } from "@/modules/auth/ports/admin-auth-repository";

/**
 * Test double for the admin auth port.
 *
 * Kept in `adapters/` next to the Prisma implementation so every port method
 * exists once: adding a method to the port breaks compilation here instead of
 * silently drifting away from the real adapter.
 */
export class InMemoryAdminAuthRepository implements AdminAuthRepository {
  readonly users: AdminUserRecord[];
  readonly sessions: AdminSessionRecord[] = [];
  private nextUserId = 1;

  constructor(users: AdminUserRecord[] = []) {
    this.users = [...users];
    this.nextUserId = users.length + 1;
  }

  async findUserByEmail(email: string): Promise<AdminUserRecord | null> {
    const normalized = email.trim().toLowerCase();
    return (
      this.users.find((user) => user.email.toLowerCase() === normalized) ?? null
    );
  }

  async findUserById(id: string): Promise<AdminUserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: AdminUserRecord["role"];
  }): Promise<AdminUserRecord> {
    const user: AdminUserRecord = {
      id: `user_${this.nextUserId}`,
      name: input.name,
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role,
    };

    this.nextUserId += 1;
    this.users.push(user);

    return user;
  }

  async listUsers(): Promise<AdminUserRecord[]> {
    return [...this.users];
  }

  async updateUserRole(
    id: string,
    role: AdminUserRecord["role"],
  ): Promise<AdminUserRecord> {
    const user = this.users.find((entry) => entry.id === id);

    if (!user) {
      throw new Error(`Admin user ${id} not found`);
    }

    user.role = role;

    return user;
  }

  async deleteUser(id: string): Promise<void> {
    const index = this.users.findIndex((entry) => entry.id === id);

    if (index >= 0) {
      this.users.splice(index, 1);
    }

    // Mirrors the `onDelete: Cascade` relation of AdminSession.
    for (let sessionIndex = this.sessions.length - 1; sessionIndex >= 0; sessionIndex -= 1) {
      if (this.sessions[sessionIndex]?.userId === id) {
        this.sessions.splice(sessionIndex, 1);
      }
    }
  }

  async createSession(input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void> {
    const user = await this.findUserById(input.userId);

    if (!user) {
      throw new Error(`Admin user ${input.userId} not found`);
    }

    this.sessions.push({
      id: `session_${this.sessions.length + 1}`,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      userId: input.userId,
      user,
    });
  }

  async findSessionByTokenHash(
    tokenHash: string,
  ): Promise<AdminSessionRecord | null> {
    const session =
      this.sessions.find((entry) => entry.tokenHash === tokenHash) ?? null;

    if (!session) {
      return null;
    }

    const user = await this.findUserById(session.userId);

    return user ? { ...session, user } : null;
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    for (let index = this.sessions.length - 1; index >= 0; index -= 1) {
      if (this.sessions[index]?.tokenHash === tokenHash) {
        this.sessions.splice(index, 1);
      }
    }
  }
}
