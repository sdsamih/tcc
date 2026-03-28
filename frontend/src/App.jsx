import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Page1 from "./pages/Page1";
import Page2 from "./pages/Page2";
import Page3 from "./pages/Page3";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <div style={{ padding: "20px" }}>
        <Routes>
          <Route path="/" element={<Page1 />} />
          <Route path="/tela2" element={<Page2 />} />
          <Route path="/tela3" element={<Page3 />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}