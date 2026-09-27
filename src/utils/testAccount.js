const User = require("../models/User");

const isTestAccount = async (userId) => {
  if (process.env.LAARA_TEST_MODE !== "true") {
    return false;
  }

  const testEmail =
    process.env.LAARA_TEST_EMAIL
      ?.trim()
      .toLowerCase();

  if (!testEmail || !userId) {
    return false;
  }

  const user = await User.findById(userId)
    .select("email")
    .lean();

  if (!user?.email) {
    return false;
  }

  return (
    user.email.trim().toLowerCase() ===
    testEmail
  );
};

module.exports = {
  isTestAccount,
};