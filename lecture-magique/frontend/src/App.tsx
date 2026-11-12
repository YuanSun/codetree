import { useEffect, useState } from "react";
import { api, Me } from "./api";
import Login from "./components/Login";
import Shelf from "./components/Shelf";
import Reader from "./components/Reader";
import Defi from "./components/Defi";
import WordBag from "./components/WordBag";
import Suivi from "./components/Suivi";
import { useTheme } from "./prefs";

// Hash routes keep the server simple (no SPA fallback needed):
//   #/                      bookshelf
//   #/lire/<articleId>/<n>  chapter n of an article
//   #/defi                  this week's challenge
//   #/mots                  word bag
//   #/suivi                 parents: children's progress
//   #/progres               a child's own progress
type Route = { name: "shelf" } | { name: "read"; articleId: number; seq: number } | { name: "defi" } | { name: "mots" }
  | { name: "suivi" } | { name: "progres" };

function parse(hash: string): Route {
  const m = hash.match(/^#\/lire\/(\d+)\/(\d+)/);
  if (m) return { name: "read", articleId: +m[1], seq: +m[2] };
  if (hash.startsWith("#/defi")) return { name: "defi" };
  if (hash.startsWith("#/mots")) return { name: "mots" };
  if (hash.startsWith("#/suivi")) return { name: "suivi" };
  if (hash.startsWith("#/progres")) return { name: "progres" };
  return { name: "shelf" };
}

export const go = (path: string) => {
  window.location.hash = path;
};

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [route, setRoute] = useState<Route>(parse(window.location.hash));
  const theme = useTheme();

  useEffect(() => {
    api.me().then(setMe, () => setMe(null));
    const onHash = () => setRoute(parse(window.location.hash));
    const onUnauth = () => setMe(null);
    window.addEventListener("hashchange", onHash);
    window.addEventListener("lm:unauthorized", onUnauth);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("lm:unauthorized", onUnauth);
    };
  }, []);

  if (me === undefined) return <div className="splash">📖</div>;
  if (me === null) return <Login onLogin={setMe} />;
  if (route.name === "read")
    return <Reader key={`${route.articleId}/${route.seq}`} articleId={route.articleId} seq={route.seq} theme={theme} />;
  if (route.name === "defi") return <Defi theme={theme} />;
  if (route.name === "mots") return <WordBag theme={theme} />;
  if (route.name === "suivi" && (me.role === "parent" || me.role === "admin")) return <Suivi theme={theme} />;
  if (route.name === "progres") return <Suivi theme={theme} self />;
  return <Shelf me={me} onLogout={() => api.logout().finally(() => setMe(null))} theme={theme} />;
}
