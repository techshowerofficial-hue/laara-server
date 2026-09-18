const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  runEmployeeExecution,
  getExecution,
  getEmployeeExecutionHistory,
} = require("../controllers/executionController");

const router = express.Router();

router.use(authMiddleware);

router.post(
  "/employee/:employeeId/run",
  runEmployeeExecution
);

router.get(
  "/employee/:employeeId",
  getEmployeeExecutionHistory
);

router.get(
  "/:executionId",
  getExecution
);

module.exports = router;