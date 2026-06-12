import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, FlaskConical, ArrowRight } from "lucide-react";

export default function HistoricoExperimentos() {
  const [experiments, setExperiments] = useState([]);

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
    fetch("http://127.0.0.1:8000/experiment")
      .then((res) => res.json())
      .then((data) => {
        setExperiments(data);
      })
      .catch((err) => {
        console.error("Erro ao buscar experimentos:", err);
      });
  }, []);

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
                    <h3 className="font-medium text-slate-800">{experiment.name}</h3>
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
                <Link to={`/experimento/${experiment.id}`}>
                  <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200">
                    Ver detalhes
                    <ArrowRight size={16} />
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}