// ============ AKAMAI CODE STARTS ============
// Handle WebSocket connections directly (skip all Akamai processing)
if (request.headers.get('upgrade') === 'websocket') {
    console.debug("WebSocket connection. Skipping Akamai integration.");
    return fetch(request);
}

let requestTs;
let requestClone;

try {
    requestTs = Date.now();
    requestClone = request.clone();
} catch (error) {
    console.error('Failed to initialize Akamai (request):', error);
    // Continue without Akamai
    requestClone = null;
}
// ============ AKAMAI CODE ENDS ==============
