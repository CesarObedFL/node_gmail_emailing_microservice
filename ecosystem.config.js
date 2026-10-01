module.exports = {
    apps: [
        {
            name: 'node_emailing_service',
            script: './index.js',
            watch: true,
            env: {
                NODE_ENV: 'production',
                PORT: "3000"
            }
        }
    ]
};