const assert = require("node:assert/strict");
const test = require("node:test");

const poolPath = require.resolve("../src/config/db");
const controllerPath = require.resolve("../src/controllers/roadmapController");
const pool = { query: async () => { throw new Error("Unexpected database query"); } };
require.cache[poolPath] = {
  id: poolPath,
  filename: poolPath,
  loaded: true,
  exports: pool,
};
delete require.cache[controllerPath];
const { deleteRoadmap } = require(controllerPath);

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

function createRequest(roadmapId, userId = 17) {
  return {
    params: { roadmapId },
    userId,
    body: { userId: 99 },
  };
}

test("rejects invalid roadmap IDs without querying the database", async () => {
  for (const roadmapId of ["0", "-1", "1.5", "1abc", "9007199254740992"]) {
    const response = createResponse();
    await deleteRoadmap(createRequest(roadmapId), response);
    assert.equal(response.statusCode, 400, `roadmapId ${roadmapId}`);
  }
});

test("deletes only the roadmap owned by the authenticated user", async () => {
  let query;
  pool.query = async (sql, values) => {
    query = { sql, values };
    return { rowCount: 1, rows: [{ id: 23 }] };
  };

  const response = createResponse();
  await deleteRoadmap(createRequest("23"), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { message: "Roadmap deleted successfully." });
  assert.match(query.sql, /DELETE FROM learning_roadmaps/);
  assert.match(query.sql, /WHERE id = \$1 AND user_id = \$2/);
  assert.match(query.sql, /RETURNING id/);
  assert.deepEqual(query.values, [23, 17]);
});

test("returns 404 when the roadmap is missing or owned by another user", async () => {
  pool.query = async () => ({ rowCount: 0, rows: [] });

  const response = createResponse();
  await deleteRoadmap(createRequest("23"), response);

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { message: "Roadmap not found." });
});

test("reports database failures without pretending deletion succeeded", async () => {
  pool.query = async () => {
    throw new Error("database unavailable");
  };
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const response = createResponse();
    await deleteRoadmap(createRequest("23"), response);
    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { message: "Unable to delete the roadmap." });
  } finally {
    console.error = originalConsoleError;
  }
});
