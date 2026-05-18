import { useEffect, useState } from "react";

/** Read window.location.hash (without the leading "#"), reacting to changes. */
export function useHashRoute(): string {
  const [hash, setHash] = useState<string>(() =>
    typeof window === "undefined" ? "" : window.location.hash.slice(1),
  );
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash.slice(1));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return hash;
}

/** Imperative navigation. */
export function setHashRoute(next: string): void {
  if (typeof window === "undefined") return;
  window.location.hash = next;
}
