import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PrefsProvider, usePrefs } from "./prefs";
import { ToastProvider } from "./components/ui";
import AppleScrollbar from "./components/AppleScrollbar";
import Shell from "./components/Shell";
import Landing from "./pages/Landing";
import Overview from "./pages/Overview";
import Scanner from "./pages/Scanner";
import ImageLab from "./pages/ImageLab";
import History from "./pages/History";
import Analytics from "./pages/Analytics";
import Library from "./pages/Library";
import AboutModel from "./pages/AboutModel";
import Settings from "./pages/Settings";

function ScrollTop() { const { pathname } = useLocation(); useEffect(() => { window.scrollTo(0, 0); }, [pathname]); return null; }
function Inner() {
  const { apple } = usePrefs();
  return (
    <>
      <ScrollTop /><AppleScrollbar enabled={apple} />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Shell />}>
          <Route index element={<Overview />} /><Route path="scanner" element={<Scanner />} /><Route path="lab" element={<ImageLab />} /><Route path="history" element={<History />} />
          <Route path="analytics" element={<Analytics />} /><Route path="library" element={<Library />} /><Route path="model" element={<AboutModel />} /><Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
export default function App() { return <PrefsProvider><ToastProvider><Inner /></ToastProvider></PrefsProvider>; }
