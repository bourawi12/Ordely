export function customApiOrdersEndpoint(apiBase: string): string {
  const base = apiBase.replace(/\/+$/, "");
  const apiRoot = base.endsWith("/api") ? base : `${base}/api`;
  return `${apiRoot}/integrations/custom-api/orders`;
}
