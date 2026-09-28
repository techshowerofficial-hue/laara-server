const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const User = require("../models/User");
const Account = require("../models/Account");

const generateToken = require("../utils/generateToken");

// ============================================================
// CONSTANTS
// ============================================================

const TRIAL_DAYS = 7;

// ============================================================
// HELPERS
// ============================================================

const getTrialEndDate = startDate => {
  const endDate = new Date(startDate);

  endDate.setDate(endDate.getDate() + TRIAL_DAYS);

  return endDate;
};

const getAccountState = account => {
  if (!account) {
    return {
      status: "UNKNOWN",
      trial: {
        isActive: false,
        startDate: null,
        endDate: null,
        remainingDays: 0,
      },
    };
  }

  const now = new Date();

  let status = account.status;
  let trialActive = account.trial?.isActive === true;

  let remainingDays = 0;

  // ----------------------------------------------------------
  // TRIAL STATUS
  // ----------------------------------------------------------

  if (
    status === "TRIAL" &&
    account.trial?.endDate
  ) {
    const endDate = new Date(account.trial.endDate);

    if (now < endDate) {
      trialActive = true;

      const millisecondsRemaining =
        endDate.getTime() - now.getTime();

      remainingDays = Math.ceil(
        millisecondsRemaining /
          (1000 * 60 * 60 * 24)
      );
    } else {
      // Trial expired
      trialActive = false;
      remainingDays = 0;
      status = "EXPIRED";
    }
  }

  // ----------------------------------------------------------
  // ACTIVE ACCOUNT
  // ----------------------------------------------------------

  if (status === "ACTIVE") {
    trialActive = false;
  }

  return {
    status,

    plan: account.plan,

    trial: {
      isActive: trialActive,
      startDate: account.trial?.startDate || null,
      endDate: account.trial?.endDate || null,
      remainingDays,
    },

    billing: {
      status:
        account.billing?.status ||
        "NOT_REQUIRED",

      currency:
        account.billing?.currency ||
        "INR",

      currentPeriodStart:
        account.billing?.currentPeriodStart ||
        null,

      currentPeriodEnd:
        account.billing?.currentPeriodEnd ||
        null,

      nextPaymentDate:
        account.billing?.nextPaymentDate ||
        null,
    },

    limits: {
      maxEmployees:
        account.limits?.maxEmployees ?? 1,

      maxMonthlyOutputs:
        account.limits?.maxMonthlyOutputs ?? 30,
    },

    settings: {
      timezone:
        account.settings?.timezone ||
        "Asia/Kolkata",

      language:
        account.settings?.language ||
        "en",
    },
  };
};

// ============================================================
// USER RESPONSE
// ============================================================

const buildUserResponse = user => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    accountType: user.accountType || "NORMAL",
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
  };
};

// ============================================================
// REGISTER
// ============================================================

const register = async (req, res) => {
  const session = await User.startSession();

  try {
    const {
      name,
      email,
      password,
    } = req.body;

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and password are required",
      });
    }

    const cleanName = name.trim();
    const normalizedEmail =
      email.trim().toLowerCase();

    if (cleanName.length < 2) {
      return res.status(400).json({
        success: false,
        message:
          "Name must be at least 2 characters",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters",
      });
    }

    // --------------------------------------------------------
    // CHECK EXISTING USER
    // --------------------------------------------------------

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists",
      });
    }

    // --------------------------------------------------------
    // PASSWORD HASH
    // --------------------------------------------------------

    const hashedPassword =
      await bcrypt.hash(password, 12);

    // --------------------------------------------------------
    // TRIAL DATES
    // --------------------------------------------------------

    const trialStartDate = new Date();

    const trialEndDate =
      getTrialEndDate(trialStartDate);

    let createdUser;
    let createdAccount;

    // --------------------------------------------------------
    // ATOMIC USER + ACCOUNT CREATION
    // --------------------------------------------------------

    await session.withTransaction(async () => {
      const users = await User.create(
        [
          {
            name: cleanName,
            email: normalizedEmail,
            password: hashedPassword,

            status: "ACTIVE",

            isEmailVerified: false,

            role: "USER",

            lastLoginAt: null,
          },
        ],
        {
          session,
        }
      );

      createdUser = users[0];

      const accounts = await Account.create(
        [
          {
            userId: createdUser._id,

            status: "TRIAL",

            plan: "FREE",

            trial: {
              isActive: true,
              startDate: trialStartDate,
              endDate: trialEndDate,
            },

            billing: {
              status: "NOT_REQUIRED",

              currency: "INR",

              currentPeriodStart: null,

              currentPeriodEnd: null,

              nextPaymentDate: null,
            },

            limits: {
              maxEmployees: 1,
              maxMonthlyOutputs: 30,
            },

            settings: {
              timezone: "Asia/Kolkata",
              language: "en",
            },
          },
        ],
        {
          session,
        }
      );

      createdAccount = accounts[0];
    });

    // --------------------------------------------------------
    // JWT
    // --------------------------------------------------------

    const token =
      generateToken(createdUser._id);

    // --------------------------------------------------------
    // ACCOUNT STATE
    // --------------------------------------------------------

    const accountState =
      getAccountState(createdAccount);

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(201).json({
      success: true,

      message:
        "Account created successfully",

      token,

      user: buildUserResponse(
        createdUser
      ),

      account: accountState,
    });
  } catch (error) {
    console.error(
      "REGISTER ERROR:",
      error
    );

    // Mongo duplicate key
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Unable to create account",
    });
  } finally {
    await session.endSession();
  }
};

// ============================================================
// LOGIN
// ============================================================

