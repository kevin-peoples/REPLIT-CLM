import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = req.user as any;
  if (!user?.roles?.includes("admin")) {
    res.status(403).json({ error: "Forbidden: Admin role required" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const user = req.user as any;
    const hasRole = roles.some((r) => user?.roles?.includes(r));
    if (!hasRole) {
      res.status(403).json({ error: `Forbidden: requires one of [${roles.join(", ")}]` });
      return;
    }
    next();
  };
}
