import "../config/env.ts";
import bcrypt from "bcryptjs";
import { Pool, type PoolClient } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const initDatabase = async (): Promise<void> => {
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    console.log("📊 Connected to PostgreSQL. Starting initialization...");

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'professor', 'student');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role user_role NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        student_id VARCHAR(50) UNIQUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Users table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_code VARCHAR(20) UNIQUE NOT NULL,
        course_name VARCHAR(255) NOT NULL,
        professor_id UUID REFERENCES users(id) ON DELETE CASCADE,
        semester VARCHAR(50) NOT NULL,
        academic_year VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Courses table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        student_id UUID REFERENCES users(id) ON DELETE CASCADE,
        enrolled_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(course_id, student_id)
      );

      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        session_name VARCHAR(255) NOT NULL,
        session_date DATE NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS attendance_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE,
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        student_id UUID REFERENCES users(id) ON DELETE CASCADE,
        scanned_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'present',
        is_manual_override BOOLEAN DEFAULT false,
        override_reason TEXT,
        UNIQUE(session_id, student_id)
      );
    `);
    console.log("✅ All attendance tables created");

    await client.query(`
      ALTER TABLE attendance_records
        ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'present';
    `);
    console.log("✅ attendance_records columns ensured (course_id, status)");

    const adminPassword = await bcrypt.hash("admin123", 10);
    await client.query(
      `
      INSERT INTO users (email, password_hash, role, full_name)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING;
    `,
      ["admin@rased.edu", adminPassword, "admin", "System Administrator"],
    );

    console.log("✨ Success! Admin login: admin@rased.edu / admin123");
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
};

initDatabase();
