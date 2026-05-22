import mysql from "mysql2/promise";
import { env } from "./env.js";

const dbUrl = new URL(env.DATABASE_URL);

const pool = mysql.createPool({
  host: dbUrl.hostname,
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.replace(/^\//, ""),
  port: dbUrl.port ? Number(dbUrl.port) : 3306,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_SIZE || "5", 10),
  queueLimit: 0,
});

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

export async function withTransaction(handler) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export { pool };
