const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');
const Subject = require('./Subject');
const Attendance = require('./Attendance');
const Holiday = require('./Holiday');

// FIXED: Explicitly declare the link key columns with matching target database types
const UserSubjects = sequelize.define('UserSubjects', {
  userId: {
    type: DataTypes.INTEGER, // Matches User.js primary key data type perfectly
    references: { model: 'Users', key: 'id' },
    primaryKey: true
  },
  subjectId: {
    type: DataTypes.STRING,  // Matches Subject.js primary key string identifier data type perfectly
    references: { model: 'Subjects', key: 'id' },
    primaryKey: true
  },
  totalClasses: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  attended: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  }
}, { 
  tableName: 'usersubjects',
  timestamps: false 
});

// Configure structural relationship associations bridges
User.belongsToMany(Subject, { 
  through: UserSubjects, 
  foreignKey: 'userId', 
  otherKey: 'subjectId',
  as: 'subjects' 
});

Subject.belongsToMany(User, { 
  through: UserSubjects, 
  foreignKey: 'subjectId', 
  otherKey: 'userId',
  as: 'users' 
});

User.hasMany(Attendance, { foreignKey: 'studentId' });
Attendance.belongsTo(User, { foreignKey: 'studentId', as: 'student' });

module.exports = { User, Subject, Attendance, Holiday, UserSubjects };
