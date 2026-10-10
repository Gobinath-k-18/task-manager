const assert = require("node:assert/strict");
const test = require("node:test");
const { answerAssistantQuestion } = require("../src/services/assistantService");

const originalApiKey = process.env.GROQ_API_KEY;
process.env.GROQ_API_KEY = "assistant-service-test-key";

test.after(() => {
  if (originalApiKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalApiKey;
});

function fakeGroq(create) {
  return { chat: { completions: { create } } };
}

const context = {
  roadmap: { title: "Plan A", currentDay: 2, totalDays: 5 },
  currentLesson: { dayNumber: 2, title: "Lesson A", topics: ["Topic A"] },
  tasks: [{ title: "Task A", status: "pending" }],
};

test("sends bounded TaskFlow context to the existing Groq model", async () => {
  let request;
  const answer = await answerAssistantQuestion({
    message: "Explain this lesson",
    context,
    groqClient: fakeGroq(async (value) => {
      request = value;
      return { choices: [{ message: { content: "A clear explanation." } }] };
    }),
  });

  assert.equal(answer, "A clear explanation.");
  assert.equal(request.model, "openai/gpt-oss-20b");
  assert.equal(request.max_completion_tokens, 1200);
  assert.match(request.messages[0].content, /database context is the source of truth/);
  assert.match(request.messages[0].content, /do not substitute a different roadmap/);
  assert.match(request.messages[0].content, /Do not invent titles, statuses/);
  assert.match(request.messages[1].content, /Lesson A/);
  assert.match(request.messages[1].content, /Explain this lesson/);
});

test("converts provider errors to safe failures and identifies rate limits", async (t) => {
  await t.test("generic provider error", async () => {
    await assert.rejects(
      answerAssistantQuestion({
        message: "private question",
        context,
        groqClient: fakeGroq(async () => {
          throw new Error("provider leaked private question and API details");
        }),
      }),
      (error) => {
        assert.equal(error.code, "AI_PROVIDER_ERROR");
        assert.doesNotMatch(error.message, /private question|API details/);
        return true;
      },
    );
  });

  await t.test("provider rate limit", async () => {
    await assert.rejects(
      answerAssistantQuestion({
        message: "Question",
        context,
        groqClient: fakeGroq(async () => {
          const error = new Error("Rate limited");
          error.status = 429;
          throw error;
        }),
      }),
      (error) => error.code === "AI_RATE_LIMITED",
    );
  });
});

test("rejects missing Groq configuration without invoking a client", async () => {
  const configuredApiKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    await assert.rejects(
      answerAssistantQuestion({
        message: "Question",
        context,
        groqClient: fakeGroq(async () => {
          throw new Error("must not call provider");
        }),
      }),
      (error) => error.code === "AI_NOT_CONFIGURED",
    );
  } finally {
    process.env.GROQ_API_KEY = configuredApiKey;
  }
});

test("returns a safe empty-response error for malformed provider output", async () => {
  await assert.rejects(
    answerAssistantQuestion({
      message: "Question",
      context,
      groqClient: fakeGroq(async () => ({ choices: [] })),
    }),
    (error) => {
      assert.equal(error.code, "AI_EMPTY_RESPONSE");
      assert.doesNotMatch(error.message, /Question|assistant-service-test-key/);
      return true;
    },
  );
});
