const Employee = require("../models/Employee");
const { execute: instagramNode } = require("../engine/nodes/instagramNode");

const testInstagramPublish = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const employeeId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

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

    const connectionId =
      employee.connections?.instagramConnectionId;

    if (!connectionId) {
      return res.status(400).json({
        success: false,
        message:
          "Instagram connection is not assigned to this employee",
      });
    }

    const { imageUrl, caption, hashtags } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: "imageUrl is required",
      });
    }

    const finalCaption =
      caption ||
      "Laara Instagram automation test 🚀";

    const finalHashtags = Array.isArray(hashtags)
      ? hashtags
      : [
          "#Laara",
          "#AITest",
          "#Automation",
        ];

    const input = {
     imageUrl: imageUrl,
      caption: finalCaption,
      hashtags: finalHashtags,
      finalCaption: `${finalCaption}\n\n${finalHashtags.join(
        " "
      )}`,
    };

    const context = {
      userId,
      employeeId: employee._id.toString(),
      employee,
    };

    console.log(
      "[Instagram Test] Publishing..."
    );

    const result = await instagramNode({
      input,
      node: {
        type: "instagram",
        config: {
          connectionId,
        },
      },
      context,
    });

    console.log(
      "[Instagram Test] Published:",
      result
    );

    return res.status(200).json({
      success: true,
      message:
        "Instagram post published successfully",
      employeeId,
      connectionId,
      result,
    });
  } catch (error) {
    console.error(
      "[Instagram Test] Failed:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Instagram publishing failed",
    });
  }
};

module.exports = {
  testInstagramPublish,
};