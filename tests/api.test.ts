import {describe, expect, it} from 'vitest';
import request from 'supertest';

process.env.RENDER_AUTH_TOKEN = 'test-token';

// Import after setting env
const app = require('../server');

const authHeader = {Authorization: `Bearer ${process.env.RENDER_AUTH_TOKEN}`};

describe('API endpoints', () => {
  it('health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ok: true});
  });

  it('rejects render without required fields', async () => {
    const res = await request(app).post('/render').set(authHeader).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects async render without required fields', async () => {
    const res = await request(app).post('/render/async').set(authHeader).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for unknown job', async () => {
    const res = await request(app).get('/render/async/does-not-exist').set(authHeader);
    expect(res.status).toBe(404);
  });
});
