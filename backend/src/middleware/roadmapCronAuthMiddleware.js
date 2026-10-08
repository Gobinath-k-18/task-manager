const { timingSafeEqual } = require("node:crypto");

function roadmapCronAuthMiddleware(req, res, next) {
  const secret = process.env.CRON_SECRET;

  if (typeof secret !== "string" || !secret) {
    return res.status(500).json({ message: "Roadmap email processing is not configured." });
  }

  const authorization = req.get("authorization") || "";
  const suppliedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(suppliedSecret);

  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return next();
}

module.exports = roadmapCronAuthMiddleware;
