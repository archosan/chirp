import { vi } from "vitest";
import { db, schema, client } from "../src/db";
import { generateId, hashPassword } from "../src/services/utils";

const { users, posts, comments, likes, follows } = schema;

export interface TestUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: "user" | "admin" | "moderator";
}

export async function createTestUser(
  overrides: Partial<{
    email: string;
    username: string;
    displayName: string;
    password: string;
    role: "user" | "admin" | "moderator";
  }> = {},
): Promise<TestUser> {
  const id = generateId();
  const email = overrides.email || `test-${id}@example.com`;
  const username = overrides.username || `user-${id}`;
  const displayName = overrides.displayName || `Test User ${id}`;
  const password = overrides.password || "password123";
  const role = overrides.role || "user";

  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id,
    email,
    username,
    displayName,
    passwordHash,
    role,
  });

  return { id, email, username, displayName, role };
}

export async function createTestPost(
  authorId: string,
  content = "Test post content",
): Promise<string> {
  const id = generateId();
  await db.insert(posts).values({
    id,
    content,
    authorId,
  });
  return id;
}

export async function createTestComment(
  postId: string,
  authorId: string,
  content = "Test comment",
): Promise<string> {
  const id = generateId();
  await db.insert(comments).values({
    id,
    content,
    postId,
    authorId,
  });
  return id;
}

export async function createTestLike(
  userId: string,
  postId: string,
): Promise<string> {
  const id = generateId();
  await db.insert(likes).values({
    id,
    userId,
    postId,
  });
  return id;
}

export async function createTestFollow(
  followerId: string,
  followingId: string,
): Promise<string> {
  const id = generateId();
  await db.insert(follows).values({
    id,
    followerId,
    followingId,
  });
  return id;
}

export function countQueries() {
  const originalExecute = (client as any).execute;
  const queries: string[] = [];

  const spy = vi
    .spyOn(client as any, "execute")
    .mockImplementation(async (...args: any[]) => {
      const query = typeof args[0] === "string" ? args[0] : args[0]?.sql;

      if (query) {
        queries.push(query);
      }

      return originalExecute.apply(client, args);
    });

  return {
    get count() {
      return queries.length;
    },
    get queries() {
      return queries;
    },
    restore() {
      spy.mockRestore();
    },
  };
}
