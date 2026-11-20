const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Attendance = sequelize.define('Attendance', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  subjectId: { 
    type: DataTypes.STRING, 
    allowNull: false,
    field: 'subject_id', // Physical database column name
    unique: 'unique_student_attendance_hour' // FIXED: Explicitly links column target to the atomic validation matrix rule block
  },
  studentId: { 
    type: DataTypes.INTEGER, 
    allowNull: false,
    field: 'student_id', // Physical database column name
    unique: 'unique_student_attendance_hour' // FIXED: Explicitly links column target to the atomic validation matrix rule block
  },
  date: { 
    type: DataTypes.STRING(10), 
    allowNull: false,
    field: 'attendance_date', // Physical database column name
    unique: 'unique_student_attendance_hour' // FIXED: Explicitly links column target to the atomic validation matrix rule block
  },
  status: { 
    type: DataTypes.ENUM('Present', 'Absent', 'Late'), 
    allowNull: false 
  },
  hour: { 
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    field: 'hour', // Physical database column name
    unique: 'unique_student_attendance_hour' // FIXED: Explicitly links column target to the atomic validation matrix rule block
  }
}, {
  tableName: 'attendance_records',
  timestamps: false,
  indexes: [
    {
      name: 'unique_student_attendance_hour',
      unique: true,
      fields: ['student_id', 'subject_id', 'attendance_date', 'hour'] 
    }
  ]
});

module.exports = Attendance;
