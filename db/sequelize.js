import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const isDevelopment = process.env.NODE_ENV === 'development';

const sequelize = isDevelopment
  ? new Sequelize({
      dialect: 'postgres',
      username: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT),
    })
  : new Sequelize(process.env.DATABASE_URL, {
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });

export { sequelize };
