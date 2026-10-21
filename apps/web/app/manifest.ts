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
    theme_color: "#FFFFFF",
    icons: [
      { src: "/icons/launch-blue-v4.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/launch-blue-v4-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/launch-blue-v4-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/launch-blue-v4-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
