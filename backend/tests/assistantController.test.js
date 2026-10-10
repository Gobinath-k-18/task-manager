const assert = require("node:assert/strict");
const test = require("node:test");

const servicePath = require.resolve("../src/services/assistantService");
const contextPath = require.resolve("../src/services/assistantContextService");
const controllerPath = require.resolve("../src/controllers/assistantController");
let assistantBehavior = async () => "A helpful answer.";
let contextBehavior = async () => ({
  roadmapOverview: { totalRoadmaps: 0, summariesOmitted: 0, roadmaps: [] },
  roadmapSelection: { status: "none", candidates: [], hasRoadmapReference: false },
  selectedRoadmap: null,
  taskSummary: { total: 0, completed: 0, inProgress: 0, pending: 0, other: 0 },
  tasks: { total: 0, counts: { total: 0, completed: 0, inProgress: 0, pending: 0, other: 0 }, details: [], detailsOmitted: 0 },
});
let noMatchReply = "No matching roadmap.";
let ambiguousReply = "Please choose a roadmap.";
let missingDayReply = "The requested day is not saved.";
let deterministicBehavior = () => null;
let contextCalls = [];
let assistantCalls = [];
const service = {
  answerAssistantQuestion: (...args) => {
    assistantCalls.push(args[0]);
    return assistantBehavior(...args);
  },
};
const contextService = {
  loadAssistantContext: (...args) => {
    contextCalls.push(args);
    return contextBehavior(...args);
  },
  createDeterministicAnswer: (...args) => deterministicBehavior(...args),
  createNoMatchReply: () => noMatchReply,
  createAmbiguousReply: () => ambiguousReply,
  createMissingDayReply: () => missingDayReply,
};

require.cache[servicePath] = {
  id: servicePath,
  filename: servicePath,
  loaded: true,
  exports: service,
};
require.cache[contextPath] = {
  id: contextPath,
  filename: contextPath,
  loaded: true,
  exports: contextService,
};
delete require.cache[controllerPath];
const { chatWithAssistant, userRequestWindows } = require(controllerPath);

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function createRequest(message = "How do I approach this task?", userId = 17) {
  return { userId, body: { message, userId: 9001 } };
}

function resetFixtures() {
  userRequestWindows.clear();
  contextCalls = [];
  assistantCalls = [];
  deterministicBehavior = () => null;
  contextBehavior = async () => ({
    modelContext: {
      roadmapSelection: { status: "none", candidates: [], hasRoadmapReference: false },
      selectedRoadmap: null,
    },
    inventory: { roadmaps: [], tasks: [], taskCounts: { total: 0 } },
  });
  assistantBehavior = async () => "A helpful answer.";
}

test("rejects invalid authenticated IDs before reading private data", async () => {
  resetFixtures();

  const response = createResponse();
  await chatWithAssistant(createRequest("Hi", "17"), response);

  assert.equal(response.statusCode, 401);
  assert.equal(contextCalls.length, 0);
});

test("passes the verified user ID and question to context loading and Groq", async () => {
  resetFixtures();
  let received;
  contextBehavior = async (userId, question) => {
    received = { userId, question };
    return contextBehavior.defaultValue;
  };
  contextBehavior.defaultValue = {
    modelContext: {
      roadmapSelection: { status: "matched", candidates: [{ title: "Private roadmap" }], hasRoadmapReference: true },
      selectedRoadmap: { title: "Private roadmap", days: [{ dayNumber: 3, title: "Private current lesson" }] },
    },
    inventory: { roadmaps: [], tasks: [], taskCounts: { total: 0 } },
  };
  assistantBehavior = async () => "Here is a helpful plan.";

  const response = createResponse();
  await chatWithAssistant(createRequest("How do I approach this task?", 17), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { answer: "Here is a helpful plan." });
  assert.deepEqual(received, { userId: 17, question: "How do I approach this task?" });
  assert.equal(assistantCalls[0].context.selectedRoadmap.title, "Private roadmap");
  assert.equal(assistantCalls[0].context.selectedRoadmap.days[0].title, "Private current lesson");
});

