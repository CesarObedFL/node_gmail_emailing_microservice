const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

module.exports = {
    apps: [{
        name: 'emailing_microservice',
        script: './server.js',
        env: {
            NODE_ENV: 'production',
            PORT: 3000,
            EMAIL: process.env.EMAIL,
            EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
            CLIENT_URL: process.env.CLIENT_URL || process.env.URL,
            JWT_SECRET: process.env.JWT_SECRET
        }
    }]
};
