const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const test = require("node:test");
const authMiddleware = require("../src/middleware/authMiddleware");

const originalSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = "assistant-auth-test-secret";

test.after(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

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

function invoke(authorization) {
  const req = { headers: { authorization } };
  const res = createResponse();
  let nextCalled = false;
  authMiddleware(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

test("requires a valid bearer token for the assistant route", () => {
  const missing = invoke(undefined);
  assert.equal(missing.res.statusCode, 401);
  assert.equal(missing.nextCalled, false);

  const invalid = invoke("Bearer not-a-jwt");
  assert.equal(invalid.res.statusCode, 401);
  assert.equal(invalid.nextCalled, false);
});

test("derives the assistant user ID from the verified JWT", () => {
  const token = jwt.sign({ id: 42 }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const result = invoke(`Bearer ${token}`);

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.userId, 42);
});
