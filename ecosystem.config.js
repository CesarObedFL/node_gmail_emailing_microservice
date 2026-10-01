module.exports = {
    apps: [
        {
            name: 'emailing_service',
            script: './server.js',
            watch: true,
            env: {
                NODE_ENV: 'production',
                PORT: "3000"
            }
        }
    ]
};