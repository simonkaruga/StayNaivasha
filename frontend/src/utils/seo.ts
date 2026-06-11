import { useEffect } from "react";

interface SEOMeta {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
}

const SITE_NAME = "StayNaivasha";
const DEFAULT_DESC = "Kenya's first local-first vacation rental platform. Verified homes, cottages & retreats in Naivasha. Book via M-Pesa in 30 seconds.";
const DEFAULT_IMAGE = "https://staynaivasha.co.ke/icons/icon-512.png";

function setMeta(attr: string, key: string, value: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

export function useSEO({ title, description, image, url, type = "website" }: SEOMeta) {
  useEffect(() => {
    const fullTitle = `${title} — ${SITE_NAME}`;
    const desc  = description ?? DEFAULT_DESC;
    const img   = image ?? DEFAULT_IMAGE;
    const canonical = url ?? window.location.href;

    document.title = fullTitle;

    setMeta("name",     "description",    desc);
    setMeta("property", "og:title",       fullTitle);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:image",       img);
    setMeta("property", "og:url",         canonical);
    setMeta("property", "og:type",        type);
    setMeta("property", "og:site_name",   SITE_NAME);
    setMeta("name",     "twitter:card",   "summary_large_image");
    setMeta("name",     "twitter:title",  fullTitle);
    setMeta("name",     "twitter:description", desc);
    setMeta("name",     "twitter:image",  img);

    return () => {
      document.title = `${SITE_NAME} — Vacation Rentals in Naivasha, Kenya`;
    };
  }, [title, description, image, url, type]);
}
