const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization;
  const [scheme, token] = authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    if (!process.env.JWT_SECRET) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (typeof payload !== "object" || payload.id === undefined || payload.id === null) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.userId = payload.id;
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

module.exports = authMiddleware;