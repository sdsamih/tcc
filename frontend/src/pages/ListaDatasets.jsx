import { useEffect, useState } from "react";
import { Database, Image as ImageIcon, Folder, Edit, Trash2 } from "lucide-react";

export default function ListaDatasets() {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

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

  const handleEdit = (dataset) => {
    setEditingId(dataset.id);
    setEditingName(dataset.name);
  };

  const handleSaveEdit = async (datasetId) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/datasets/${datasetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName }),
      });
      if (response.ok) {
        setEditingId(null);
        fetchDatasets();
      }
    } catch (error) {
      console.error("Erro ao editar dataset:", error);
    }
  };

  const handleDelete = async (datasetId) => {
    if (!confirm("Tem certeza que deseja deletar este dataset?")) return;
    try {
      const response = await fetch(`http://127.0.0.1:8000/datasets/${datasetId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchDatasets();
      }
    } catch (error) {
      console.error("Erro ao deletar dataset:", error);
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
                    {editingId === dataset.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="font-semibold text-slate-800 border border-slate-300 rounded px-2 py-1"
                      />
                    ) : (
                      <h3 className="font-semibold text-slate-800">{dataset.name}</h3>
                    )}
                    <p className="text-sm text-slate-500">ID: {dataset.id}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {editingId === dataset.id ? (
                    <>
                      <button
                        onClick={() => handleSaveEdit(dataset.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        ✗
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(dataset)}
                        className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(dataset.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
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
