const assert = require("node:assert/strict");
const test = require("node:test");

const poolPath = require.resolve("../src/config/db");
const contextPath = require.resolve("../src/services/assistantContextService");
const pool = { query: async () => ({ rows: [] }) };
require.cache[poolPath] = {
  id: poolPath,
  filename: poolPath,
  loaded: true,
  exports: pool,
};
delete require.cache[contextPath];
const {
  MAX_CONTEXT_CHARACTERS,
  INVENTORY_PAGE_SIZE,
  createDeterministicAnswer,
  createMissingDayReply,
  createNoMatchReply,
  loadAssistantContext,
} = require(contextPath);

const roadmapRows = [
  {
    roadmap_id: 201,
    roadmap_title: "50-Day Cloud + DevOps Full Study Plan",
    roadmap_description: "A broad cloud and operations program.",
    current_day: 7,
    total_days: 50,
    roadmap_status: "active",
    roadmap_created_at: "2026-10-09T00:00:00.000Z",
    day_id: 701,
    day_number: 7,
    day_title: "Linux intro & filesystem basics",
    day_description: "Learn filesystem navigation.",
    day_topics: '["Files", "Directories"]',
    day_status: "in_progress",
    completed_at: null,
  },
  {
    roadmap_id: 203,
    roadmap_title: "Completed Fundamentals Roadmap",
    roadmap_description: "A finished learning plan.",
    current_day: 2,
    total_days: 2,
    roadmap_status: "completed",
    roadmap_created_at: "2026-08-01T00:00:00.000Z",
    day_id: 902,
    day_number: 2,
    day_title: "Final review",
    day_description: "Review the completed plan.",
    day_topics: '["Review"]',
    day_status: "completed",
    completed_at: "2026-08-02T12:00:00.000Z",
  },
  {
    roadmap_id: 204,
    roadmap_title: "30-Day JavaScript Foundations",
    roadmap_description: "A completed JavaScript study plan.",
    current_day: 30,
    total_days: 30,
    roadmap_status: "completed",
    roadmap_created_at: "2026-07-01T00:00:00.000Z",
    day_id: 930,
    day_number: 30,
    day_title: "Final project review",
    day_description: "Review the finished project.",
    day_topics: '["Review"]',
    day_status: "completed",
    completed_at: "2026-07-30T12:00:00.000Z",
  },
  {
    roadmap_id: 202,
    roadmap_title: "30-Day AI Integration Roadmap for MERN developers",
    roadmap_description: "Build AI features into MERN applications.",
    current_day: 4,
    total_days: 30,
    roadmap_status: "active",
    roadmap_created_at: "2026-09-01T00:00:00.000Z",
    day_id: 801,
    day_number: 1,
    day_title: "API fundamentals",
    day_description: "Review API integration fundamentals.",
    day_topics: '["REST APIs"]',
    day_status: "completed",
    completed_at: "2026-09-01T12:00:00.000Z",
  },
  {
    roadmap_id: 202,
    roadmap_title: "30-Day AI Integration Roadmap for MERN developers",
    roadmap_description: "Build AI features into MERN applications.",
    current_day: 4,
    total_days: 30,
    roadmap_status: "active",
    roadmap_created_at: "2026-09-01T00:00:00.000Z",
    day_id: 804,
    day_number: 4,
    day_title: "Connect an LLM provider",
    day_description: "Create a secure server-side model integration.",
    day_topics: '["Groq API", "Server-side secrets"]',
    day_status: "in_progress",
    completed_at: null,
  },
  {
    roadmap_id: 202,
    roadmap_title: "30-Day AI Integration Roadmap for MERN developers",
    roadmap_description: "Build AI features into MERN applications.",
    current_day: 4,
    total_days: 30,
    roadmap_status: "active",
    roadmap_created_at: "2026-09-01T00:00:00.000Z",
    day_id: 802,
    day_number: 2,
    day_title: "Prompt design",
    day_description: "Write reliable prompts.",
    day_topics: '["Prompt structure"]',
    day_status: "completed",
    completed_at: "2026-09-02T12:00:00.000Z",
  },
  {
    roadmap_id: 202,
    roadmap_title: "30-Day AI Integration Roadmap for MERN developers",
    roadmap_description: "Build AI features into MERN applications.",
    current_day: 4,
    total_days: 30,
    roadmap_status: "active",
    roadmap_created_at: "2026-09-01T00:00:00.000Z",
    day_id: 803,
    day_number: 3,
    day_title: "MERN API design",
    day_description: "Plan the server interface.",
    day_topics: '["Express"]',
    day_status: "completed",
    completed_at: "2026-09-03T12:00:00.000Z",
  },
];

