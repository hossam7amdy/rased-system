import postgres from 'postgres'

let _sql = null

export function getDb(env) {
  if (!_sql) {
    _sql = postgres(env.DATABASE_URL, { ssl: 'require', max: 2 })
  }
  return _sql
}
