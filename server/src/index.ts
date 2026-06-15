import { createApp } from './http/app';
import { env } from './env';

const app = createApp();
app.listen(env.port, () => {
  console.log(`RIP server listening on http://localhost:${env.port}`);
});