const tasks = [
  { id: 1, title: "Ship AI integration", description: "Connect model API", status: "completed", due_date: "2026-10-01", has_attachment: false },
  { id: 2, title: "Review roadmap notes", description: "Read notes", status: "pending", due_date: null, has_attachment: false },
  { id: 3, title: "Secure API credentials", description: "Move secret server-side", status: "in_progress", due_date: "2026-10-12", has_attachment: true },
  { id: 4, title: "Write integration tests", description: "Cover assistant paths", status: "completed", due_date: null, has_attachment: false },
];

function installFixture() {
  const queries = [];
  pool.query = async (sql, values) => {
    queries.push({ sql, values });
    return sql.includes("FROM learning_roadmaps")
      ? { rows: roadmapRows }
      : { rows: tasks };
  };
  return queries;
}

test("selects the named older roadmap and its requested day despite a newer roadmap", async () => {
  const queries = installFixture();
  const context = await loadAssistantContext(
    17,
    "Explain day 4 of my 30-Day AI Integration Roadmap for MERN developers",
  );

  assert.equal(context.modelContext.roadmapSelection.status, "matched");
  assert.equal(context.modelContext.selectedRoadmap.title, "30-Day AI Integration Roadmap for MERN developers");
  assert.deepEqual(context.modelContext.selectedRoadmap.requestedDaysFound, [4]);
  assert.deepEqual(context.modelContext.selectedRoadmap.days.map((day) => day.dayNumber), [4]);
  assert.equal(context.modelContext.selectedRoadmap.days[0].title, "Connect an LLM provider");
  assert.deepEqual(context.modelContext.selectedRoadmap.days[0].topics, ["Groq API", "Server-side secrets"]);
  assert.equal(context.modelContext.selectedRoadmap.days[0].status, "in_progress");
  assert.equal(context.modelContext.selectedRoadmap.days[0].completedAt, null);
  assert.equal(context.modelContext.roadmapOverview.totalRoadmaps, 4);
  assert.equal(context.inventory.roadmaps.length, 4);
  assert.ok(context.inventory.roadmaps.some((roadmap) => roadmap.status === "completed"));

  assert.equal(queries.length, 2);
  assert.match(queries[0].sql, /WHERE lr\.user_id = \$1/);
  assert.doesNotMatch(queries[0].sql, /lr\.status\s*=\s*'active'/);
  assert.doesNotMatch(queries[0].sql, /LIMIT\s+1/i);
  assert.match(queries[1].sql, /WHERE owner_id = \$1/);
  for (const query of queries) assert.deepEqual(query.values, [17]);
});

test("reports accurate roadmap and task progress including completed tasks", async () => {
  installFixture();
  const context = await loadAssistantContext(17, "How is my AI Integration Roadmap progressing, and how many tasks are complete?");

  assert.equal(context.modelContext.selectedRoadmap.title, "30-Day AI Integration Roadmap for MERN developers");
  assert.deepEqual(context.modelContext.selectedRoadmap.progress.dayCounts, {
    completed: 3,
    in_progress: 1,
    pending: 0,
    other: 0,
  });
  assert.equal(context.modelContext.selectedRoadmap.progress.completedDays, 3);
  assert.equal(context.modelContext.selectedRoadmap.progress.dayRecordCount, 4);
  assert.equal(context.modelContext.selectedRoadmap.progress.configuredTotalDays, 30);
  assert.deepEqual(context.inventory.taskCounts, {
    total: 4,
    completed: 2,
    inProgress: 1,
    pending: 1,
    other: 0,
  });
  assert.equal(context.modelContext.tasks.details.some((task) => task.status === "completed"), true);
  assert.equal(context.modelContext.tasks.details[0].hasAttachment, false);
  assert.equal(context.modelContext.tasks.details[0].dueDate, "2026-10-01");
});

