import { Router, type IRouter } from "express";
import passport from "passport";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

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
