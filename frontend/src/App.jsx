import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import HistoricoTreinos from "./pages/HistoricoTreinos";
import NovoTreino from "./pages/NovoTreino";
import DetalhesTreino from "./pages/DetalhesTreino";
import UploadDataset from "./pages/UploadDataset";
import ListaDatasets from "./pages/ListaDatasets";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 bg-slate-50 min-h-screen">
          <Routes>
            <Route path="/" element={<HistoricoTreinos />} />
            <Route path="/novo-treino" element={<NovoTreino />} />
            <Route path="/treino/:id" element={<DetalhesTreino />} />
            <Route path="/upload-dataset" element={<UploadDataset />} />
            <Route path="/datasets" element={<ListaDatasets />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}