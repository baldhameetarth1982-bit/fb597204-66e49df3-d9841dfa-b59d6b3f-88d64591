import { useEffect, useState } from "react";
import logoAsset from "@/assets/sociohub-logo.jpeg.asset.json";

const SESSION_KEY = "sociohub:splashed";

/**
 * Native-app style splash: full white screen with centered logo on the very
 * first load of a session. Renders nothing during SSR/first paint to avoid
 * hydration mismatch (sessionStorage is unavailable on the server).
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    setVisible(true);
    const t = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      setVisible(false);
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-white animate-in fade-in duration-200"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-5">
        <img
          src={logoAsset.url}
          alt="SocioHub"
          width={128}
          height={128}
          className="h-32 w-32 rounded-[28%] shadow-2xl animate-in zoom-in-95 duration-500"
        />
        <div className="flex flex-col items-center gap-3">
          <span className="text-2xl font-semibold tracking-tight text-slate-900">
            SocioHub
          </span>
          <span className="text-xs text-slate-500">
            Society management, simplified
          </span>
        </div>
        <div className="mt-6 h-1 w-32 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/2 animate-[splash-bar_2s_ease-in-out_infinite] rounded-full bg-blue-600" />
        </div>
      </div>
      <style>{`
        @keyframes splash-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
