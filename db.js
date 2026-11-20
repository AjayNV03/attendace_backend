const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false,
    dialectOptions: {
      dateStrings: true, 
      typeCast: true
    }
  }
);

// FIXED: Use standard callback formats native to the internal hook pool instance to prevent promise engine crashes
sequelize.addHook('afterConnect', (connection, config) => {
  connection.query("SET SESSION sql_mode='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'", (err) => {
    if (err) console.error('❌ Failed to safely initialize SQL session flags:', err.message);
  });
});

// Override the sync function to create the database schema container if it's missing
const oldSync = sequelize.sync.bind(sequelize);
sequelize.sync = async (options) => {
  try {
    // 1. Establish a temporary root driver connection to check the server instance
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS
    });
    
    // 2. Programmatically generate the structural database container shell
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
    await connection.end();
    console.log(`✔ Database schema storage layer "${process.env.DB_NAME}" verified/created successfully.`);
    
    // 3. Fallback to normal Sequelize schema execution sequence
    return await oldSync(options);
  } catch (err) {
    console.error('❌ Database Initialization Module Failed:', err.message);
    throw err;
  }
};

module.exports = sequelize;
