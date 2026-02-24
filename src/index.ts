import { currencyService } from './services/currency.js';
import { ConversionRequest, ConversionResponse, ErrorResponse, CurrencyInfo } from './types/index.js';

export interface Env {
  // Add bindings here if needed (e.g., KV, D1, R2)
}

// Helper to create JSON response with CORS headers for development
const jsonResponse = (data: any, status: number = 200, headers: Record<string, string> = {}): Response => {
  const responseHeaders = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // For development only
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers,
  });

  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: responseHeaders,
  });
};

// Handle OPTIONS requests for CORS preflight
const handleOptions = (): Response => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};

const errorResponse = (error: string, message: string, status: number = 400): Response => {
  const errorResp: ErrorResponse = {
    error,
    message,
    timestamp: new Date().toISOString(),
  };
  return jsonResponse(errorResp, status);
};

const validateConversionParams = (params: URLSearchParams): ConversionRequest | null => {
  const amountStr = params.get('amount');
  const from = params.get('from');
  const to = params.get('to');

  if (!amountStr || !from || !to) {
    return null;
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return null;
  }

  if (from.length !== 3 || to.length !== 3) {
    return null;
  }

  return { amount, from, to };
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // Only GET requests allowed for this simple API
    if (request.method !== 'GET') {
      return jsonResponse(
        { error: 'Method Not Allowed', message: 'Only GET requests are supported' },
        405
      );
    }

    // Route handling
    if (pathname === '/') {
      return jsonResponse({
        message: 'Hello World!',
        timestamp: new Date().toISOString(),
        path: '/',
        method: 'GET',
      });
    }

    if (pathname === '/hello') {
      return jsonResponse({
        message: 'Hello from the API!',
        endpoint: '/hello',
        timestamp: new Date().toISOString(),
      });
    }

    if (pathname === '/health') {
      return jsonResponse({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'currency-converter-api',
      });
    }

    if (pathname === '/convert') {
      const params = validateConversionParams(url.searchParams);
      if (!params) {
        return errorResponse(
          'Invalid request',
          'Missing or invalid parameters. Required: amount (positive number), from (3-letter ISO code), to (3-letter ISO code)',
          400
        );
      }

      try {
        const { amount, from, to } = params;
        const result = await currencyService.convert(amount, from, to);
        const response: ConversionResponse = {
          amount,
          from: from.toUpperCase(),
          to: to.toUpperCase(),
          rate: result.rate,
          converted: result.converted,
          timestamp: new Date().toISOString(),
        };
        return jsonResponse(response);
      } catch (error: any) {
        if (error.message.includes('Invalid source currency code')) {
          return errorResponse('Currency not found', error.message, 404);
        }
        if (error.message.includes('Invalid target currency code')) {
          return errorResponse('Currency not found', error.message, 404);
        }
        if (error.message.includes('Only conversions involving USD are supported')) {
          return errorResponse('Invalid request', error.message, 400);
        }
        if (error.message.includes('Amount must be a positive number')) {
          return errorResponse('Invalid request', error.message, 400);
        }
        // Unknown error
        console.error('Conversion error:', error);
        return errorResponse('Internal server error', 'Failed to perform conversion', 500);
      }
    }

    if (pathname === '/currencies') {
      try {
        const currencies: CurrencyInfo[] = await currencyService.listCurrencies();
        return jsonResponse({
          currencies,
          count: currencies.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to list currencies:', error);
        return errorResponse('Internal server error', 'Failed to load currency list', 500);
      }
    }

    // Unknown route
    return jsonResponse(
      {
        error: 'Not Found',
        message: 'Route not found',
        path: pathname,
      },
      404
    );
  },
};