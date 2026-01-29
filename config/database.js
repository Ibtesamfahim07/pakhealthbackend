// Database Configuration for PakHealth Backend
// This file connects to MySQL database using credentials from .env file

const mysql = require('mysql2');
require('dotenv').config();

// Create connection pool for better performance
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD||'Ibtesam8solveai' ,
  database: process.env.DB_NAME || 'pakhealth_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Get promise-based connection for async/await support
const promisePool = pool.promise();

// Test database connection on startup
const testConnection = async () => {
  try {
    const connection = await promisePool.getConnection();
    console.log('✅ Database connected successfully');
    console.log(`📊 Database: ${process.env.DB_NAME || 'pakhealth_db'}`);
    console.log(`🖥️  Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error('Error:', error.message);
    
    // Provide helpful error messages
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Solution: Check your DB_USER and DB_PASSWORD in .env file');
      console.error('   Make sure they match your MySQL credentials');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Solution: Make sure MySQL server is running');
      console.error('   Mac: brew services start mysql');
      console.error('   Linux: sudo systemctl start mysql');
      console.error('   Windows: Start MySQL service from Services');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 Solution: Database does not exist. Run database_schema.sql in MySQL Workbench');
    }
    
    console.error('\n📝 Check your .env file configuration:');
    console.error(`   DB_HOST: ${process.env.DB_HOST || 'localhost'}`);
    console.error(`   DB_USER: ${process.env.DB_USER || 'root'}`);
    console.error(`   DB_PASSWORD: ${process.env.DB_PASSWORD ? '***' : 'NOT SET'}`);
    console.error(`   DB_NAME: ${process.env.DB_NAME || 'pakhealth_db'}`);
    console.error(`   DB_PORT: ${process.env.DB_PORT || 3306}\n`);
    
    process.exit(1);
  }
};

// Run connection test
testConnection();

// Export the promise-based pool
module.exports = promisePool;