# Simplified notification consent — 18 October 2026

This replaces the category/schedule settings interface and the admin-only pilot described in
the initial push rollout. Browser permission now enables the complete bundle for any active
account, while existing role, course-enrollment and event-relevance checks still apply.

## User flow

- Successful student and lecturer registration shows a short completion screen. Continue opens
  the native browser/device permission prompt directly from the click, as required by browsers.
- Accepting activates all notification categories and the daily reminder together. Timezone is
  detected automatically; existing quiet-hour and reminder defaults run without user configuration.
- Email-confirmed registrations persist the grant for the same user on the same browser. Enrollment
  finishes after verification/sign-in. Expired intents and different-account sign-ins cannot enroll
  the wrong user. No auth effect requests native permission on its own.
- Denying or dismissing permission never blocks signup. After 24 hours, on the user's next visit
  or focus, an in-app reminder offers Enable notifications or Later. Later defers another 24 hours.
  An open tab checks once a minute. The offer is stored per account and browser, survives refresh,
  and does not create a push subscription before permission is granted.
- If the browser remembers a denial, its native dialog cannot be forced open again. The reminder
  explains how to allow notifications in browser/device settings and lets the user retry. On iOS,
  the existing Home Screen installation requirement still applies.
- The header bell opens the combined notification inbox/device activation screen. Manual enabling
  is available immediately, regardless of the automatic reminder cooldown. Old /notifications links
  redirect to the same screen.
- Settings contain just this device's On/Off state, an enable/disable action, and the inbox. Turning
  notifications off intentionally does not itself create weekly reminders.

## Implementation and deployment

`enable_all_notifications_v1(uuid,text,jsonb,text)` checks the expected signed-in owner and atomically
registers the subscription and enables all five categories. Browser timezone validation falls back
to Africa/Lagos. Subscription endpoint validation, account deactivation, logout revocation, delivery
leases and worker checks remain in place. Explicit disable affects this device, not other devices.

Migration `20261018000100_simple_notification_consent.sql` was applied to the linked database.
Delivery configuration is enabled for all roles (`general_release=true`); native permission remains
required on each device. The local production app was rebuilt and its actual signed-in settings
page verified without category or schedule controls. Public frontend hosting was not redeployed.

## Verification

- Full isolated database regression suite: **788 assertions passed**, including **15 new consent
  assertions** for atomic enabling, owner checks, invalid endpoints, automatic timezone and revoke.
- Simplified browser flow: **22 scenarios passed** with zero page errors, covering registration,
  native permission mocks, all-category enrollment, email confirmation, denial, account switching,
  expiry, 24-hour cooldown, Later, blocked-permission guidance and later acceptance.
- ESLint, TypeScript and production build passed. No real accounts were created or live test pushes
  sent. Browser permission prompts and device delivery still depend on the actual browser/OS.

References: [Notification permission](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static)
and [user-gesture requirements](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API).
