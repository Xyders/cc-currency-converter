// ============ AKAMAI CODE STARTS ============
let responseTs;
let responseClone;

try {
    responseTs = Date.now();
    responseClone = response.clone();
} catch (error) {
    console.error('Failed to clone response for Akamai:', error);
    // Continue without Akamai
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

        if (shouldSendToAkamai && env.akamaiService?.handleWorkerRequest) {
            // Pre-flight check: should we send request/response bodies?
            const sendRequestBody = shouldSendBody(requestClone.body, requestClone.headers, config.maxBodySizeBytes);
            const sendResponseBody = shouldSendBody(responseClone.body, responseClone.headers, config.maxBodySizeBytes);

            const akamaiPromise = env.akamaiService.handleWorkerRequest(
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
            ).catch((error) => {
                console.error('Akamai service binding call failed:', error);
            });

            ctx.waitUntil(akamaiPromise);
        } else if (!env.akamaiService?.handleWorkerRequest) {
            console.error("Service binding 'akamaiService' missing or doesn't have 'handleWorkerRequest' method");
        }
    } catch (error) {
        console.error('Error in Akamai processing:', error);
        // Continue with original worker logic
    }
}
// ============ AKAMAI CODE ENDS ==============
