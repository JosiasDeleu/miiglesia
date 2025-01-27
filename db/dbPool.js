import pkg from 'pg';
const { Pool } = pkg;

import dotenv from 'dotenv';
dotenv.config();

const isDevelopment = process.env.NODE_ENV === 'development';

export const pool = isDevelopment
  ? new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT),
  })
  : new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
});