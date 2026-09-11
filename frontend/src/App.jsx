import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import HistoricoExperimentos from "./pages/HistoricoExperimentos";
import NovoExperimento from "./pages/NovoExperimento";
import DetalhesExperimento from "./pages/DetalhesExperimento";
import UploadDataset from "./pages/UploadDataset";
import ListaDatasets from "./pages/ListaDatasets";
import Login from "./pages/Login";
import Register from "./pages/Register";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rotas públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Rotas protegidas */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="flex">
                <Sidebar />
                <main className="flex-1 ml-64 p-8 bg-slate-50 min-h-screen">
                  <Routes>
                    <Route path="/" element={<HistoricoExperimentos />} />
                    <Route path="/novo-experimento" element={<NovoExperimento />} />
                    <Route path="/experimento/:id" element={<DetalhesExperimento />} />
                    <Route path="/upload-dataset" element={<UploadDataset />} />
                    <Route path="/datasets" element={<ListaDatasets />} />
                  </Routes>
                </main>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}