const assert = require("node:assert/strict");
const test = require("node:test");

process.env.FRONTEND_URL = "http://localhost:5173";

const poolPath = require.resolve("../src/config/db");
const emailServicePath = require.resolve("../src/services/emailService");
const roadmapEmailServicePath = require.resolve("../src/services/roadmapEmailService");
const servicePath = require.resolve("../src/services/roadmapDailyEmailService");

const roadmaps = new Map();
const emailLogs = [];
const sentEmails = [];
const emailLogCountsAtSend = [];
const locks = new Map();
const pool = {
  async connect() {
    let roadmapId;
    let unlockRoadmap;

    return {
      async query(sql, values = []) {
        if (sql === "BEGIN") return { rows: [], rowCount: null };
        if (sql === "COMMIT" || sql === "ROLLBACK") {
          unlockRoadmap?.();
          unlockRoadmap = null;
          return { rows: [], rowCount: null };
        }
        if (sql.includes("FROM learning_roadmaps") && sql.includes("FOR UPDATE")) {
          roadmapId = values[0];
          unlockRoadmap = await acquireRoadmapLock(roadmapId);
          const roadmap = roadmaps.get(roadmapId);
          return { rows: roadmap ? [{ ...roadmap }] : [], rowCount: roadmap ? 1 : 0 };
        }
        if (sql.includes("pg_advisory_xact_lock")) {
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes("FROM roadmap_email_logs")) {
          const matches = emailLogs.filter((log) => log.roadmapId === values[0]);
          return { rows: matches.length ? [{ sent: 1 }] : [], rowCount: matches.length ? 1 : 0 };
        }
        if (sql.includes("INNER JOIN roadmap_days")) {
          const roadmap = roadmaps.get(values[0]);
          const day = roadmap?.days.get(values[1]);
          if (!roadmap || !day) return { rows: [], rowCount: 0 };
          return {
            rows: [{
              roadmap_title: roadmap.title,
              user_email: roadmap.owner.email,
              user_name: roadmap.owner.name,
              day_number: values[1],
              day_title: day.title,
              day_description: day.description,
              topics: JSON.stringify(day.topics),
            }],
            rowCount: 1,
          };
        }
        if (sql.includes("INSERT INTO roadmap_email_logs")) {
          emailLogs.push({
            roadmapId: values[0],
            dayNumber: values[1],
          });
          return { rows: [], rowCount: 1 };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
      release() {
        unlockRoadmap?.();
        unlockRoadmap = null;
      },
    };
  },
  async query(sql) {
    assert.match(sql, /FROM learning_roadmaps/);
    return {
      rows: [...roadmaps.values()]
        .filter((roadmap) => roadmap.status === "active")
        .map(({ id }) => ({ id })),
      rowCount: roadmaps.size,
    };
  },
};

async function acquireRoadmapLock(roadmapId) {
  const previous = locks.get(roadmapId) || Promise.resolve();
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const queued = previous.then(() => held);
  locks.set(roadmapId, queued);
  await previous;

  return () => {
    release();
    if (locks.get(roadmapId) === queued) locks.delete(roadmapId);
  };
}

require.cache[poolPath] = {
  id: poolPath,
  filename: poolPath,
  loaded: true,
  exports: pool,
};
require.cache[emailServicePath] = {
  id: emailServicePath,
  filename: emailServicePath,
  loaded: true,
  exports: {
    getRoadmapUrl: (roadmapId) => `http://localhost:5173/roadmaps/${roadmapId}`,
  },
};
require.cache[roadmapEmailServicePath] = {
  id: roadmapEmailServicePath,
  filename: roadmapEmailServicePath,
  loaded: true,
  exports: {
    async sendRoadmapDayEmail(message) {
      sentEmails.push(message);
      emailLogCountsAtSend.push(emailLogs.length);
      if (message.email === "fail@example.com") throw new Error("SMTP failure");
    },
  },
};
delete require.cache[servicePath];
const { processRoadmapDailyEmails, sendRoadmapEmailOnce } = require(servicePath);

function setRoadmap({
  id,
  email = `owner-${id}@example.com`,
  status = "active",
  currentDay = 1,
  dayStatus = "pending",
}) {
  roadmaps.set(id, {
    id,
    title: `Roadmap ${id}`,
    status,
    current_day: currentDay,
    owner: { email, name: `Owner ${id}` },
    days: new Map([
      [1, { title: "Day one", description: "Start here.", topics: ["Basics"], status: dayStatus }],
      [2, { title: "Day two", description: "Continue here.", topics: ["Practice"], status: "pending" }],
      [3, { title: "Day three", description: "Continue later.", topics: ["Review"], status: "pending" }],
    ]),
  });
}

function reset() {
  roadmaps.clear();
  emailLogs.length = 0;
  sentEmails.length = 0;
  emailLogCountsAtSend.length = 0;
  locks.clear();
}

test("sends immediate Day 1 to the roadmap owner's registered email and logs after SMTP", async () => {
  reset();
  setRoadmap({ id: 31, email: "registered-owner@example.com" });

  const result = await sendRoadmapEmailOnce({ roadmapId: 31, dayNumber: 1 });

  assert.deepEqual(result, { sent: true, skipped: false });
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].email, "registered-owner@example.com");
  assert.equal(sentEmails[0].day.day_number, 1);
  assert.equal(sentEmails[0].roadmapTitle, "Roadmap 31");
  assert.equal(sentEmails[0].day.title, "Day one");
  assert.deepEqual(sentEmails[0].day.topics, ["Basics"]);
  assert.equal(sentEmails[0].roadmapUrl, "http://localhost:5173/roadmaps/31");
  assert.equal(emailLogCountsAtSend[0], 0);
  assert.equal(emailLogs.length, 1);
  assert.deepEqual(emailLogs[0], { roadmapId: 31, dayNumber: 1 });
});

