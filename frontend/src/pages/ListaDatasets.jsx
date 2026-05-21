import { useEffect, useState } from "react";
import { Database, Image as ImageIcon, Folder } from "lucide-react";

export default function ListaDatasets() {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/datasets");
      const data = await response.json();
      setDatasets(data);
    } catch (error) {
      console.error("Erro ao buscar datasets:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Datasets Disponíveis</h1>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400 mx-auto"></div>
          <p className="text-slate-500 mt-4">Carregando datasets...</p>
        </div>
      ) : datasets.length === 0 ? (
        <div className="text-center py-12">
          <Database className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500">Nenhum dataset disponível</p>
        </div>
      ) : (
        <div className="space-y-4">
          {datasets.map((dataset) => (
            <div
              key={dataset.id}
              className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Database className="text-slate-500" size={24} />
                  <div>
                    <h3 className="font-semibold text-slate-800">{dataset.name}</h3>
                    <p className="text-sm text-slate-500">ID: {dataset.id}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ImageIcon className="text-slate-400" size={16} />
                    <p className="text-sm text-slate-500">Imagens</p>
                  </div>
                  <p className="text-2xl font-semibold text-slate-800">{dataset.num_images}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Folder className="text-slate-400" size={16} />
                    <p className="text-sm text-slate-500">Classes</p>
                  </div>
                  <p className="text-2xl font-semibold text-slate-800">{dataset.num_classes}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Nomes das Classes:</p>
                <div className="flex flex-wrap gap-2">
                  {dataset.classes.map((className, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
                    >
                      {className}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
