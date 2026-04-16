import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const GOOGLE_CALLBACK_URL = (() => {
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const primary = domains.split(",")[0].trim();
    return `https://${primary}/api/auth/google/callback`;
  }
  return "http://localhost/api/auth/google/callback";
})();

async function fetchWorkspaceProfile(accessToken: string): Promise<{ jobTitle?: string; department?: string }> {
  try {
    const res = await fetch(
      "https://people.googleapis.com/v1/people/me?personFields=organizations",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return {};
    const data = await res.json() as any;
    const org = data?.organizations?.[0];
    return {
      jobTitle: org?.title ?? undefined,
      department: org?.department ?? undefined,
    };
  } catch (err) {
    logger.warn({ err }, "Could not fetch Google Workspace org profile");
    return {};
  }
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: GOOGLE_CALLBACK_URL,
      scope: ["profile", "email", "https://www.googleapis.com/auth/user.organization.read"],
    },
    async (_accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;
        const photoUrl = profile.photos?.[0]?.value;

        if (!email) {
          return done(new Error("No email from Google profile"), undefined);
        }

        const { jobTitle, department } = await fetchWorkspaceProfile(_accessToken);

        const [existing] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.googleId, profile.id));

        if (existing) {
          const updateSet: Record<string, any> = { accessToken: _accessToken, refreshToken, photoUrl, name };
          if (jobTitle) updateSet.jobTitle = jobTitle;
          if (department) updateSet.department = department;
          const [updated] = await db
            .update(usersTable)
            .set(updateSet)
            .where(eq(usersTable.googleId, profile.id))
            .returning();
          return done(null, updated);
        }

        const [created] = await db
          .insert(usersTable)
          .values({
            googleId: profile.id,
            email,
            name,
            photoUrl,
            jobTitle: jobTitle ?? null,
            department: department ?? null,
            accessToken: _accessToken,
            refreshToken,
            roles: ["submitter"],
          })
          .returning();

        return done(null, created);
      } catch (err) {
        logger.error({ err }, "Error in Google OAuth strategy");
        return done(err as Error, undefined);
      }
    },
  ),
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    done(null, user || null);
  } catch (err) {
    done(err, null);
  }
});
