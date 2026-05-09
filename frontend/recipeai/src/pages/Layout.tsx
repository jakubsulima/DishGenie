import { useEffect } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { applySeo, getSeoConfig } from "../lib/seo";

const Layout = () => {
  const location = useLocation();

  useEffect(() => {
    applySeo(getSeoConfig(location.pathname));
  }, [location.pathname]);

  return (
    <div className="flex flex-col pt-16 bg-background min-h-screen relative overflow-hidden">
      <ScrollRestoration />
      <Navbar />
      <main key={location.pathname} className="flex-1 animate-fadeIn">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
