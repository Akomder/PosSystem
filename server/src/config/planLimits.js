/**
 * planLimits.js
 * Hard limits per subscription plan.
 * Enforced in staffController, tablesController, and menuController.
 */
module.exports = {
  basic:      { maxStaff: 5,        maxTables: Infinity, maxMenuItems: 50        },
  pro:        { maxStaff: 20,       maxTables: Infinity, maxMenuItems: 200       },
  enterprise: { maxStaff: Infinity, maxTables: Infinity, maxMenuItems: Infinity  },
}
