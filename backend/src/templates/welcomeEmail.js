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

function createWelcomeEmail({ name, dashboardUrl }) {
  const safeName = escapeHtml(name);
  const safeDashboardUrl = escapeHtml(dashboardUrl);

  return {
    subject: "Welcome to Task Manager",
    text: `Welcome to Task Manager, ${name}!\n\nYour new home for staying organized. Capture your tasks, keep track of what needs to be done, and make progress one step at a time.\n\nVisit your dashboard: ${dashboardUrl}\n\nThanks for joining us,\nThe Task Manager Team`,
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>Welcome to Task Manager</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f3f6fb; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background-color:#f3f6fb; border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background-color:#ffffff; border-collapse:separate; border-spacing:0; border-radius:12px; overflow:hidden;">
            <tr>
              <td align="center" style="padding:32px 24px; background-color:#2563eb;">
                <p style="margin:0; color:#ffffff; font-size:22px; line-height:28px; font-weight:bold;">Task Manager</p>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 24px; font-size:16px; line-height:26px;">
                <h1 style="margin:0 0 16px; color:#111827; font-size:26px; line-height:34px;">Welcome, ${safeName}!</h1>
                <p style="margin:0 0 16px;">We’re glad you’re here. Your Task Manager account is ready to use.</p>
                <p style="margin:0 0 24px;">Task Manager helps you capture what needs to get done, organize your tasks, and keep track of your progress—all in one place.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px; border-collapse:collapse;">
                  <tr>
                    <td align="center" bgcolor="#2563eb" style="border-radius:6px;">
                      <a href="${safeDashboardUrl}" style="display:inline-block; padding:13px 24px; border:1px solid #2563eb; border-radius:6px; color:#ffffff; font-size:16px; line-height:20px; font-weight:bold; text-decoration:none;">Go to your dashboard</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0; color:#4b5563;">Here’s to making your next step a little easier.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 24px; border-top:1px solid #e5e7eb; color:#6b7280; font-size:13px; line-height:20px;">
                <p style="margin:0 0 4px;">Thanks for joining Task Manager.</p>
                <p style="margin:0;">This is an automated welcome message.</p>
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

module.exports = { createWelcomeEmail };
