export const adsensePublisher = /^ca-pub-\d{16}$/.test(process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID ?? "")
  ? process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID
  : undefined;
