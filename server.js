
require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const sendTelegramNotification = require("./sendTelegram");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const MOCKAPI_URL = process.env.MOCKAPI_URL;

// Health check
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "loan-demo-api"
  });
});

// Serve the website
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
      total_repayment_bwp
    } = req.body;

    if (
      !full_name ||
      !phone_number ||
      !loan_amount_bwp ||
      !period_months
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
      status: "pending",
      status_token: statusToken,
      created_at: new Date().toISOString()
    };

    // Save application to MockAPI.
    const saveResponse = await fetch(MOCKAPI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(applicationData)
    });

    if (!saveResponse.ok) {
      throw new Error("Failed to save application to MockAPI");
    }

    const savedApplication = await saveResponse.json();

    // Send Telegram notification using the saved MockAPI record.
    let telegramNotification = "sent";

    try {
      await sendTelegramNotification(savedApplication.id);
    } catch (telegramError) {
      telegramNotification = "failed";
      console.error(
        "Telegram notification error:",
        telegramError.message
      );
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

// Check application status
app.get("/api/status", async (req, res) => {
  try {
    const { id, token } = req.query;

    if (!id || !token) {
      return res.status(400).json({
        ok: false,
        error: "Application ID and token are required"
      });
    }

    const response = await fetch(
      `${MOCKAPI_URL.replace(/\/$/, "")}/${encodeURIComponent(id)}`
    );

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
