import 'dotenv/config';
import { execSync } from 'node:child_process';

// Sync the schema to the dedicated test database before any tests run.
export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL must be set (see server/.env)');
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
