require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");
const {
  startEmployeeScheduler,
} = require("./src/services/employeeScheduler");

const PORT = process.env.PORT || 5000;

const startServer = async () => {

  try {

    await connectDB();

    app.listen(
      PORT,
      () => {

        console.log(
          `🚀 Server running on port ${PORT}`
        );

        startEmployeeScheduler();
      }
    );

  } catch (error) {

    console.error(
      "Server startup failed:",
      error
    );

    process.exit(1);
  }
};

startServer();