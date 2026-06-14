import { loadConfig } from "../shared/config/config.ts";
import { Database } from "../shared/database/database.ts";
import { createLogger } from "../shared/logger/logger.ts";

// Idempotent schema. Single DDL source: init-db CLI + test setup.
export const applySchema = async (client: Database): Promise<void> => {
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

  await client.query(`
    ALTER TABLE attendance_records
      ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'present';
  `);
};

const initDatabase = async (): Promise<void> => {
  const config = loadConfig();
  const logger = createLogger(config);
  const db = new Database(config);

  try {
    logger.info("📊 connected to PostgreSQL, starting initialization...");
    await applySchema(db);
    logger.info("✅ schema applied");
  } finally {
    await db.end();
  }
};

// Run only when executed directly, not when imported.
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  await initDatabase();
}
