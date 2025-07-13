import { createClerkClient } from "@clerk/backend";
import { clerk } from "@clerk/testing/playwright";
import { type Page } from "@playwright/test";
import { db } from "@test/db";
import { eq, isNotNull } from "drizzle-orm";
import { users } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

export const setClerkUser = async (user: typeof users.$inferSelect) => {
  const clerkId = await createClerkUser(user.email);
  await db.update(users).set({ clerkId }).where(eq(users.id, user.id));
  return user;
};

export const clearClerkUser = async () => {
  await db.update(users).set({ clerkId: null }).where(isNotNull(users.clerkId));
};

export async function createClerkUser(email: string) {
  const clerk = createClerkClient({ secretKey: assertDefined(process.env.CLERK_SECRET_KEY) });
  const [clerkUser] = (await clerk.users.getUserList({ emailAddress: [email] })).data;

  if (clerkUser) {
    await clerk.users.deleteUser(clerkUser.id);
  }

  const { id } = await clerk.users.createUser({
    emailAddress: [email],
    password: "password",
    skipPasswordChecks: true,
  });

  return id;
}

export const login = async (page: Page, user: typeof users.$inferSelect) => {
  await page.goto("/login");
  const clerkUser = await setClerkUser(user);
  await clerk.signIn({ page, signInParams: { strategy: "email_code", identifier: clerkUser.email } });
  await page.waitForURL(/^(?!.*\/login$).*/u);
};