test("daily email uses the actual current day even when it remains incomplete", async () => {
  reset();
  setRoadmap({ id: 32, currentDay: 2, dayStatus: "pending" });

  const result = await processRoadmapDailyEmails();

  assert.deepEqual(result, { processed: 1, sent: 1, skipped: 0, failed: 0 });
  assert.equal(sentEmails[0].day.day_number, 2);
  assert.equal(sentEmails[0].day.title, "Day two");
  assert.deepEqual(emailLogs[0], { roadmapId: 32, dayNumber: 2 });
});

test("successful Day 1 upload email prevents a second roadmap email after progress advances", async () => {
  reset();
  setRoadmap({ id: 33 });

  await sendRoadmapEmailOnce({ roadmapId: 33, dayNumber: 1 });
  roadmaps.get(33).current_day = 2;
  const summary = await processRoadmapDailyEmails();

  assert.deepEqual(summary, { processed: 1, sent: 0, skipped: 1, failed: 0 });
  assert.equal(sentEmails.length, 1);
  assert.equal(emailLogs.length, 1);
});

test("processes multiple roadmaps independently and sends no duplicate for the same date", async () => {
  reset();
  setRoadmap({ id: 34, currentDay: 1 });
  setRoadmap({ id: 35, currentDay: 2 });

  const firstRun = await processRoadmapDailyEmails();
  const secondRun = await processRoadmapDailyEmails();

  assert.deepEqual(firstRun, { processed: 2, sent: 2, skipped: 0, failed: 0 });
  assert.deepEqual(secondRun, { processed: 2, sent: 0, skipped: 2, failed: 0 });
  assert.deepEqual(
    sentEmails.map((message) => [message.email, message.day.day_number]),
    [["owner-34@example.com", 1], ["owner-35@example.com", 2]],
  );
  assert.deepEqual(
    emailLogs.map((log) => log.roadmapId).sort((left, right) => left - right),
    [34, 35],
  );
});

test("does not send scheduled email for completed roadmaps", async () => {
  reset();
  setRoadmap({ id: 38, status: "completed" });

  const summary = await processRoadmapDailyEmails();

  assert.deepEqual(summary, { processed: 0, sent: 0, skipped: 0, failed: 0 });
  assert.equal(sentEmails.length, 0);
});

test("concurrent immediate and cron attempts send at most one email for a roadmap/date", async () => {
  reset();
  setRoadmap({ id: 36 });

  const results = await Promise.all([
    sendRoadmapEmailOnce({ roadmapId: 36, dayNumber: 1 }),
    sendRoadmapEmailOnce({ roadmapId: 36 }),
  ]);

  assert.equal(results.filter((result) => result.sent).length, 1);
  assert.equal(results.filter((result) => result.skipped).length, 1);
  assert.equal(sentEmails.length, 1);
  assert.equal(emailLogs.length, 1);
});

test("SMTP failure leaves no sent log so the cron can retry", async () => {
  reset();
  setRoadmap({ id: 37, email: "fail@example.com" });

  await assert.rejects(
    sendRoadmapEmailOnce({ roadmapId: 37, dayNumber: 1 }),
    /Unable to send the roadmap email/,
  );

  assert.equal(emailLogs.length, 0);
  roadmaps.get(37).owner.email = "retry@example.com";
  const retry = await sendRoadmapEmailOnce({ roadmapId: 37, dayNumber: 1 });
  assert.equal(retry.sent, true);
  assert.equal(emailLogs.length, 1);
});
