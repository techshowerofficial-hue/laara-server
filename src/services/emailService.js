const nodemailer = require("nodemailer");

// ============================================================
// EMAIL TRANSPORTER
// ============================================================

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT || 587),

  secure:
    String(process.env.MAIL_SECURE).toLowerCase() ===
    "true",

  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// ============================================================
// SEND PASSWORD RESET EMAIL
// ============================================================

const sendPasswordResetEmail = async ({
  to,
  name,
  token,
}) => {
  if (!to) {
    throw new Error(
      "Password reset email recipient is required"
    );
  }

  if (!token) {
    throw new Error(
      "Password reset token is required"
    );
  }

  const resetUrl =
    `${process.env.FRONTEND_RESET_URL}` +
    `?token=${encodeURIComponent(token)}`;

const info = await transporter.sendMail({
  from:
    process.env.MAIL_FROM ||
    process.env.MAIL_USER,

  to,

  subject:
    "Reset your Laara password",

  html: `
      <!DOCTYPE html>
      <html>
        <body
          style="
            margin:0;
            padding:0;
            background:#f5f5f5;
            font-family:Arial,sans-serif;
          "
        >

          <div
            style="
              max-width:600px;
              margin:40px auto;
              background:#ffffff;
              border-radius:12px;
              padding:32px;
            "
          >

            <h1
              style="
                margin:0 0 20px;
                color:#111111;
              "
            >
              Laara
            </h1>

            <h2
              style="
                margin:0 0 16px;
                color:#222222;
              "
            >
              Reset your password
            </h2>

            <p
              style="
                color:#555555;
                font-size:15px;
                line-height:1.6;
              "
            >
              Hi ${name || "there"},
            </p>

            <p
              style="
                color:#555555;
                font-size:15px;
                line-height:1.6;
              "
            >
              We received a request to reset your
              Laara account password.
            </p>

            <div style="margin:28px 0;">
              <a
                href="${resetUrl}"
                style="
                  display:inline-block;
                  padding:14px 24px;
                  background:#111111;
                  color:#ffffff;
                  text-decoration:none;
                  border-radius:8px;
                  font-weight:bold;
                "
              >
                Reset Password
              </a>
            </div>

            <p
              style="
                color:#777777;
                font-size:14px;
                line-height:1.6;
              "
            >
              This password reset link will expire
              in 15 minutes.
            </p>

            <p
              style="
                color:#777777;
                font-size:14px;
                line-height:1.6;
              "
            >
              If you did not request a password reset,
              you can safely ignore this email.
            </p>

            <hr
              style="
                border:none;
                border-top:1px solid #eeeeee;
                margin:28px 0;
              "
            />

            <p
              style="
                color:#999999;
                font-size:12px;
              "
            >
              © Laara
            </p>

          </div>

        </body>
      </html>
    `,
  });
  console.log("PASSWORD RESET EMAIL SENT:", {
  messageId: info.messageId,
  response: info.response,
  accepted: info.accepted,
  rejected: info.rejected,
});
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  sendPasswordResetEmail,
};
