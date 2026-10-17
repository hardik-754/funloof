const http = require('node:http');
const path = require('node:path');
const { createApp } = require('./lib/app');
if (require.main === module) {
  const envPath = path.join(__dirname, '.env');
  if (require('node:fs').existsSync(envPath)) process.loadEnvFile(envPath);
  const port = Number(process.env.PORT || 4173);
  http.createServer(createApp()).listen(port, '127.0.0.1', () => {
    console.log(`Funloof: http://127.0.0.1:${port} | Dashboard: http://127.0.0.1:${port}/admin`);
    console.log('Local admin password: open .local/admin-password.txt (never upload this file).');
  });
}
module.exports = { createApp };
