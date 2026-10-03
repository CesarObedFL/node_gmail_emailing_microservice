module.exports = {
    apps: [{
        name: 'emailing_microservice',
        script: './server.js',
        node_args: '-r dotenv/config',
        args: 'dotenv_config_path=/var/www/node_gmail_emailing_microservice/.env',
        env: {
            NODE_ENV: 'production',
            PORT: 3000,

        }
    }]
};
