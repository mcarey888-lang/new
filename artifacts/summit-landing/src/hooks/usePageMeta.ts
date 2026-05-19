import { useEffect } from "react";

interface PageMeta {
  title: string;
  description: string;
  canonical?: string;
  schema?: object;
}

export function usePageMeta({ title, description, canonical, schema }: PageMeta) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const setMeta = (name: string, content: string, attr = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
      return el;
    };

    setMeta("description", description);
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");

    if (canonical) {
      let canon = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canon) {
        canon = document.createElement("link") as HTMLLinkElement;
        (canon as HTMLLinkElement).rel = "canonical";
        document.head.appendChild(canon);
      }
      (canon as HTMLLinkElement).href = canonical;
    }

    let schemaEl: HTMLScriptElement | null = null;
    if (schema) {
      schemaEl = document.createElement("script");
      schemaEl.type = "application/ld+json";
      schemaEl.textContent = JSON.stringify(schema);
      schemaEl.setAttribute("data-page-schema", "true");
      document.head.appendChild(schemaEl);
    }

    return () => {
      document.title = prevTitle;
      if (schemaEl) schemaEl.remove();
    };
  }, [title, description, canonical]);
}