const login = async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // --------------------------------------------------------
    // USER
    // --------------------------------------------------------

    const user = await User.findOne({
      email: normalizedEmail,
    }).select(
      "+password"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    // --------------------------------------------------------
    // ACCOUNT STATUS
    // --------------------------------------------------------

    if (user.status === "SUSPENDED") {
      return res.status(403).json({
        success: false,
        message:
          "Your account has been suspended",
      });
    }

    if (user.status === "DELETED") {
      return res.status(403).json({
        success: false,
        message:
          "This account is no longer available",
      });
    }

    // --------------------------------------------------------
    // PASSWORD
    // --------------------------------------------------------

    const passwordCorrect =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordCorrect) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    // --------------------------------------------------------
    // ACCOUNT
    // --------------------------------------------------------

    const account =
      await Account.findOne({
        userId: user._id,
      });

    if (!account) {
      return res.status(500).json({
        success: false,
        message:
          "Account configuration not found",
      });
    }

    // --------------------------------------------------------
    // CHECK TRIAL EXPIRATION
    // --------------------------------------------------------

    const accountState =
      getAccountState(account);

    // --------------------------------------------------------
    // PERSIST EXPIRED TRIAL
    // --------------------------------------------------------

    if (
      account.status === "TRIAL" &&
      accountState.status === "EXPIRED"
    ) {
      account.status = "EXPIRED";

      account.trial.isActive = false;

      await account.save();
    }

    // --------------------------------------------------------
    // UPDATE LAST LOGIN
    // --------------------------------------------------------

    user.lastLoginAt = new Date();

    await user.save();

    // --------------------------------------------------------
    // TOKEN
    // --------------------------------------------------------

    const token =
      generateToken(user._id);

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Login successful",

      token,

      user: buildUserResponse(user),

      account: {
        ...accountState,

        status:
          account.status === "TRIAL" &&
          accountState.status === "EXPIRED"
            ? "EXPIRED"
            : accountState.status,
      },
    });
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to login",
    });
  }
};

// ============================================================
// GET ME
// ============================================================

const getMe = async (req, res) => {
  try {
    const user =
      await User.findById(
        req.user.userId
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    if (user.status === "DELETED") {
      return res.status(403).json({
        success: false,
        message:
          "This account is no longer available",
      });
    }

    // --------------------------------------------------------
    // ACCOUNT
    // --------------------------------------------------------

    const account =
      await Account.findOne({
        userId: user._id,
      });

    if (!account) {
      return res.status(500).json({
        success: false,
        message:
          "Account configuration not found",
      });
    }

    // --------------------------------------------------------
    // CALCULATE CURRENT STATE
    // --------------------------------------------------------

    const accountState =
      getAccountState(account);

    // --------------------------------------------------------
    // SAVE EXPIRED STATUS
    // --------------------------------------------------------

    if (
      account.status === "TRIAL" &&
      accountState.status === "EXPIRED"
    ) {
      account.status = "EXPIRED";

      account.trial.isActive = false;

      await account.save();
    }

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      user: buildUserResponse(user),

      account: {
        ...accountState,

        status:
          account.status === "TRIAL" &&
          accountState.status === "EXPIRED"
            ? "EXPIRED"
            : accountState.status,
      },
    });
  } catch (error) {
    console.error(
      "GET ME ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch account",
    });
  }
};

// ============================================================
// FORGOT PASSWORD
// ============================================================

const forgotPassword = async (
  req,
  res
) => {
  try {
    const {email} = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message:
          "Email is required",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const user =
      await User.findOne({
        email: normalizedEmail,
      }).select(
        "+resetPasswordToken +resetPasswordExpires"
      );

    /*
     * Do not reveal whether the email
     * exists or not.
     */

    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If an account exists with this email, a reset link will be sent",
      });
    }

    // --------------------------------------------------------
    // GENERATE RESET TOKEN
    // --------------------------------------------------------

    const rawToken =
      crypto.randomBytes(32).toString("hex");

    const hashedToken =
      crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

    user.resetPasswordToken =
      hashedToken;

    user.resetPasswordExpires =
      new Date(
        Date.now() +
          15 * 60 * 1000
      );

    await user.save();

    /*
     * TODO:
     * Send rawToken through email service.
     *
     * Never send hashedToken.
     */

    console.log(
      "PASSWORD RESET TOKEN:",
      rawToken
    );

    return res.status(200).json({
      success: true,
      message:
        "If an account exists with this email, a reset link will be sent",
    });
  } catch (error) {
    console.error(
      "FORGOT PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to process password reset request",
    });
  }
};

// ============================================================
// RESET PASSWORD
// ============================================================

const resetPassword = async (
  req,
  res
) => {
  try {
    const {
      token,
      password,
    } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Token and new password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters",
      });
    }

    // --------------------------------------------------------
    // HASH PROVIDED TOKEN
    // --------------------------------------------------------

    const hashedToken =
      crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    // --------------------------------------------------------
    // FIND VALID USER
    // --------------------------------------------------------

    const user =
      await User.findOne({
        resetPasswordToken:
          hashedToken,

        resetPasswordExpires: {
          $gt: new Date(),
        },
      }).select(
        "+password +resetPasswordToken +resetPasswordExpires"
      );

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired reset token",
      });
    }

    // --------------------------------------------------------
    // NEW PASSWORD
    // --------------------------------------------------------

    user.password =
      await bcrypt.hash(
        password,
        12
      );

    // --------------------------------------------------------
    // INVALIDATE RESET TOKEN
    // --------------------------------------------------------

    user.resetPasswordToken =
      undefined;

    user.resetPasswordExpires =
      undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully",
    });
  } catch (error) {
    console.error(
      "RESET PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to reset password",
    });
  }
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
};