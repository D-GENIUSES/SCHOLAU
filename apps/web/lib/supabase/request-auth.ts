export interface VerifiableClient {
  auth: { getUser(token?: string): Promise<{ data: { user: unknown }; error: unknown }> };
}
/** A supplied invalid header must never inherit a valid browser cookie. */
export function createRequestAuthenticator<C extends VerifiableClient>(dependencies: {
  cookies: () => Promise<C>;
  bearer: (token: string) => C;
}) {
  return async (request: Request): Promise<C> => {
    const authorization = request.headers.get('authorization');
    if (authorization === null) return dependencies.cookies();
    const token = /^Bearer ([^\s]+)$/i.exec(authorization)?.[1];
    if (!token) throw new Error('INVALID_BEARER_TOKEN');
    const client = dependencies.bearer(token);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) throw new Error('INVALID_BEARER_TOKEN');
    return client;
  };
}
/** Hosted adapters can expose an internal origin; trust the configured public origin. */
export function isSameOriginRequest(request: Request) {
  try {
    const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin;
    return request.headers.get('origin') === origin;
  } catch {
    return false;
  }
}
export function allowRequestWrite(request: Request) {
  return request.headers.has('authorization') || isSameOriginRequest(request);
}
/** These handlers authenticate bearer requests themselves; page routes still use cookie redirects. */
export function isBearerApiRequest(request: Request) {
  return request.headers.has('authorization') && ['/api/profile-photo', '/api/lesson-assets', '/api/account/photo', '/api/course-materials', '/api/admin/content-sync', '/api/material-ingestion'].includes(new URL(request.url).pathname);
}
