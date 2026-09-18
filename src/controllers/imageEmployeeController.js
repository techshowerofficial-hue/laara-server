const Employee = require("../models/Employee");
const Execution = require("../models/Execution");
const { runImageEmployee } = require("../engine/employees/imageEmployee");

const testImageEmployee = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const employeeId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    // --------------------------------------------------
    // FIND EMPLOYEE
    // --------------------------------------------------

    const employee = await Employee.findOne({
      _id: employeeId,
      userId,
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // --------------------------------------------------
    // CHECK EMPLOYEE TYPE
    // --------------------------------------------------

    if (employee.type !== "IMAGE_REEL") {
      return res.status(400).json({
        success: false,
        message:
          "This employee is not an IMAGE_REEL employee",
      });
    }

    // --------------------------------------------------
    // CHECK INSTAGRAM CONNECTION
    // --------------------------------------------------

    const instagramConnectionId =
      employee.connections?.instagramConnectionId;

    if (!instagramConnectionId) {
      return res.status(400).json({
        success: false,
        message:
          "Instagram connection is not assigned to this employee",
      });
    }

    // --------------------------------------------------
    // CREATE EXECUTION
    // --------------------------------------------------

    const execution = await Execution.create({
      userId,
      employeeId: employee._id,
      status: "RUNNING",
      input: {
        topic: req.body?.topic || "",
        instruction: req.body?.instruction || "",
      },
      startedAt: new Date(),
    });

    console.log(
      `[Image Employee] Started execution ${execution._id}`
    );

    // --------------------------------------------------
    // RUN IMAGE EMPLOYEE
    // --------------------------------------------------

    const result = await runImageEmployee({
      employee,
      userId,
      executionId: execution._id.toString(),

      input: {
        topic: req.body?.topic || "",
        instruction: req.body?.instruction || "",
      },
    });

    // --------------------------------------------------
    // UPDATE EXECUTION SUCCESS
    // --------------------------------------------------

    execution.status = "SUCCESS";
    execution.output = result.output;
    execution.completedAt = new Date();

    await execution.save();

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Image Employee executed successfully",

      executionId: execution._id,

      employeeId: employee._id,

      result,
    });
  } catch (error) {
    console.error(
      "[Image Employee] Execution failed:",
      error
    );

    // --------------------------------------------------
    // TRY TO MARK EXECUTION FAILED
    // --------------------------------------------------

    try {
      const executionId =
        error?.executionId ||
        req.body?.executionId;

      if (executionId) {
        await Execution.findByIdAndUpdate(
          executionId,
          {
            status: "FAILED",
            error: error.message,
            completedAt: new Date(),
          }
        );
      }
    } catch (updateError) {
      console.error(
        "[Image Employee] Failed to update execution:",
        updateError
      );
    }

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Image Employee execution failed",
    });
  }
};

module.exports = {
  testImageEmployee,
};