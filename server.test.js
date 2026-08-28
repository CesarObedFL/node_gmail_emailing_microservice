process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
process.env.EMAIL = 'test@example.com';
process.env.EMAIL_PASSWORD = 'test_pass';
process.env.CLIENT_URL = 'http://localhost:8888';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const app = require('./server');

// nodemailer mock
jest.mock('nodemailer', () => ({
    createTransport: jest.fn().mockReturnValue({
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
    }),
}));

describe('Email Microservice - Unit Tests', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    const validPayload = {
        full_name: 'Test User',
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'Test message content',
    };

    describe('POST /request - JWT validation', () => {
        test('should reject request without Authorization header', async () => {
            const response = await request(app)
                .post('/request')
                .send(validPayload);
            expect(response.status).toBe(401);
            expect(response.body.error).toMatch(/missing or invalid authorization header/i);
        });

        test('should reject request with invalid JWT format', async () => {
            jest.spyOn(jwt, 'verify').mockImplementation(() => {
                throw new Error('jwt malformed');
            });

            const response = await request(app)
                .post('/request')
                .set('Authorization', 'Bearer invalid-token')
                .send(validPayload);
            expect(response.status).toBe(401);
            expect(response.body.error).toMatch(/invalid or expired token/i);
        });

        test('should reject request with expired token', async () => {
            jest.spyOn(jwt, 'verify').mockImplementation(() => {
                throw new Error('jwt expired');
            });

            const response = await request(app)
                .post('/request')
                .set('Authorization', 'Bearer expired.token')
                .send(validPayload);
            expect(response.status).toBe(401);
            expect(response.body.error).toMatch(/invalid or expired token/i);
        });

        test('should reject request with invalid signature', async () => {
            jest.spyOn(jwt, 'verify').mockImplementation(() => {
                throw new Error('invalid signature');
            });

            const response = await request(app)
                .post('/request')
                .set('Authorization', 'Bearer invalid.signature')
                .send(validPayload);
            expect(response.status).toBe(401);
            expect(response.body.error).toMatch(/invalid or expired token/i);
        });

        test('should reject request if decoded token lacks verified: true', async () => {
            jest.spyOn(jwt, 'verify').mockImplementation(() => ({
                verified: false,
                type: 'email_verification',
            }));

            const response = await request(app)
                .post('/request')
                .set('Authorization', 'Bearer some.token')
                .send(validPayload);
            expect(response.status).toBe(403);
            expect(response.body.error).toMatch(/token does not have verified: true/i);
        });

        test('should reject request if token type is not email_verification', async () => {
            jest.spyOn(jwt, 'verify').mockImplementation(() => ({
                verified: true,
                type: 'other',
            }));

            const response = await request(app)
                .post('/request')
                .set('Authorization', 'Bearer some.token')
                .send(validPayload);
            expect(response.status).toBe(403);
            expect(response.body.error).toMatch(/invalid token type/i);
        });

        test('should accept valid token and send email', async () => {
            jest.spyOn(jwt, 'verify').mockImplementation(() => ({
                verified: true,
                type: 'email_verification',
            }));

            const sendMailMock = nodemailer.createTransport().sendMail;
            sendMailMock.mockResolvedValue({ messageId: 'test-123' });

            const response = await request(app)
                .post('/request')
                .set('Authorization', 'Bearer valid.token')
                .send(validPayload);
            expect(response.status).toBe(200);
            expect(response.body.success).toMatch(/email sent successfully/i);
            expect(sendMailMock).toHaveBeenCalledTimes(1);
            expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
                to: expect.any(String),
                subject: expect.stringContaining(validPayload.subject),
                text: expect.stringContaining(validPayload.message),
            }));
        });

        test('should handle nodemailer error gracefully', async () => {
            jest.spyOn(jwt, 'verify').mockImplementation(() => ({
                verified: true,
                type: 'email_verification',
            }));

            const sendMailMock = nodemailer.createTransport().sendMail;
            sendMailMock.mockRejectedValue(new Error('SMTP error'));

            const response = await request(app)
                .post('/request')
                .set('Authorization', 'Bearer valid.token')
                .send(validPayload);
            expect(response.status).toBe(500);
            expect(response.body.error).toMatch(/error sending email/i);
        });

        test('should return 400 if required fields are missing', async () => {
            jest.spyOn(jwt, 'verify').mockImplementation(() => ({
                verified: true,
                type: 'email_verification',
            }));

            const response = await request(app)
                .post('/request')
                .set('Authorization', 'Bearer some.token')
                .send({ full_name: 'Only name' });
            expect(response.status).toBe(400);
            expect(response.body.error).toMatch(/missing required fields/i);
        });
    });

    describe('GET /request/config', () => {
        test('should return configuration data', async () => {
            const response = await request(app).get('/request/config');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('port');
            expect(response.body).toHaveProperty('sending_email');
            expect(response.body).toHaveProperty('cors_url');
            expect(response.body).toHaveProperty('server');
        });
    });

    describe('Server startup', () => {
        test('should export app without starting server', () => {
            expect(app).toBeDefined();
            expect(typeof app.listen).toBe('function');
        });
    });
});