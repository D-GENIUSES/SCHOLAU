# Complete account erasure

Hard-delete the selected account through Supabase Dashboard → Authentication → Users.
Installing this migration does not delete any accounts. The app continues to send deletion requests to support.

The Auth BEFORE DELETE trigger removes the profile, academic history, roles, enrollments, attempts and answers, learning progress, activity, XP ledger and totals, mastery data, battle participation and answers, queues, counters, notifications, reports, entitlements, push tokens, personal audit records and pending personal events in the same transaction. A failure rolls back the entire deletion.

Shared content remains published with reviewer identity removed. Shared battle rows and the surviving player's XP and participation remain; live matches are cancelled and both reservations released. The deleted player's name, profile, answers and UUID references are removed. History displays Deleted user when an opponent was removed.

The ledger remains append-only outside a private transaction-scoped deletion context. Clients cannot write the context or invoke the trigger function. The context row is removed before the trigger returns. Published content can only lose reviewer/retirer attribution during this deletion context; other fields remain immutable.

Supabase Storage files must be removed through the Storage API before Auth deletion if the account owns any. Do not delete storage.objects metadata directly: that would leave physical objects behind. Shared lesson assets should be retained as institutional content after removing personal uploader ownership through the Storage API where appropriate.

Regression tests: 12_account_erasure.test.sql exercises erasure with reviews and XP, reviewed content, a finished match and a live match, protects opponents' XP and premium grants, and checks that erasure privileges and immutable-data guards remain restricted.
