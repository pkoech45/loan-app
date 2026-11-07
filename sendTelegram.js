
async function sendTelegramNotification(application) {
  const Telegram_BOT_TOKEN = process.env.BOT_TOKEN;
  const Telegram_CHAT_ID = process.env.ADMIN_CHAT_ID;

  if (!Telegram_BOT_TOKEN || !Telegram_CHAT_ID) {
    throw new Error("Missing Telegram configuration in .env");
  }

  const message = [
    "🔔 NEW LOAN APPLICATION",
    "",
    `Applicant: ${application.full_name || "Not provided"}`,
    `Phone: ${application.phone_number || "Not provided"}`,
    `Loan amount: BWP ${application.loan_amount_bwp ?? "Not provided"}`,
    `Period: ${application.period_months ?? "Not provided"} months`,
    `Monthly payment: BWP ${application.monthly_payment_bwp ?? "Not provided"}`,
    `Total repayment: BWP ${application.total_repayment_bwp ?? "Not provided"}`,
    "",
    `Application ID: ${application.id || "Pending"}`,
    `Status: ${application.status || "pending"}`,
    `Submitted: ${application.created_at || new Date().toISOString()}`,
    "",
    "This is a demo loan application notification.",
    "No approval decision has been made yet."
  ].join("\n");

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: message
      })
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      result.description || "Telegram notification failed"
    );
  }

  return result;
}

module.exports = sendTelegramNotification;
