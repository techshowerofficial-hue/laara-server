const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  hireEmployee,
  getEmployees,
  getEmployeeById,
  getEmployeeBilling,
  updateEmployee,
  pauseEmployee,
  resumeEmployee,
  cancelEmployee,
} = require("../controllers/employeeController");
const {
  testImageEmployee,
} = require("../controllers/imageEmployeeController");
const {
  testInstagramPublish,
} = require("../controllers/instagramTestController");
const router = express.Router();

router.use(authMiddleware);

router.post(
  "/:id/test-instagram",
  authMiddleware,
  testInstagramPublish
);
/**
 * Hire
 */
router.post("/hire", hireEmployee);

/**
 * List
 */
router.get("/", getEmployees);

/**
 * Single employee
 */
router.get("/:id", getEmployeeById);
router.post(
  "/:id/test-image",
  authMiddleware,
  testImageEmployee
);
/**
 * Billing / trial
 */
router.get(
  "/:id/billing",
  getEmployeeBilling
);

/**
 * Update customization
 */
router.patch(
  "/:id",
  updateEmployee
);

/**
 * Pause
 */
router.patch(
  "/:id/pause",
  pauseEmployee
);

/**
 * Resume
 */
router.patch(
  "/:id/resume",
  resumeEmployee
);

/**
 * Cancel
 */
router.delete(
  "/:id",
  cancelEmployee
);

module.exports = router;