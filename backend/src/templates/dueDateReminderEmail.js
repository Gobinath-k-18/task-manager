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

function formatDueDate(dueDate) {
  const [year, month, day] = String(dueDate).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return String(dueDate);
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function formatStatus(status) {
  return String(status)
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function createDueDateReminderEmail({
  name,
  title,
  description,
  dueDate,
  status,
  dashboardUrl,
}) {
  const dueDateLabel = formatDueDate(dueDate);
  const statusLabel = formatStatus(status);
  const descriptionText = description || "No description provided.";
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(descriptionText);
  const safeDueDate = escapeHtml(dueDateLabel);
  const safeStatus = escapeHtml(statusLabel);
  const safeDashboardUrl = escapeHtml(dashboardUrl);

  return {
    subject: "Reminder: a task is due tomorrow",
    text: `Hi ${name},\n\nThis is a reminder that your task is due tomorrow.\n\nTask: ${title}\nDescription: ${descriptionText}\nDue date: ${dueDateLabel}\nStatus: ${statusLabel}\n\nOpen your dashboard: ${dashboardUrl}\n\nTask Manager`,
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>Task due date reminder</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f3f6fb; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background-color:#f3f6fb; border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background-color:#ffffff; border-collapse:separate; border-spacing:0; border-radius:12px; overflow:hidden;">
            <tr>
              <td align="center" style="padding:28px 24px; background-color:#2563eb;">
                <p style="margin:0; color:#ffffff; font-size:22px; line-height:28px; font-weight:bold;">Task Manager</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px; font-size:16px; line-height:25px;">
                <h1 style="margin:0 0 12px; color:#111827; font-size:24px; line-height:32px;">Your task is due tomorrow</h1>
                <p style="margin:0 0 22px;">Hi ${safeName}, here’s a friendly reminder to review this task before its due date.</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border:1px solid #e5e7eb; border-collapse:collapse;">
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb;">
                      <p style="margin:0 0 4px; color:#6b7280; font-size:12px; line-height:18px; font-weight:bold; text-transform:uppercase;">Task</p>
                      <p style="margin:0; color:#111827; font-size:17px; line-height:24px; font-weight:bold;">${safeTitle}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb;">
                      <p style="margin:0 0 4px; color:#6b7280; font-size:12px; line-height:18px; font-weight:bold; text-transform:uppercase;">Description</p>
                      <p style="margin:0; color:#374151; font-size:15px; line-height:23px;">${safeDescription}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb;">
                      <p style="margin:0 0 4px; color:#6b7280; font-size:12px; line-height:18px; font-weight:bold; text-transform:uppercase;">Due date</p>
                      <p style="margin:0; color:#111827; font-size:15px; line-height:23px;">${safeDueDate}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px;">
                      <p style="margin:0 0 4px; color:#6b7280; font-size:12px; line-height:18px; font-weight:bold; text-transform:uppercase;">Current status</p>
                      <p style="margin:0; color:#111827; font-size:15px; line-height:23px;">${safeStatus}</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px auto 0; border-collapse:collapse;">
                  <tr>
                    <td align="center" bgcolor="#2563eb" style="border-radius:6px;">
                      <a href="${safeDashboardUrl}" style="display:inline-block; padding:13px 24px; border:1px solid #2563eb; border-radius:6px; color:#ffffff; font-size:16px; line-height:20px; font-weight:bold; text-decoration:none;">Open Dashboard</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 24px; border-top:1px solid #e5e7eb; color:#6b7280; font-size:13px; line-height:20px;">
                <p style="margin:0 0 4px;">You’re receiving this because this task is due tomorrow.</p>
                <p style="margin:0;">Task Manager</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}

module.exports = { createDueDateReminderEmail };
