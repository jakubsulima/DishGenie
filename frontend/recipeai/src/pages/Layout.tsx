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
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-background pt-16">
      <ScrollRestoration />
      <Navbar />
      <main key={location.pathname} className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
