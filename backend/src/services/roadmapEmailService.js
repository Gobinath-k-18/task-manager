const { sendEmail } = require("./emailService");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

async function sendRoadmapDayEmail({ email, name, roadmapTitle, day }) {
  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof name !== "string" ||
    typeof roadmapTitle !== "string" ||
    !day ||
    !Number.isInteger(day.day_number) ||
    typeof day.title !== "string" ||
    typeof day.description !== "string" ||
    !Array.isArray(day.topics) ||
    !day.topics.every((topic) => typeof topic === "string")
  ) {
    throw new Error("Invalid roadmap email data.");
  }

  const safeName = escapeHtml(name);
  const safeRoadmapTitle = escapeHtml(roadmapTitle);
  const safeDayTitle = escapeHtml(day.title);
  const safeDayDescription = escapeHtml(day.description);
  const safeTopics = day.topics
    .map((topic) => `<li style="margin:0 0 8px; color:#374151;">${escapeHtml(topic)}</li>`)
    .join("");
  const subjectTitle = day.title.replace(/[\r\n]+/g, " ").trim();
  const subject = `TaskFlow — Day ${day.day_number}: ${subjectTitle}`;
  const text = `Hi ${name},\n\nYour learning roadmap: ${roadmapTitle}\nDay ${day.day_number}: ${day.title}\n\n${day.description}\n\nTopics:\n${day.topics.map((topic) => `- ${topic}`).join("\n")}\n\nPlease complete today's task before moving to the next day.\n\nTaskFlow`;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${safeDayTitle}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f3f6fb; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background-color:#f3f6fb; border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background-color:#ffffff; border-collapse:separate; border-spacing:0; border-radius:12px; overflow:hidden;">
            <tr>
              <td align="center" style="padding:28px 24px; background-color:#315ac1;">
                <p style="margin:0; color:#ffffff; font-size:22px; line-height:28px; font-weight:bold;">TaskFlow</p>
                <p style="margin:7px 0 0; color:#dce6ff; font-size:13px; line-height:20px;">Your learning plan for today</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px; font-size:16px; line-height:25px;">
                <h1 style="margin:0 0 12px; color:#111827; font-size:24px; line-height:32px;">Day ${day.day_number}: ${safeDayTitle}</h1>
                <p style="margin:0 0 22px; color:#4b5563;">Hi ${safeName}, here’s your next step in <strong style="color:#1f2937;">${safeRoadmapTitle}</strong>.</p>
                <p style="margin:0 0 18px; color:#374151;">${safeDayDescription}</p>
                <h2 style="margin:0 0 12px; color:#111827; font-size:16px; line-height:23px;">Today's topics</h2>
                <ul style="margin:0 0 24px; padding:0 0 0 22px; color:#374151; font-size:15px; line-height:23px;">
                  ${safeTopics}
                </ul>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-left:4px solid #4668ca; border-collapse:collapse; background-color:#f3f6ff;">
                  <tr>
                    <td style="padding:14px 16px; color:#34466f; font-size:14px; line-height:22px;">
                      Complete today's task before moving on to the next day. Small, steady steps build lasting progress.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 24px; border-top:1px solid #e5e7eb; color:#6b7280; font-size:13px; line-height:20px;">
                <p style="margin:0;">Your daily learning reminder from TaskFlow.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  try {
    return await sendEmail({ to: email.trim(), subject, text, html });
  } catch {
    throw new Error("Unable to send the roadmap day email. Check the email service configuration and try again.");
  }
}

module.exports = { sendRoadmapDayEmail };
