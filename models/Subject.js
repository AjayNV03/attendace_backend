const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Subject = sequelize.define('Subject', {
  // Use 'id' on the JavaScript surface layer, but map it to 'subject code' in MySQL rows
  id: { 
    type: DataTypes.STRING, 
    primaryKey: true,
    allowNull: false,
    field: 'subject code' // ✅ CRITICAL FIXED: Binds the spacer property safely to MySQL backticks
  }, 
  name: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  // ✅ ADDED: Type parameter field with clear configuration layout mapping parameters
  type: {
    type: DataTypes.ENUM('Theory', 'Practical'),
    allowNull: false,
    defaultValue: 'Theory'
  },
  batch: { 
    type: DataTypes.STRING, // Changed from strict ENUM to STRING to handle loose frontend variable options safely
    allowNull: false,
    defaultValue: '1st_year'
  },
  semester: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Semester 1'
  },
  department: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'MCA'
  }
}, {
  timestamps: false,
  tableName: 'subjects' 
});

module.exports = Subject;
