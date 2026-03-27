import { McApiError } from '../mc-client.js';
export function toToolText(data) {
    return {
        content: [
            {
                type: 'text',
                text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
            },
        ],
    };
}
export function toToolError(err) {
    const message = err instanceof McApiError
        ? `MC API error ${err.status}: ${err.body || err.message}`
        : err instanceof Error
            ? err.message
            : String(err);
    return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
    };
}