test("returns deterministic inventory answers without invoking Groq", async () => {
  resetFixtures();
  contextBehavior = async () => ({ modelContext: {}, inventory: { tasks: [{ title: "Task one" }] } });
  deterministicBehavior = (question, context) => question === "list my tasks"
    ? `Your tasks: ${context.inventory.tasks.map((task) => task.title).join(", ")}`
    : null;

  const response = createResponse();
  await chatWithAssistant(createRequest("list my tasks", 42), response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { answer: "Your tasks: Task one" });
  assert.equal(assistantCalls.length, 0);
});

test("answers unmatched roadmap references without asking Groq to substitute another roadmap", async () => {
  resetFixtures();
  contextBehavior = async () => ({
    modelContext: {
      roadmapSelection: { status: "unmatched", candidates: [], hasRoadmapReference: true },
      selectedRoadmap: null,
    },
    inventory: { roadmaps: [{ title: "Unrelated roadmap" }], tasks: [], taskCounts: { total: 0 } },
  });

  const response = createResponse();
  await chatWithAssistant(createRequest("Tell me about my missing roadmap", 22), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { answer: noMatchReply });
  assert.equal(assistantCalls.length, 0);
});

test("asks the user to clarify when roadmap matches are ambiguous", async () => {
  resetFixtures();
  contextBehavior = async () => ({
    modelContext: {
      roadmapSelection: { status: "ambiguous", candidates: [{ title: "AI Plan A" }, { title: "AI Plan B" }], hasRoadmapReference: true },
      selectedRoadmap: null,
    },
    inventory: { roadmaps: [], tasks: [], taskCounts: { total: 0 } },
  });
  const response = createResponse();
  await chatWithAssistant(createRequest("How is my AI roadmap progressing?", 23), response);
  assert.deepEqual(response.body, { answer: ambiguousReply });
  assert.equal(assistantCalls.length, 0);
});

test("returns a precise missing-day response without asking the model to guess", async () => {
  resetFixtures();
  contextBehavior = async () => ({
    modelContext: {
      roadmapSelection: { status: "matched", candidates: [], hasRoadmapReference: true },
      selectedRoadmap: { title: "Saved plan", requestedDayNumbers: [30], requestedDaysFound: [] },
    },
    inventory: { roadmaps: [], tasks: [], taskCounts: { total: 0 } },
  });
  const response = createResponse();
  await chatWithAssistant(createRequest("What is day 30 of my roadmap?", 24), response);
  assert.deepEqual(response.body, { answer: missingDayReply });
  assert.equal(assistantCalls.length, 0);
});

test("returns a safe database retrieval error without calling Groq", async () => {
  resetFixtures();
  contextBehavior = async () => { throw new Error("private database details"); };
  const response = createResponse();
  await chatWithAssistant(createRequest("Summarize my account", 25), response);
  assert.equal(response.statusCode, 500);
  assert.doesNotMatch(response.body.message, /private database details/);
  assert.equal(assistantCalls.length, 0);
});

test("maps AI rate limits and provider failures to safe retryable responses", async (t) => {
  resetFixtures();

  await t.test("provider rate limit", async () => {
    assistantBehavior = async () => {
      const error = new Error("private provider response");
      error.code = "AI_RATE_LIMITED";
      throw error;
    };
    const response = createResponse();
    await chatWithAssistant(createRequest("Explain this concept", 30), response);
    assert.equal(response.statusCode, 429);
    assert.doesNotMatch(response.body.message, /private provider response/);
  });

  await t.test("provider failure", async () => {
    assistantBehavior = async () => {
      const error = new Error("secret or private prompt data");
      error.code = "AI_PROVIDER_ERROR";
      throw error;
    };
    const response = createResponse();
    await chatWithAssistant(createRequest("Explain this concept", 31), response);
    assert.equal(response.statusCode, 502);
    assert.doesNotMatch(response.body.message, /secret|private prompt data/);
  });
});

test("rejects empty and overlong messages without querying context", async () => {
  resetFixtures();

  const emptyResponse = createResponse();
  await chatWithAssistant(createRequest("   "), emptyResponse);
  assert.equal(emptyResponse.statusCode, 400);

  const longResponse = createResponse();
  await chatWithAssistant(createRequest("x".repeat(2001)), longResponse);
  assert.equal(longResponse.statusCode, 400);
  assert.equal(contextCalls.length, 0);
});
