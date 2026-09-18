const browserFetch = (...args) => window.fetch(...args);
export const Headers = window.Headers;
export default browserFetch;
