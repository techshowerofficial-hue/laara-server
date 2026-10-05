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
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Laara Server is running 🚀"
  });
});
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

    app.listen(
      PORT,
      () => {

        console.log(
          `🚀 Server running on port http://10.199.153.238:${PORT}`
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