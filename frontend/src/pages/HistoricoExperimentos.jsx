import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, FlaskConical, ArrowRight, Edit, Trash2 } from "lucide-react";
import { apiGet, apiPut, apiDelete } from "../utils/api";

export default function HistoricoExperimentos() {
  const [experiments, setExperiments] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const getArchitectureName = (architecture) => {
    const architectureNames = {
      "simple": "Dense",
      "cnn": "CNN",
      "mobilenet": "MobileNet",
      "resnet50": "ResNet50",
      "inceptionv3": "InceptionV3",
      "xception": "Xception",
      "densenet121": "DenseNet121"
    };
    return architectureNames[architecture] || architecture;
  };

  useEffect(() => {
    apiGet("/experiment")
      .then((data) => {
        setExperiments(data);
      })
      .catch((err) => {
        console.error("Erro ao buscar experimentos:", err);
      });
  }, []);

  const handleEdit = (experiment) => {
    setEditingId(experiment.id);
    setEditingName(experiment.name);
  };

  const handleSaveEdit = async (experimentId) => {
    try {
      await apiPut(`/experiment/${experimentId}`, { name: editingName });
      setEditingId(null);
      apiGet("/experiment")
        .then((data) => setExperiments(data))
        .catch((err) => console.error("Erro ao buscar experimentos:", err));
    } catch (error) {
      console.error("Erro ao editar experimento:", error);
    }
  };

  const handleDelete = async (experimentId) => {
    if (!confirm("Tem certeza que deseja deletar este experimento e todos os seus treinos?")) return;
    try {
      await apiDelete(`/experiment/${experimentId}`);
      apiGet("/experiment")
        .then((data) => setExperiments(data))
        .catch((err) => console.error("Erro ao buscar experimentos:", err));
    } catch (error) {
      console.error("Erro ao deletar experimento:", error);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Histórico de Experimentos</h1>

      {experiments.length === 0 ? (
        <div className="text-center py-12">
          <FlaskConical className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500">Nenhum experimento encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {experiments.map((experiment) => (
            <div
              key={experiment.id}
              className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <FlaskConical className="text-slate-500" size={20} />
                  <div>
                    {editingId === experiment.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="font-medium text-slate-800 border border-slate-300 rounded px-2 py-1"
                      />
                    ) : (
                      <h3 className="font-medium text-slate-800">{experiment.name}</h3>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-slate-500">
                        {getArchitectureName(experiment.architecture)}
                      </span>
                      <span className="text-sm text-slate-500">•</span>
                      <span className="text-sm text-slate-500">
                        {experiment.train_count} treino{experiment.train_count !== 1 ? "s" : ""}
                      </span>
                      <span className="text-sm text-slate-500">•</span>
                      <span className="text-sm text-slate-500">
                        {experiment.created_at}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingId === experiment.id ? (
                    <>
                      <button
                        onClick={() => handleSaveEdit(experiment.id)}
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
                        onClick={() => handleEdit(experiment)}
                        className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(experiment.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                      <Link to={`/experimento/${experiment.id}`}>
                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200">
                          Ver detalhes
                          <ArrowRight size={16} />
                        </button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}