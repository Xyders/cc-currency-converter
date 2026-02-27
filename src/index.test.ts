import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SELF, env } from 'cloudflare:test';

// Hoisted mock to replace production CSV with test data
const mockRates = vi.hoisted(() => ({
  RATES_CSV: `Record Date,Country - Currency Description,Exchange Rate,Effective Date,ISO code
2025-12-31,Euro Zone-Euro,0.851,2025-12-31,EUR
2025-12-31,Japan-Yen,156.61,2025-12-31,JPY
2025-12-31,United Kingdom-Pound,0.743,2025-12-31,GBP
2025-12-31,Canada-Dollar,1.369,2025-12-31,CAD`,
}));

vi.mock('./data/rates.js', () => mockRates);

describe('Currency Converter API', () => {
  // Mock Akamai service binding
  let originalAkamaiService: any;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  beforeEach(() => {
    console.log('[Test] Mocking akamaiService, current:', (env as any).akamaiService);
    originalAkamaiService = (env as any).akamaiService;
    (env as any).akamaiService = {
      async handleWorkerRequest(
        requestTs: number,
        cf: object,
        method: string,
        url: string,
        headers: Record<string, string>,
        requestBody: ReadableStream | null,
        responseTs: number,
        responseHeaders: Record<string, string>,
        status: number,
        responseBody: ReadableStream | null
      ) {
        console.log('[Mock Akamai] handleWorkerRequest called', { method, url, status });
        return Promise.resolve();
      },
    };
    console.log('[Test] Mock assigned');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (env as any).akamaiService = originalAkamaiService;
  });
  describe('root endpoint', () => {
    it('should return hello world', async () => {
      const response = await SELF.fetch('http://localhost/');
      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data).toMatchObject({
        message: 'Hello World!',
        path: '/',
        method: 'GET',
      });
      expect(data.timestamp).toBeDefined();
    });

    it('should include CORS headers', async () => {
      const response = await SELF.fetch('http://localhost/');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
    });
  });

  describe('/hello endpoint', () => {
    it('should return greeting', async () => {
      const response = await SELF.fetch('http://localhost/hello');
      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data).toMatchObject({
        message: 'Hello from the API!',
        endpoint: '/hello',
      });
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('/health endpoint', () => {
    it('should return OK status', async () => {
      const response = await SELF.fetch('http://localhost/health');
      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data).toMatchObject({
        status: 'OK',
        service: 'currency-converter-api',
      });
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('/convert endpoint', () => {
    it('should convert USD to EUR correctly', async () => {
      const response = await SELF.fetch(
        'http://localhost/convert?amount=100&from=USD&to=EUR'
      );
      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data).toMatchObject({
        amount: 100,
        from: 'USD',
        to: 'EUR',
        rate: 0.851,
        converted: 85.1,
      });
      expect(data.timestamp).toBeDefined();
    });

    it('should convert EUR to USD correctly', async () => {
      const response = await SELF.fetch(
        'http://localhost/convert?amount=100&from=EUR&to=USD'
      );
      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.amount).toBe(100);
      expect(data.from).toBe('EUR');
      expect(data.to).toBe('USD');
      expect(data.rate).toBeCloseTo(1 / 0.851);
      expect(data.converted).toBeCloseTo(100 / 0.851);
    });

    it('should be case‑insensitive', async () => {
      const response = await SELF.fetch(
        'http://localhost/convert?amount=50&from=usd&to=eur'
      );
      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.from).toBe('USD'); // response uppercases
      expect(data.to).toBe('EUR');
      expect(data.rate).toBe(0.851);
    });

    it('should return 400 for missing parameters', async () => {
      const response = await SELF.fetch('http://localhost/convert?amount=100&from=USD');
      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 for invalid amount (zero)', async () => {
      const response = await SELF.fetch(
        'http://localhost/convert?amount=0&from=USD&to=EUR'
      );
      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 for invalid amount (negative)', async () => {
      const response = await SELF.fetch(
        'http://localhost/convert?amount=-5&from=USD&to=EUR'
      );
      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 for invalid amount (NaN)', async () => {
      const response = await SELF.fetch(
        'http://localhost/convert?amount=abc&from=USD&to=EUR'
      );
      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe('Invalid request');
    });

    it('should return 404 for unknown source currency', async () => {
      const response = await SELF.fetch(
        'http://localhost/convert?amount=100&from=XYZ&to=USD'
      );
      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.error).toBe('Currency not found');
    });

    it('should return 404 for unknown target currency', async () => {
      const response = await SELF.fetch(
        'http://localhost/convert?amount=100&from=USD&to=XYZ'
      );
      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.error).toBe('Currency not found');
    });

    it('should return 400 for non‑USD pairs', async () => {
      const response = await SELF.fetch(
        'http://localhost/convert?amount=100&from=EUR&to=JPY'
      );
      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe('Invalid request');
      expect(data.message).toContain('Only conversions involving USD are supported');
    });
  });

  describe('/currencies endpoint', () => {
    it('should return list of currencies with count', async () => {
      const response = await SELF.fetch('http://localhost/currencies');
      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data).toHaveProperty('currencies');
      expect(data).toHaveProperty('count');
      expect(data.count).toBe(5); // USD + 4 test currencies
      expect(data.currencies).toHaveLength(5);
      expect(data.currencies[0]).toMatchObject({
        isoCode: 'USD',
        description: 'United States-Dollar',
        exchangeRate: 1,
      });
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should return 404 for unknown route', async () => {
      const response = await SELF.fetch('http://localhost/unknown');
      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.error).toBe('Not Found');
    });

    it('should return 405 for non‑GET method', async () => {
      const response = await SELF.fetch('http://localhost/', { method: 'POST' });
      expect(response.status).toBe(405);
      const data = (await response.json()) as any;
      expect(data.error).toBe('Method Not Allowed');
    });
  });

  describe('CORS preflight', () => {
    it('should handle OPTIONS request', async () => {
      const response = await SELF.fetch('http://localhost/', { method: 'OPTIONS' });
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
    });

    it('should allow OPTIONS on any endpoint', async () => {
      const response = await SELF.fetch('http://localhost/convert', { method: 'OPTIONS' });
      expect(response.status).toBe(200);
    });
  });
});