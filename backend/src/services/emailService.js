const nodemailer = require("nodemailer");
const { createWelcomeEmail } = require("../templates/welcomeEmail");
const { createDueDateReminderEmail } = require("../templates/dueDateReminderEmail");

let transporter;

function getRequiredEnv(name) {
  const value = process.env[name];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required email configuration: ${name}`);
  }

  return value.trim();
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = getRequiredEnv("SMTP_HOST");
  const port = Number(getRequiredEnv("SMTP_PORT"));
  const user = getRequiredEnv("SMTP_USER");
  const pass = getRequiredEnv("SMTP_PASS");

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid port number");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

function getDashboardUrl() {
  const frontendUrl = new URL(getRequiredEnv("FRONTEND_URL"));

  if (frontendUrl.protocol !== "http:" && frontendUrl.protocol !== "https:") {
    throw new Error("FRONTEND_URL must use HTTP or HTTPS");
  }

  return new URL("/dashboard", frontendUrl).toString();
}

function getRoadmapUrl(roadmapId) {
  if (!Number.isSafeInteger(roadmapId) || roadmapId < 1) {
    throw new Error("Roadmap ID must be a valid positive integer");
  }

  const frontendUrl = new URL(getRequiredEnv("FRONTEND_URL"));

  if (frontendUrl.protocol !== "http:" && frontendUrl.protocol !== "https:") {
    throw new Error("FRONTEND_URL must use HTTP or HTTPS");
  }

  return new URL(`/roadmaps/${roadmapId}`, frontendUrl).toString();
}

async function sendEmail({ to, subject, text, html }) {
  return getTransporter().sendMail({
    from: getRequiredEnv("SMTP_FROM"),
    to,
    subject,
    text,
    html,
  });
}

async function sendWelcomeEmail({ name, email }) {
  const message = createWelcomeEmail({
    name,
    dashboardUrl: getDashboardUrl(),
  });

  return sendEmail({ to: email, ...message });
}

async function sendDueDateReminderEmail(task) {
  const message = createDueDateReminderEmail({
    name: task.name,
    title: task.title,
    description: task.description,
    dueDate: task.due_date,
    status: task.status,
    dashboardUrl: getDashboardUrl(),
  });

  return sendEmail({ to: task.email, ...message });
}

module.exports = {
  getRoadmapUrl,
  sendDueDateReminderEmail,
  sendEmail,
  sendWelcomeEmail,
};
