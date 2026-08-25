import type { MetadataRoute } from "next";
import messages from "@/messages/ar.json";

export default function manifest(): MetadataRoute.Manifest {
  const appName: string = messages.Global.productName;

  return {
    name: appName,
    short_name: appName,
    description: messages.SEO.homeDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#08080c",
    lang: "ar",
    dir: "rtl",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