test("identifies a requested day that is absent from the selected roadmap records", async () => {
  installFixture();
  const context = await loadAssistantContext(17, "What is day 30 of the 30-Day AI Integration Roadmap?");

  assert.equal(context.modelContext.roadmapSelection.status, "matched");
  assert.deepEqual(context.modelContext.selectedRoadmap.requestedDayNumbers, [30]);
  assert.deepEqual(context.modelContext.selectedRoadmap.requestedDaysFound, []);
  assert.match(createMissingDayReply(context.modelContext), /couldn't find Day 30/);
  assert.match(createMissingDayReply(context.modelContext), /30-Day AI Integration Roadmap/);
});

test("returns a clear no-match answer instead of selecting another roadmap", async () => {
  installFixture();
  const context = await loadAssistantContext(17, "Tell me about my 10-Day Quantum Gardening Roadmap");

  assert.equal(context.modelContext.roadmapSelection.status, "unmatched");
  assert.equal(context.modelContext.selectedRoadmap, null);
  const answer = createNoMatchReply(context.modelContext);
  assert.match(answer, /couldn't match that roadmap/);
  assert.match(answer, /50-Day Cloud \+ DevOps Full Study Plan/);
  assert.match(answer, /30-Day AI Integration Roadmap for MERN developers/);
  assert.doesNotMatch(answer, /Linux intro/);
});

test("keeps unmatched explicit roadmap keywords from hiding a uniquely named roadmap", async () => {
  installFixture();
  const context = await loadAssistantContext(17, "What is day 4 of the AI Integration roadmap?");
  assert.equal(context.modelContext.roadmapSelection.status, "matched");
  assert.equal(context.modelContext.selectedRoadmap.title, "30-Day AI Integration Roadmap for MERN developers");
});

test("does not guess when distinctive roadmap keywords match multiple records", async () => {
  const duplicateAiRoadmap = {
    ...roadmapRows[0],
    roadmap_id: 205,
    roadmap_title: "AI Roadmap for Python Developers",
    roadmap_description: "A different AI learning plan.",
  };
  pool.query = async (sql) => sql.includes("FROM learning_roadmaps")
    ? { rows: [...roadmapRows, duplicateAiRoadmap] }
    : { rows: tasks };

  const context = await loadAssistantContext(17, "How is my AI roadmap progressing?");
  assert.equal(context.modelContext.roadmapSelection.status, "ambiguous");
  assert.equal(context.modelContext.selectedRoadmap, null);
  assert.equal(context.modelContext.roadmapSelection.candidates.length, 2);
});

test("caps model context while preserving aggregate counts", async () => {
  const manyTasks = Array.from({ length: 80 }, (_, index) => ({
    id: index + 1,
    title: `Task ${index + 1}`,
    description: "Details ".repeat(100),
    status: index % 2 ? "completed" : "pending",
    due_date: null,
    has_attachment: false,
  }));
  pool.query = async (sql) => sql.includes("FROM learning_roadmaps")
    ? { rows: roadmapRows }
    : { rows: manyTasks };
  const context = await loadAssistantContext(17, "summarize my tasks");

  assert.ok(JSON.stringify(context.modelContext).length <= MAX_CONTEXT_CHARACTERS);
  assert.equal(context.inventory.taskCounts.total, 80);
  assert.equal(context.inventory.taskCounts.completed, 40);
  assert.equal(context.inventory.taskCounts.pending, 40);
  assert.ok(context.modelContext.tasks.detailsOmitted > 0);
  const answer = createDeterministicAnswer("list my tasks", context);
  assert.ok(answer.includes(`Showing 1–${INVENTORY_PAGE_SIZE} of 80`));
  assert.match(answer, /page 2/);
});

test("deterministically lists all four roadmaps and all four tasks with status and due dates", async () => {
  installFixture();
  const context = await loadAssistantContext(17, "list my roadmaps in my project");
  const roadmaps = createDeterministicAnswer("list my roadmaps in my project", context);
  assert.match(roadmaps, /Your roadmaps \(4\)/);
  assert.match(roadmaps, /50-Day Cloud \+ DevOps Full Study Plan — Active/);
  assert.match(roadmaps, /30-Day AI Integration Roadmap for MERN developers — Active/);
  assert.match(roadmaps, /Completed Fundamentals Roadmap — Completed/);
  assert.match(roadmaps, /30-Day JavaScript Foundations — Completed/);

  const tasks = createDeterministicAnswer("list all my tasks", context);
  assert.match(tasks, /Your tasks \(4\)/);
  assert.match(tasks, /Ship AI integration — Completed — Due 2026-10-01/);
  assert.match(tasks, /Review roadmap notes — Pending/);
  assert.match(tasks, /Secure API credentials — In progress — Due 2026-10-12/);
  assert.match(tasks, /Write integration tests — Completed/);
  assert.doesNotMatch(tasks, /\|.*\|/);
});

test("fresh database reads reflect a task inserted and deleted between assistant requests", async () => {
  let currentTasks = [...tasks];
  pool.query = async (sql) => sql.includes("FROM learning_roadmaps")
    ? { rows: roadmapRows }
    : { rows: currentTasks };

  const first = await loadAssistantContext(17, "list my tasks");
  assert.doesNotMatch(createDeterministicAnswer("list my tasks", first), /Newly created task/);

  currentTasks = [...currentTasks, {
    id: 5,
    title: "Newly created task",
    description: "Created after server startup",
    status: "pending",
    due_date: null,
    has_attachment: false,
  }];
  const afterInsert = await loadAssistantContext(17, "list my tasks");
  assert.match(createDeterministicAnswer("list my tasks", afterInsert), /Newly created task/);

  currentTasks = currentTasks.filter((task) => task.title !== "Newly created task");
  const afterDelete = await loadAssistantContext(17, "list my tasks");
  assert.doesNotMatch(createDeterministicAnswer("list my tasks", afterDelete), /Newly created task/);
});

test("queries use the authenticated user parameter and return separate user inventories", async () => {
  const userTasks = new Map([
    [101, [{ id: 1, title: "User A private task", status: "pending", has_attachment: false }]],
    [202, [{ id: 2, title: "User B private task", status: "completed", has_attachment: false }]],
  ]);
  const userRoadmaps = new Map([
    [101, [{ ...roadmapRows[0], roadmap_id: 101, roadmap_title: "User A roadmap" }]],
    [202, [{ ...roadmapRows[1], roadmap_id: 202, roadmap_title: "User B roadmap" }]],
  ]);
  const observedQueries = [];
  pool.query = async (sql, values) => {
    observedQueries.push({ sql, values });
    const userId = values[0];
    return sql.includes("FROM learning_roadmaps")
      ? { rows: userRoadmaps.get(userId) }
      : { rows: userTasks.get(userId) };
  };

  const userA = await loadAssistantContext(101, "list my tasks");
  const userB = await loadAssistantContext(202, "list my tasks");
  assert.deepEqual(userA.inventory.tasks.map((task) => task.title), ["User A private task"]);
  assert.deepEqual(userB.inventory.tasks.map((task) => task.title), ["User B private task"]);
  assert.deepEqual(userA.inventory.roadmaps.map((roadmap) => roadmap.title), ["User A roadmap"]);
  assert.deepEqual(userB.inventory.roadmaps.map((roadmap) => roadmap.title), ["User B roadmap"]);
  assert.equal(JSON.stringify(userA.inventory).includes("User B"), false);
  assert.equal(JSON.stringify(userB.inventory).includes("User A"), false);
  assert.ok(observedQueries.every(({ values }) => values.length === 1 && [101, 202].includes(values[0])));
  assert.match(observedQueries[0].sql, /WHERE lr\.user_id = \$1/);
  assert.match(observedQueries[1].sql, /WHERE owner_id = \$1/);
});
