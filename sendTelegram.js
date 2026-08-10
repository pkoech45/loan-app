export default async function handler(req, res) {

    if (req.method !== "POST") {

        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }


    try {

        const {
            firstName,
            lastName,
            email,
            phone,
            loanAmount
        } = req.body;


        if (
            !firstName ||
            !lastName ||
            !email ||
            !phone ||
            !loanAmount
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Missing required fields"
            });
        }


        const message =

`🔔 NEW LOAN APPLICATION

━━━━━━━━━━━━━━━━━━

👤 First Name: ${firstName}
👤 Last Name: ${lastName}
📧 Email: ${email}
📱 Phone: +263${phone}
🌍 Country: Zimbabwe
💰 Loan Amount: ${loanAmount}

━━━━━━━━━━━━━━━━━━

✅ Details validated successfully`;


        const telegramResponse =
            await fetch(

                `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,

                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        chat_id:
                            process.env.TELEGRAM_CHAT_ID,

                        text:
                            message

                    })

                }
            );


        const telegramData =
            await telegramResponse.json();


        if (!telegramData.ok) {

            console.error(
                "Telegram error:",
                telegramData
            );


            return res.status(500).json({

                success: false,

                message:
                    "Telegram notification failed."

            });
        }


        return res.status(200).json({

            success: true,

            message:
                "Application sent successfully."

        });


    } catch (error) {

        console.error(error);


        return res.status(500).json({

            success: false,

            message:
                "Server error."

        });
    }
}
