// Vercel Node function. Secrets remain server-side.
module.exports = require('../lib/app').createApp({ hosted: true });
