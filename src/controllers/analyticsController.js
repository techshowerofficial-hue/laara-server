const mongoose = require("mongoose");

const Execution = require("../models/Execution");
const Employee = require("../models/Employee");


// ======================================================
// GET ANALYTICS OVERVIEW
// ======================================================

const getAnalyticsOverview = async (req, res) => {
  try {
    const userId = req.user?.userId;

    // ======================================================
    // AUTH
    // ======================================================

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userObjectId =
      new mongoose.Types.ObjectId(userId);

    // ======================================================
    // PERIOD
    // ======================================================

    const period = String(
      req.query.period || "month"
    ).toLowerCase();

    const now = new Date();

    let startDate = null;
    let endDate = new Date(now);

    // ======================================================
    // THIS WEEK
    // ======================================================

    if (period === "week") {
      startDate = new Date(now);

      const day = startDate.getDay();

      const diff =
        day === 0
          ? 6
          : day - 1;

      startDate.setDate(
        startDate.getDate() - diff
      );

      startDate.setHours(
        0,
        0,
        0,
        0
      );
    }

    // ======================================================
    // THIS MONTH
    // ======================================================

    else if (period === "month") {
      startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

      startDate.setHours(
        0,
        0,
        0,
        0
      );
    }

    // ======================================================
    // LAST MONTH
    // ======================================================

    else if (period === "last_month") {
      startDate = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );

      endDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

      endDate.setMilliseconds(
        endDate.getMilliseconds() - 1
      );
    }

    // ======================================================
    // ALL TIME
    // ======================================================

    else if (period === "all") {
      startDate = null;
      endDate = now;
    }

    // ======================================================
    // INVALID PERIOD
    // ======================================================

    else {
      return res.status(400).json({
        success: false,
        message:
          "Invalid period. Use week, month, last_month or all",
      });
    }

    // ======================================================
    // EXECUTION FILTER
    // ======================================================

    const executionFilter = {
      userId: userObjectId,
    };

    if (startDate) {
      executionFilter.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    } else {
      executionFilter.createdAt = {
        $lte: endDate,
      };
    }

    // ======================================================
    // OVERVIEW
    // ======================================================

    const overviewResult =
      await Execution.aggregate([
        {
          $match: executionFilter,
        },

        {
          $group: {
            _id: null,

            total: {
              $sum: 1,
            },

            published: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "success",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            failed: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "failed",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            inProgress: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "running",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);

    const overview =
      overviewResult[0] || {
        total: 0,
        published: 0,
        failed: 0,
        inProgress: 0,
      };

    // ======================================================
    // SUCCESS RATE
    // ======================================================

    const completed =
      overview.published +
      overview.failed;

    const successRate =
      completed > 0
        ? Number(
            (
              (overview.published /
                completed) *
              100
            ).toFixed(2)
          )
        : 0;

    // ======================================================
    // EMPLOYEES
    // ======================================================

    const employees =
      await Employee.find({
        userId: userObjectId,
      })
        .select(
          "_id name type status workload schedule"
        )
        .lean();

    // ======================================================
    // EMPLOYEE ANALYTICS
    // ======================================================

    const employeePerformance =
      await Execution.aggregate([
        {
          $match: executionFilter,
        },

        {
          $group: {
            _id: {
              employeeId: "$employeeId",
              status: "$status",
            },

            count: {
              $sum: 1,
            },
          },
        },

        {
          $group: {
            _id: "$_id.employeeId",

            total: {
              $sum: "$count",
            },

            published: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$_id.status",
                      "success",
                    ],
                  },
                  "$count",
                  0,
                ],
              },
            },

            failed: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$_id.status",
                      "failed",
                    ],
                  },
                  "$count",
                  0,
                ],
              },
            },

            inProgress: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$_id.status",
                      "running",
                    ],
                  },
                  "$count",
                  0,
                ],
              },
            },
          },
        },
      ]);

    // ======================================================
    // PERFORMANCE MAP
    // ======================================================

    const performanceMap =
      new Map();

    employeePerformance.forEach(
      (item) => {

        performanceMap.set(
          item._id.toString(),
          item
        );
      }
    );

    // ======================================================
    // EMPLOYEE RESPONSE
    // ======================================================

    const employeeAnalytics =
      employees.map(
        (employee) => {

          const stats =
            performanceMap.get(
              employee._id.toString()
            ) || {
              total: 0,
              published: 0,
              failed: 0,
              inProgress: 0,
            };

          const employeeCompleted =
            stats.published +
            stats.failed;

          const employeeSuccessRate =
            employeeCompleted > 0
              ? Number(
                  (
                    (stats.published /
                      employeeCompleted) *
                    100
                  ).toFixed(2)
                )
              : 0;

          // ==================================================
          // PLANNED OUTPUT
          // ==================================================

          let planned = 0;

          const workload =
            employee.workload;

          if (
            workload &&
            typeof workload === "object"
          ) {

            planned = Number(
              workload.monthlyOutputs ||
              workload.maxMonthlyOutputs ||
              workload.outputsPerMonth ||
              workload.monthlyOutputLimit ||
              0
            );
          }

          return {
            employeeId:
              employee._id,

            name:
              employee.name,

            type:
              employee.type,

            status:
              employee.status,

            total:
              stats.total,

            published:
              stats.published,

            failed:
              stats.failed,

            inProgress:
              stats.inProgress,

            successRate:
              employeeSuccessRate,

            planned,
          };
        }
      );

    // ======================================================
    // TOTAL PLANNED
    // ======================================================

    const planned =
      employeeAnalytics.reduce(
        (total, employee) =>
          total +
          Number(
            employee.planned || 0
          ),
        0
      );

    // ======================================================
    // COMPLETION RATE
    // ======================================================

    const completionRate =
      planned > 0
        ? Number(
            (
              (overview.published /
                planned) *
              100
            ).toFixed(2)
          )
        : 0;

    // ======================================================
    // RECENT EXECUTIONS
    // ======================================================

    const recentExecutions =
      await Execution.find(
        executionFilter
      )
        .sort({
          createdAt: -1,
        })
        .limit(10)
        .select(
          "executionId employeeId status error createdAt startedAt finishedAt"
        )
        .lean();

    // ======================================================
    // EMPLOYEE MAP
    // ======================================================

    const employeeMap =
      new Map();

    employees.forEach(
      (employee) => {

        employeeMap.set(
          employee._id.toString(),
          employee
        );
      }
    );

    // ======================================================
    // RECENT ACTIVITY
    // ======================================================

    const recentActivity =
      recentExecutions.map(
        (execution) => {

          const employee =
            employeeMap.get(
              execution.employeeId?.toString()
            );

          let activityType =
            "execution";

          let title =
            "Employee execution";

          let icon =
            "✦";

          if (
            execution.status ===
            "success"
          ) {

            activityType =
              "published";

            title =
              `${employee?.name || "Employee"} published content`;

            icon =
              "✓";
          }

          else if (
            execution.status ===
            "failed"
          ) {

            activityType =
              "failed";

            title =
              `${employee?.name || "Employee"} execution failed`;

            icon =
              "!";
          }

          else if (
            execution.status ===
            "running"
          ) {

            activityType =
              "running";

            title =
              `${employee?.name || "Employee"} is working`;

            icon =
              "◷";
          }

          return {
            executionId:
              execution.executionId,

            employeeId:
              execution.employeeId,

            employeeName:
              employee?.name ||
              "Unknown Employee",

            type:
              activityType,

            title,

            icon,

            status:
              execution.status,

            createdAt:
              execution.createdAt,

            startedAt:
              execution.startedAt,

            finishedAt:
              execution.finishedAt,

            error:
              execution.error ||
              null,
          };
        }
      );

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(200).json({

      success: true,

      period,

      range: {
        start:
          startDate,

        end:
          endDate,
      },

      overview: {

        total:
          overview.total,

        published:
          overview.published,

        failed:
          overview.failed,

        inProgress:
          overview.inProgress,

        successRate,

        planned,

        completionRate,
      },

      employees:
        employeeAnalytics,

      recentActivity,
    });

  } catch (error) {

    console.error(
      "Analytics overview error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to load analytics",

      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
};


module.exports = {
  getAnalyticsOverview,
};