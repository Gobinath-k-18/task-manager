const assert = require("node:assert/strict");
const test = require("node:test");

const poolPath = require.resolve("../src/config/db");
const pdfPath = require.resolve("../src/services/pdfTextExtractor");
const aiPath = require.resolve("../src/services/roadmapAiService");
const dailyEmailPath = require.resolve("../src/services/roadmapDailyEmailService");
const controllerPath = require.resolve("../src/controllers/roadmapController");

const events = [];
let savedRoadmap = false;
let emailResult;
const pool = {
  async connect() {
    return {
      async query(sql, values = []) {
        if (sql === "BEGIN") {
          events.push("begin");
          return { rows: [], rowCount: null };
        }
        if (sql.includes("INSERT INTO learning_roadmaps")) {
          savedRoadmap = true;
          events.push("insert-roadmap");
          return {
            rows: [{
              id: 51,
              title: "Generated roadmap",
              description: "A generated learning plan.",
              total_days: 1,
              current_day: 1,
              status: "active",
            }],
            rowCount: 1,
          };
        }
        if (sql.includes("INSERT INTO roadmap_days")) {
          events.push("insert-day");
          return {
            rows: [{
              id: 71,
              day_number: values[1],
              title: values[2],
              description: values[3],
              status: "pending",
              completed_at: null,
              created_at: "2026-10-09T00:00:00.000Z",
            }],
            rowCount: 1,
          };
        }
        if (sql === "COMMIT") {
          events.push("commit");
          return { rows: [], rowCount: null };
        }
        if (sql === "ROLLBACK") {
          events.push("rollback");
          return { rows: [], rowCount: null };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
      release() {
        events.push("release");
      },
    };
  },
};

require.cache[poolPath] = {
  id: poolPath,
  filename: poolPath,
  loaded: true,
  exports: pool,
};
require.cache[pdfPath] = {
  id: pdfPath,
  filename: pdfPath,
  loaded: true,
  exports: { extractPdfText: async () => "source text" },
};
require.cache[aiPath] = {
  id: aiPath,
  filename: aiPath,
  loaded: true,
  exports: {
    generateRoadmapFromText: async () => ({
      title: "Generated roadmap",
      description: "A generated learning plan.",
      days: [{
        day_number: 1,
        title: "First lesson",
        description: "Begin learning.",
        topics: ["Foundations"],
      }],
    }),
  },
};
require.cache[dailyEmailPath] = {
  id: dailyEmailPath,
  filename: dailyEmailPath,
  loaded: true,
  exports: {
    async sendRoadmapEmailOnce(options) {
      events.push(["send-day-email", options]);
      if (emailResult instanceof Error) throw emailResult;
      return emailResult;
    },
  },
};
delete require.cache[controllerPath];
const { createRoadmap } = require(controllerPath);

function response() {
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

test("commits a new roadmap before sending its immediate Day 1 email", async () => {
  events.length = 0;
  savedRoadmap = false;
  emailResult = { sent: true, skipped: false };

  const res = response();
  await createRoadmap(
    { userId: 9, file: { buffer: Buffer.from("%PDF-test") } },
    res,
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.day1EmailSent, true);
  assert.equal(res.body.id, 51);
  assert.deepEqual(
    events,
    [
      "begin",
      "insert-roadmap",
      "insert-day",
      "commit",
      "release",
      ["send-day-email", { roadmapId: 51, dayNumber: 1 }],
    ],
  );
});

test("keeps the created roadmap when the immediate email fails and reports retryable status", async () => {
  events.length = 0;
  savedRoadmap = false;
  emailResult = new Error("SMTP configuration details must not reach the response");
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const res = response();
    await createRoadmap(
      { userId: 9, file: { buffer: Buffer.from("%PDF-test") } },
      res,
    );

    assert.equal(savedRoadmap, true);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.day1EmailSent, false);
    assert.match(res.body.message, /roadmap was created/i);
    assert.match(res.body.message, /retry/i);
    assert.doesNotMatch(JSON.stringify(res.body), /SMTP configuration details/);
    assert.equal(events.includes("rollback"), false);
    assert.equal(events.includes("commit"), true);
  } finally {
    console.error = originalConsoleError;
  }
});
