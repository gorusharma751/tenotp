import { APP_CONFIG } from "./app";

const SITE_URL = "https://tenotp.lovable.app";

export const buildMeta = (title: string, description?: string, path?: string) => {
  const fullTitle = `${title} — ${APP_CONFIG.name}`;
  const desc = description ?? APP_CONFIG.description;
  const url = path ? `${SITE_URL}${path}` : SITE_URL;
  return [
    { title: fullTitle },
    { name: "description", content: desc },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: desc },
    { property: "og:type", content: "website" },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: desc },
  ];
};
