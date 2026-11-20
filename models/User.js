const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const bcrypt = require('bcrypt'); // Added for production-safe credential checks

const User = sequelize.define('User', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  name: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  username: { 
    type: DataTypes.STRING, 
    allowNull: false, 
    unique: true,
    set(val) {
      // Force everything down to lowercase automatically at the database model layer
      this.setDataValue('username', val.toLowerCase().trim());
    }
  }, 
  password: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  role: { 
    type: DataTypes.ENUM('faculty', 'student', 'admin'), // Permitted ENUM types
    allowNull: false 
  },
   department: {
    type: DataTypes.STRING(50),
    allowNull: true,              
    defaultValue: '',         
    field: 'department'          
  },
  batch: { 
    type: DataTypes.ENUM('1st_year', '2nd_year'), 
    allowNull: true 
  }
}, {
  // Let Sequelize automatically manage and generate your createdAt and updatedAt fields safely
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        // FIXED: Only hash the password if it's plain text (not already a bcrypt hash string)
        if (!user.password.startsWith('$2b$')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && user.password) {
        // FIXED: Prevent double-hashing on profile updates or modifications
        if (!user.password.startsWith('$2b$')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  }
});

module.exports = User;
