import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ScholAu",
    short_name: "ScholAu",
    description: "Study your university courses, practise with feedback and compete in 1v1 quiz battles.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#0866e8",
    theme_color: "#0866e8",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/pwa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
