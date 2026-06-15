import 'dotenv/config';

function get(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const env = {
  databaseUrl: get('DATABASE_URL', 'postgresql://rip:rip@127.0.0.1:5432/rip?schema=public'),
  jwtSecret: get('JWT_SECRET', 'dev-secret-change-me'),
  port: parseInt(process.env.PORT ?? '4000', 10),
  adminToken: get('ADMIN_TOKEN', 'dev-admin'),
};
