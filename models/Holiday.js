const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Holiday = sequelize.define('Holiday', {
  date: { type: DataTypes.STRING(10), primaryKey: true }, // Format: YYYY-MM-DD
  reason: { type: DataTypes.STRING, allowNull: false }
});

module.exports = Holiday;
