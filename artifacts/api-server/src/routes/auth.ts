import { Router, type IRouter } from "express";
import passport from "passport";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const DEMO_USERS: Record<string, string> = {
  admin:      "demo_admin",
  submitter:  "demo_submitter",
  legal:      "demo_legal",
  signer:     "demo_signer",
};

router.post("/auth/demo-login", async (req, res): Promise<void> => {
  const { role } = req.body as { role?: string };
  const googleId = role ? DEMO_USERS[role] : undefined;
  if (!googleId) {
    res.status(400).json({ error: "Invalid demo role" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.googleId, googleId));
  if (!user) {
    res.status(404).json({ error: "Demo user not found" });
    return;
  }

  req.login(user, (loginErr) => {
    if (loginErr) {
      res.status(500).json({ error: "Login failed" });
      return;
    }
    req.session.save((saveErr) => {
      if (saveErr) {
        res.status(500).json({ error: "Session save failed" });
        return;
      }
      res.json({ ok: true, user: { id: user.id, name: user.name, roles: user.roles } });
    });
  });
});

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/?error=auth_failed" }),
  (req, res): void => {
    req.session.save((err) => {
      if (err) {
        res.redirect("/?error=session_error");
        return;
      }
      res.redirect("/dashboard");
    });
  },
);

router.get("/auth/me", requireAuth, (req, res): void => {
  const user = req.user as any;
  res.json({
    id: user.id,
    googleId: user.googleId,
    email: user.email,
    name: user.name,
    photoUrl: user.photoUrl,
    jobTitle: user.jobTitle,
    department: user.department,
    roles: user.roles || ["submitter"],
    createdAt: user.createdAt,
  });
});

router.post("/auth/logout", (req, res): void => {
  req.logout((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.json({ message: "Logged out successfully" });
  });
});

export default router;
