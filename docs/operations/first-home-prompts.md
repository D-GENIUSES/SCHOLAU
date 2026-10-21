# First Home notification and installation prompts

Notification consent is offered after authenticated Home data loads. Signup completion no longer requests browser notification permission. Guest Home and incomplete registration routes do not mount the prompts.

- The notification dialog is remembered per account, browser, and installed-app mode. Closing it or choosing Not now prevents repeat offers on refresh.
- Existing granted subscriptions and blocked browser permissions do not trigger the initial dialog.
- The permission API runs directly from the Enable notifications tap; subscription registration uses the existing push implementation.
- An iPhone/iPad browser shows a top installation banner and Share → Add to Home Screen instructions. Opening the installed app allows a separate notification offer, even after dismissing the browser offer.
- Browsers that emit `beforeinstallprompt` use the captured, single-use native install prompt. Installed mode and `appinstalled` suppress the installation banner.
- Installation suggestions can be dismissed independently. Storage restrictions and push setup failures do not block Home.

The install provider is mounted above route content so it can capture the install event before signup navigates to Home. No account permissions, database schema, or notification-delivery policy changes are required.

Validation: TypeScript and changed-file ESLint; browser checks for first-Home consent, direct user activation, persisted dismissals, iPhone instructions and mobile layout, installed iPhone behavior, denied permission, and native install events. Platform APIs were simulated in Chromium; native iOS installation and the system permission sheet still require a real-device smoke check.

Apple requires Home Screen installation and a direct interaction for iOS Web Push: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
