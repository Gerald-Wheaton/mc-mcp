export class McClient {
    baseUrl;
    basicAuth;
    constructor(config) {
        this.baseUrl = config.baseUrl;
        this.basicAuth = config.basicAuth;
    }
    async get(path, options = {}) {
        const url = new URL(`${this.baseUrl}${path}`);
        if (options.params) {
            for (const [key, value] of Object.entries(options.params)) {
                if (value !== undefined) {
                    url.searchParams.set(key, String(value));
                }
            }
        }
        const response = await fetch(url.toString(), {
            headers: this.buildHeaders(),
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new McApiError(response.status, path, body);
        }
        return response.json();
    }
    buildHeaders() {
        return {
            Authorization: `Basic ${this.basicAuth}`,
            Accept: 'application/json',
        };
    }
}
export class McApiError extends Error {
    status;
    path;
    body;
    constructor(status, path, body) {
        super(`MC API error ${status} on ${path}: ${body}`);
        this.status = status;
        this.path = path;
        this.body = body;
    }
}
