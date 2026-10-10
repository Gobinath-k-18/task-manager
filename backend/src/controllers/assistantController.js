const { answerAssistantQuestion } = require("../services/assistantService");
const {
  createAmbiguousReply,
  createDeterministicAnswer,
  createMissingDayReply,
  createNoMatchReply,
  loadAssistantContext,
} = require("../services/assistantContextService");

const MAX_MESSAGE_LENGTH = 2000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 12;
const userRequestWindows = new Map();

function isRateLimited(userId, now = Date.now()) {
  const window = userRequestWindows.get(userId);
  if (!window || now - window.startedAt >= RATE_LIMIT_WINDOW_MS) {
    userRequestWindows.set(userId, { startedAt: now, count: 1 });
    return false;
  }
  if (window.count >= MAX_REQUESTS_PER_WINDOW) return true;
  window.count += 1;
  return false;
}

async function chatWithAssistant(req, res) {
  if (!Number.isSafeInteger(req.userId) || req.userId < 1) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) {
    return res.status(400).json({ message: "A non-empty message is required." });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ message: "Message must be 2000 characters or fewer." });
  }
  if (isRateLimited(req.userId)) {
    return res.status(429).json({ message: "You’re sending messages too quickly. Please try again in a minute." });
  }

  let context;
  try {
    context = await loadAssistantContext(req.userId, message);
  } catch {
    return res.status(500).json({ message: "Unable to load your assistant context. Please try again." });
  }

  const deterministicAnswer = createDeterministicAnswer(message, context);
  if (deterministicAnswer !== null) {
    return res.json({ answer: deterministicAnswer });
  }
  const modelContext = context.modelContext;
  if (modelContext.roadmapSelection.status === "ambiguous" && modelContext.roadmapSelection.hasRoadmapReference) {
    return res.json({ answer: createAmbiguousReply(modelContext) });
  }
  if (modelContext.roadmapSelection.status === "unmatched" && modelContext.roadmapSelection.hasRoadmapReference) {
    return res.json({ answer: createNoMatchReply(modelContext) });
  }
  if (
    modelContext.selectedRoadmap?.requestedDayNumbers?.length > 0 &&
    modelContext.selectedRoadmap.requestedDaysFound.length === 0
  ) {
    return res.json({ answer: createMissingDayReply(modelContext) });
  }

  try {
    const answer = await answerAssistantQuestion({ message, context: modelContext });
    return res.json({ answer });
  } catch (error) {
    if (error?.code === "AI_RATE_LIMITED") {
      return res.status(429).json({ message: "The AI service is busy right now. Please try again shortly." });
    }
    if (error?.code === "AI_NOT_CONFIGURED") {
      return res.status(503).json({ message: "The AI assistant is temporarily unavailable." });
    }
    if (error?.code === "AI_TIMEOUT") {
      return res.status(504).json({ message: "The assistant took too long to respond. Please try again." });
    }
    return res.status(502).json({ message: "The assistant couldn’t respond right now. Please retry." });
  }
}

module.exports = { chatWithAssistant, userRequestWindows };
