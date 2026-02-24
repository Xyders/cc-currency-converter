import { currencyService } from './services/currency.js';
import { ConversionRequest, ConversionResponse, ErrorResponse, CurrencyInfo } from './types/index.js';
import type { Service } from '@cloudflare/workers-types';

export interface Env {
  akamaiService: {
    handleWorkerRequest: (
      requestTs: number,
      cf: object, // Could use IncomingRequestCfProperties from @cloudflare/workers-types
      method: string,
      url: string,
      headers: Record<string, string>,
      requestBody: ReadableStream | null,
      responseTs: number,
      responseHeaders: Record<string, string>,
      status: number,
      responseBody: ReadableStream | null
    ) => Promise<void>;
  } | Service;
  IGNORE_CACHED_RESPONSES?: string;
  MAX_BODY_SIZE_BYTES?: string;
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

// ============ AKAMAI CODE STARTS ============
// Default configuration for Akamai
const DEFAULT_IGNORE_CACHED_RESPONSES = false;
const DEFAULT_MAX_BODY_SIZE_BYTES = 1048576; // 1 MB

// Get configuration from environment variables
const getAkamaiConfig = (env: Env) => {
  const ignoreCachedResponses = env.IGNORE_CACHED_RESPONSES
    ? env.IGNORE_CACHED_RESPONSES.toLowerCase() === 'true'
    : DEFAULT_IGNORE_CACHED_RESPONSES;

  const maxBodySizeBytes = env.MAX_BODY_SIZE_BYTES
    ? parseInt(env.MAX_BODY_SIZE_BYTES, 10)
    : DEFAULT_MAX_BODY_SIZE_BYTES;

  // Validate maxBodySizeBytes
  const validMaxBodySize = Number.isInteger(maxBodySizeBytes) && maxBodySizeBytes > 0
    ? maxBodySizeBytes
    : DEFAULT_MAX_BODY_SIZE_BYTES;

  return {
    ignoreCachedResponses,
    maxBodySizeBytes: validMaxBodySize,
  };
};

// Minimal check: should we gather this body based on content-length?
// This is an optimization to avoid sending large bodies over service bindings to Akamai
const shouldSendBody = (body: ReadableStream | null, headers: Headers, maxBodySizeBytes: number): boolean => {
  if (body == null) {
    return false;
  }

  // Fast-path: Check content-length if available (O(1) optimization)
  const contentLength = headers.get('content-length');
  if (contentLength != null && Number(contentLength) > maxBodySizeBytes) {
    console.debug(`Content-Length ${contentLength} exceeds max limit, not sending body to Akamai`);
    return false;
  }

  return true;
};

// Helper to call Akamai service binding, supporting both custom handleWorkerRequest and standard Service fetch
const callAkamaiService = async (
  akamaiService: Env['akamaiService'],
  requestTs: number,
  cf: object,
  method: string,
  url: string,
  headers: Record<string, string>,
  requestBody: ReadableStream | null,
  responseTs: number,
  responseHeaders: Record<string, string>,
  status: number,
  responseBody: ReadableStream | null,
  ctx: ExecutionContext
): Promise<void> => {
  if ('handleWorkerRequest' in akamaiService && typeof akamaiService.handleWorkerRequest === 'function') {
    return akamaiService.handleWorkerRequest(
      requestTs,
      cf,
      method,
      url,
      headers,
      requestBody,
      responseTs,
      responseHeaders,
      status,
      responseBody
    );
  } else if ('fetch' in akamaiService && typeof akamaiService.fetch === 'function') {
    // Adapt parameters to a Request and let the service handle it
    // This is a fallback for testing environments where service binding is a standard Service
    const request = new Request('https://akamai-service.internal/handleWorkerRequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        requestTs,
        cf,
        method,
        url,
        headers,
        requestBody: requestBody ? 'stream' : null,
        responseTs,
        responseHeaders,
        status,
        responseBody: responseBody ? 'stream' : null,
      }),
    });
    const response = await akamaiService.fetch(request);
    if (!response.ok) {
      console.error('Akamai service fetch failed:', response.status, response.statusText);
    }
    // No need to wait for response body
    return;
  } else {
    console.error("Service binding 'akamaiService' missing or doesn't have expected methods");
    return;
  }
};
// ============ AKAMAI CODE ENDS ============

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

    // ============ AKAMAI CODE STARTS ============
    // Handle WebSocket connections directly (skip all Akamai processing)
    if (request.headers.get('upgrade') === 'websocket') {
      console.debug("WebSocket connection. Skipping Akamai integration.");
      return globalThis.fetch(request);
    }

    let requestTs: number = 0;
    let requestClone: Request | null;

    try {
      requestTs = Date.now();
      requestClone = request.clone();
    } catch (error) {
      console.error('Failed to initialize Akamai (request):', error);
      requestClone = null;
    }
    // ============ AKAMAI CODE ENDS ==============

    let response: Response | null = null;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      response = handleOptions();
    }

    // Only GET requests allowed for this simple API
    if (!response && request.method !== 'GET') {
      response = jsonResponse(
        { error: 'Method Not Allowed', message: 'Only GET requests are supported' },
        405
      );
    }

    // Route handling (only if response not already set)
    if (!response) {
      if (pathname === '/') {
        response = jsonResponse({
          message: 'Hello World!',
          timestamp: new Date().toISOString(),
          path: '/',
          method: 'GET',
        });
      } else if (pathname === '/hello') {
        response = jsonResponse({
          message: 'Hello from the API!',
          endpoint: '/hello',
          timestamp: new Date().toISOString(),
        });
      } else if (pathname === '/health') {
        response = jsonResponse({
          status: 'OK',
          timestamp: new Date().toISOString(),
          service: 'currency-converter-api',
        });
      } else if (pathname === '/convert') {
        const params = validateConversionParams(url.searchParams);
        if (!params) {
          response = errorResponse(
            'Invalid request',
            'Missing or invalid parameters. Required: amount (positive number), from (3-letter ISO code), to (3-letter ISO code)',
            400
          );
        } else {
          try {
            const { amount, from, to } = params;
            const result = await currencyService.convert(amount, from, to);
            const conversionResponse: ConversionResponse = {
              amount,
              from: from.toUpperCase(),
              to: to.toUpperCase(),
              rate: result.rate,
              converted: result.converted,
              timestamp: new Date().toISOString(),
            };
            response = jsonResponse(conversionResponse);
          } catch (error: any) {
            if (error.message.includes('Invalid source currency code')) {
              response = errorResponse('Currency not found', error.message, 404);
            } else if (error.message.includes('Invalid target currency code')) {
              response = errorResponse('Currency not found', error.message, 404);
            } else if (error.message.includes('Only conversions involving USD are supported')) {
              response = errorResponse('Invalid request', error.message, 400);
            } else if (error.message.includes('Amount must be a positive number')) {
              response = errorResponse('Invalid request', error.message, 400);
            } else {
              // Unknown error
              console.error('Conversion error:', error);
              response = errorResponse('Internal server error', 'Failed to perform conversion', 500);
            }
          }
        }
      } else if (pathname === '/currencies') {
        try {
          const currencies: CurrencyInfo[] = await currencyService.listCurrencies();
          response = jsonResponse({
            currencies,
            count: currencies.length,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Failed to list currencies:', error);
          response = errorResponse('Internal server error', 'Failed to load currency list', 500);
        }
      } else {
        // Unknown route
        response = jsonResponse(
          {
            error: 'Not Found',
            message: 'Route not found',
            path: pathname,
          },
          404
        );
      }
    }

    // At this point, response should never be null
    if (!response) {
      console.error('Unexpected state: response is null');
      response = new Response('Internal Server Error', { status: 500 });
    }

    // ============ AKAMAI CODE STARTS ============
    let responseTs: number = 0;
    let responseClone: Response | null;

    try {
      responseTs = Date.now();
      responseClone = response.clone();
    } catch (error) {
      console.error('Failed to clone response for Akamai:', error);
      responseClone = null;
    }

    // Send to Akamai if we have both clones
    if (requestClone && responseClone) {
      try {
        const config = getAkamaiConfig(env);

        // Pre-flight check: skip cached responses if configured
        let shouldSendToAkamai = true;

        if (config.ignoreCachedResponses) {
          const cacheStatus = (response.headers.get('cf-cache-status') || '').toLowerCase();
          if (cacheStatus === 'hit') {
            console.debug('Cache HIT - skipping Akamai');
            shouldSendToAkamai = false;
          }
        }

        if (shouldSendToAkamai && env.akamaiService) {
          // Pre-flight check: should we send request/response bodies?
          const sendRequestBody = shouldSendBody(requestClone.body, requestClone.headers, config.maxBodySizeBytes);
          const sendResponseBody = shouldSendBody(responseClone.body, responseClone.headers, config.maxBodySizeBytes);

          const akamaiPromise = callAkamaiService(
            env.akamaiService,
            requestTs,
            requestClone.cf || {},
            requestClone.method,
            requestClone.url,
            Object.fromEntries(requestClone.headers),
            sendRequestBody ? requestClone.body : null,
            responseTs,
            Object.fromEntries(responseClone.headers),
            responseClone.status,
            sendResponseBody ? responseClone.body : null,
            ctx
          ).catch((error) => {
            console.error('Akamai service binding call failed:', error);
          });

          ctx.waitUntil(akamaiPromise);
        } else if (!env.akamaiService) {
          console.error("Service binding 'akamaiService' missing");
        }
      } catch (error) {
        console.error('Error in Akamai processing:', error);
        // Continue with original worker logic
      }
    }
    // ============ AKAMAI CODE ENDS ==============

    return response;
  },
};