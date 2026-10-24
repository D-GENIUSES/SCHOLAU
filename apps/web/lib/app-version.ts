/** Public release identity only; never expose configuration or credential values. */
export function getAppVersion() {
  return process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_APP_BUILD || "local-blue-v4";
}
