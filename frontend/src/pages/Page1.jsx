import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, CheckCircle, Loader2, ArrowRight } from "lucide-react";

export default function Page1() {
  const [trains, setTrains] = useState([]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/train")
      .then((res) => res.json())
      .then((data) => {
        setTrains(data);
      })
      .catch((err) => {
        console.error("Erro ao buscar treinos:", err);
      });
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case "ready":
        return <CheckCircle className="text-green-500" size={20} />;
      case "training":
        return <Loader2 className="text-blue-500 animate-spin" size={20} />;
      default:
        return <Clock className="text-slate-400" size={20} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "ready":
        return "bg-green-100 text-green-700";
      case "training":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Histórico de Treinos</h1>

      {trains.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500">Nenhum treino encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trains.map((train) => (
            <div
              key={train.id}
              className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {getStatusIcon(train.status)}
                  <div>
                    <h3 className="font-medium text-slate-800">Treino #{train.id}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(train.status)}`}>
                        {train.status}
                      </span>
                      <span className="text-sm text-slate-500">Progresso: {train.progress}%</span>
                    </div>
                  </div>
                </div>
                <Link to={`/tela3/${train.id}`}>
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