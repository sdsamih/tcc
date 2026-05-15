import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Page1 from "./pages/Page1";
import Page2 from "./pages/Page2";
import Page3 from "./pages/Page3";
import Page4 from "./pages/Page4";
import Page5 from "./pages/Page5";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 bg-slate-50 min-h-screen">
          <Routes>
            <Route path="/" element={<Page1 />} />
            <Route path="/tela2" element={<Page2 />} />
            <Route path="/tela3/:id" element={<Page3 />} />
            <Route path="/upload-dataset" element={<Page4 />} />
            <Route path="/datasets-list" element={<Page5 />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}