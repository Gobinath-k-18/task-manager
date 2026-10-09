const assert = require("node:assert/strict");
const test = require("node:test");
const {
  generateRoadmapFromText,
  roadmapResponseSchema,
  validateRoadmap,
} = require("../src/services/roadmapAiService");

const sourceText = Array.from(
  { length: 50 },
  (_, index) => `Day ${index + 1}: Study the distinct MERN interview topic ${index + 1}.`,
).join("\n");

function assertStrictSchema(schema) {
  if (schema.type === "object") {
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(
      [...schema.required].sort(),
      Object.keys(schema.properties).sort(),
    );
    Object.values(schema.properties).forEach(assertStrictSchema);
  } else if (schema.type === "array") {
    assertStrictSchema(schema.items);
  }
}

function createRoadmap(days) {
  return {
    title: "50-Day MERN Interview Plan",
    description: "A source-based preparation plan.",
    days: Array.from({ length: days }, (_, index) => ({
      day_number: index + 1,
      title: `MERN topic ${index + 1}`,
      description: `Study the topic described for day ${index + 1}.`,
      topics: [`Topic ${index + 1}`],
    })),
  };
}

function fakeGroq(responses, requests = []) {
  return {
    chat: {
      completions: {
        async create(request) {
          requests.push(request);
          const response = responses.shift();
          if (response instanceof Error) throw response;
          return {
            choices: [{ message: { content: JSON.stringify(response) } }],
          };
        },
      },
    },
  };
}

test("sends a strict schema and validates a source-based 50-day roadmap", async () => {
  process.env.GROQ_API_KEY = "local-test-key";
  const requests = [];
  const roadmap = await generateRoadmapFromText(
    sourceText,
    fakeGroq([createRoadmap(50)], requests),
  );

  assert.equal(roadmap.days.length, 50);
  assert.deepEqual(
    roadmap.days.map((day) => day.day_number),
    Array.from({ length: 50 }, (_, index) => index + 1),
  );
  const persistedRoadmap = { ...roadmap, total_days: roadmap.days.length };
  assert.equal(persistedRoadmap.total_days, 50);

  const schema = requests[0].response_format.json_schema.schema;
  assert.equal(requests[0].response_format.type, "json_schema");
  assert.equal(requests[0].response_format.json_schema.name, "learning_roadmap");
  assert.equal(requests[0].response_format.json_schema.strict, true);
  assertStrictSchema(schema);
  assert.equal(schema.type, "object");
  assert.equal(schema.properties.title.type, "string");
  assert.equal(schema.properties.description.type, "string");
  assert.deepEqual(
    schema.properties.days.items.required,
    ["day_number", "title", "description", "topics"],
  );
  assert.equal(schema.properties.days.items.properties.day_number.type, "integer");
  assert.equal("minimum" in schema.properties.days.items.properties.day_number, false);
  assert.equal("maximum" in schema.properties.days.items.properties.day_number, false);
  assert.equal("minItems" in schema.properties.days, false);
  assert.equal("maxItems" in schema.properties.days, false);
  assert.equal(schema.properties.days.items.properties.title.type, "string");
  assert.equal(schema.properties.days.items.properties.description.type, "string");
  assert.equal(schema.properties.days.items.properties.topics.type, "array");
  assert.deepEqual(schema.required, ["title", "description", "days"]);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.days.items.additionalProperties, false);
  assert.equal(schema.properties.days.items.properties.topics.items.type, "string");
  assert.match(requests[0].messages[0].content, /up to 90 days/);
  assert.match(requests[0].messages[0].content, /no Markdown fences/);
  assert.match(requests[0].messages[1].content, new RegExp(sourceText.slice(0, 30)));
});

test("retries json_validate_failed once with the explicit retry prompt", async () => {
  process.env.GROQ_API_KEY = "local-test-key";
  const validationError = new Error("Failed to validate JSON.");
  validationError.status = 400;
  validationError.error = { code: "json_validate_failed" };
  const requests = [];

  const roadmap = await generateRoadmapFromText(
    sourceText,
    fakeGroq([validationError, createRoadmap(50)], requests),
  );

  assert.equal(roadmap.days.length, 50);
  assert.equal(requests.length, 2);
  assert.match(requests[1].messages[0].content, /Before responding, verify/);
});

test("validates plans up to 90 days and rejects plans over the limit", () => {
  assert.equal(validateRoadmap(createRoadmap(90)).days.length, 90);
  assert.throws(() => validateRoadmap(createRoadmap(91)), /between one and 90 days/);
});

test("rejects invalid or non-sequential day numbers", () => {
  const roadmap = createRoadmap(3);
  roadmap.days[1].day_number = 3;
  assert.throws(() => validateRoadmap(roadmap), /sequential numbering/);

  const invalidDay = createRoadmap(1);
  invalidDay.days[0].day_number = 0;
  assert.throws(() => validateRoadmap(invalidDay), /sequential numbering/);
});

test("does not retry unrelated Groq errors", async () => {
  process.env.GROQ_API_KEY = "local-test-key";
  const apiError = new Error("Temporary provider failure.");
  apiError.status = 503;
  apiError.error = { code: "server_error" };
  const requests = [];

  await assert.rejects(
    generateRoadmapFromText(sourceText, fakeGroq([apiError], requests)),
    /Groq roadmap generation failed/,
  );
  assert.equal(requests.length, 1);
});
