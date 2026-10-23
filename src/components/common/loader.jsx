import { createContext, useContext, useEffect, useId, useMemo, useState } from "react";
import logo from "@/assets/gp_logo1.png";

export const PageLoaderContext = createContext(null);

function LoaderMark({ text = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative h-36 w-36">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#e5e7eb" strokeWidth="6" />
        </svg>
        <svg className="absolute inset-0 h-full w-full animate-spin" viewBox="0 0 100 100" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="#1a1a1a"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="78 198"
          />
        </svg>
        <img
          src={logo}
          alt="GrainsPro"
          className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 object-contain"
        />
      </div>
      {text ? <span className="text-sm font-medium text-slate-600">{text}</span> : null}
    </div>
  );
}

export function PageLoaderHost({ children }) {
  const [entries, setEntries] = useState([]);
  const api = useMemo(
    () => ({
      show(id, text) {
        setEntries((current) => {
          const next = current.filter((item) => item.id !== id);
          next.push({ id, text });
          return next;
        });
      },
      hide(id) {
        setEntries((current) => current.filter((item) => item.id !== id));
      },
    }),
    []
  );
  const active = entries[entries.length - 1];

  return (
    <PageLoaderContext.Provider value={api}>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
        {active ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/75 backdrop-blur-sm">
            <LoaderMark text={active.text} />
          </div>
        ) : null}
      </div>
    </PageLoaderContext.Provider>
  );
}

export default function Loader({ isLoading = true, text = "Loading..." }) {
  const pageLoader = useContext(PageLoaderContext);
  const loaderId = useId();

  useEffect(() => {
    if (!pageLoader) return undefined;
    if (!isLoading) {
      pageLoader.hide(loaderId);
      return undefined;
    }
    pageLoader.show(loaderId, text);
    return () => pageLoader.hide(loaderId);
  }, [pageLoader, isLoading, text, loaderId]);

  if (pageLoader || !isLoading) return null;

  return (
    <div className="flex items-center justify-center py-6">
      <LoaderMark text={text} />
    </div>
  );
}
