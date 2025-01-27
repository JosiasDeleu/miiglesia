import bcrypt from 'bcrypt';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();


const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT),
  });

const runQuery = async ({ query, values }) => {
    const client = await pool.connect();
    try {
        const result = await client.query(query, values);
        console.log(JSON.stringify(result))
        return 
    } finally {
        client.release();
    }
};

const newPassword = "123456"
const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(newPassword, salt);
const queryUpdatePassword = `UPDATE users SET password = $1 WHERE id = 1`

runQuery({ query: queryUpdatePassword, values: [hashedPassword] });