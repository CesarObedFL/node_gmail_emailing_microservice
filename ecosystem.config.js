module.exports = {
    apps: [{
        name: 'emailing_microservice',
        script: './server.js',
        env_file: '/var/www/node_gmail_emailing_microservice/.env',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        }
    }]
};