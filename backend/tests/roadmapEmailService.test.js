const assert = require("node:assert/strict");
const test = require("node:test");

const emailServicePath = require.resolve("../src/services/emailService");
const roadmapEmailServicePath = require.resolve("../src/services/roadmapEmailService");
let capturedMessage;

require.cache[emailServicePath] = {
  id: emailServicePath,
  filename: emailServicePath,
  loaded: true,
  exports: {
    async sendEmail(message) {
      capturedMessage = message;
      return { accepted: [message.to] };
    },
  },
};
delete require.cache[roadmapEmailServicePath];
const { sendRoadmapDayEmail } = require(roadmapEmailServicePath);

test("includes Day 1 learning details and a roadmap link in the welcome email", async () => {
  capturedMessage = null;

  const result = await sendRoadmapDayEmail({
    email: "owner@example.com",
    name: "TaskFlow learner",
    roadmapTitle: "Accessible UI",
    roadmapUrl: "https://taskflow.example/roadmaps/51",
    isWelcome: true,
    day: {
      day_number: 1,
      title: "Start with semantics",
      description: "Learn the foundations of accessible markup.",
      topics: ["Landmarks", "Labels"],
    },
  });

  assert.deepEqual(result, { accepted: ["owner@example.com"] });
  assert.equal(capturedMessage.to, "owner@example.com");
  assert.match(capturedMessage.subject, /Day 1: Start with semantics/);
  assert.match(capturedMessage.text, /Welcome to your learning roadmap, Accessible UI/);
  assert.match(capturedMessage.text, /Learn the foundations of accessible markup/);
  assert.match(capturedMessage.text, /- Landmarks\n- Labels/);
  assert.match(capturedMessage.text, /https:\/\/taskflow\.example\/roadmaps\/51/);
  assert.match(capturedMessage.html, /href="https:\/\/taskflow\.example\/roadmaps\/51"/);
  assert.match(capturedMessage.html, /Landmarks/);
  assert.match(capturedMessage.html, /Labels/);
});
