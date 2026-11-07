
async function sendTelegramNotification(applicationId) {
  const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.ADMIN_CHAT_ID;
  const MOCKAPI_URL = process.env.MOCKAPI_URL;

  if (!BOT_TOKEN || !ADMIN_CHAT_ID || !MOCKAPI_URL) {
    throw new Error("Missing environment variables");
  }

  // Retrieve the saved application from MockAPI
  const recordResponse = await fetch(
    `${MOCKAPI_URL}/${encodeURIComponent(applicationId)}`
  );

  if (!recordResponse.ok) {
    throw new Error("Could not retrieve application from MockAPI");
  }

  const application = await recordResponse.json();

  const message = [
    "🔔 NEW LOAN APPLICATION",
    "",
    `Applicant: ${application.full_name || "N/A"}`,
    `Phone: ${application.phone_number || "N/A"}`,
    `Loan amount: BWP ${application.loan_amount_bwp ?? "N/A"}`,
    `Period: ${application.period_months ?? "N/A"} months`,
    `Monthly payment: BWP ${application.monthly_payment_bwp ?? "N/A"}`,
    `Total repayment: BWP ${application.total_repayment_bwp ?? "N/A"}`,
    "",
    `Application ID: ${application.id}`,
    `Status: ${application.status || "pending"}`,
    "",
    "Awaiting admin review."
  ].join("\n");

  const telegramResponse = await fetch(
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

  const result = await telegramResponse.json();

  if (!telegramResponse.ok || !result.ok) {
    throw new Error(result.description || "Telegram notification failed");
  }

  return result;
}

module.exports = sendTelegramNotification;

