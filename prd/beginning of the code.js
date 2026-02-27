// ============ AKAMAI CODE STARTS ============
// Default configuration for Akamai
const DEFAULT_IGNORE_CACHED_RESPONSES = false;
const DEFAULT_MAX_BODY_SIZE_BYTES = 1048576; // 1 MB

// Get configuration from environment variables
const getAkamaiConfig = (env) => {
    const ignoreCachedResponses = env.IGNORE_CACHED_RESPONSES 
        ? String(env.IGNORE_CACHED_RESPONSES).toLowerCase() === 'true'
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
const shouldSendBody = (body, headers, maxBodySizeBytes) => {
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
// ============ AKAMAI CODE ENDS ============
