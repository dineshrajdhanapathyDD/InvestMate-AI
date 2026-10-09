import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Research } from "./pages/Research";
import { StockSearch } from "./pages/StockSearch";
import { Watchlist } from "./pages/Watchlist";
import { HistoricalData } from "./pages/HistoricalData";
import { Portfolio } from "./pages/Portfolio";
import { Settings } from "./pages/Settings";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/research" element={<Research />} />
        <Route path="/search" element={<StockSearch />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/history" element={<HistoricalData />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </Layout>
  );
}
