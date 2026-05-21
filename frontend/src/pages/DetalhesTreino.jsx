import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Upload, Image as ImageIcon, CheckCircle, Loader2, Clock, Settings, Target } from "lucide-react";

export default function DetalhesTreino() {
  const { id } = useParams();
  const [train, setTrain] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    let interval;

    const fetchTrain = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/train/${id}`);
        const data = await response.json();

        setTrain(data);

        if (data.status === "ready") {
          clearInterval(interval);
        }
      } catch (error) {
        console.error("Erro ao buscar treino:", error);
      }
    };

    fetchTrain();
    interval = setInterval(fetchTrain, 1000);

    return () => clearInterval(interval);
  }, [id]);

  if (!train) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/train/${id}/download`);

      if (!response.ok) {
        console.error("Erro ao baixar modelo");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${id}.keras`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Erro ao baixar modelo:", error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setPrediction(null);
    }
  };

  const handlePredict = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`http://127.0.0.1:8000/train/${id}/predict`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setPrediction(data);
    } catch (error) {
      console.error("Erro ao fazer predição:", error);
    }
  };

  const getClassName = (classIndex) => {
    if (train.class_names && train.class_names[classIndex] !== undefined) {
      return train.class_names[classIndex];
    }
    return classIndex;
  };

  const getStatusIcon = () => {
    switch (train.status) {
      case "ready":
        return <CheckCircle className="text-green-500" size={24} />;
      case "training":
        return <Loader2 className="text-blue-500 animate-spin" size={24} />;
      default:
        return <Clock className="text-slate-400" size={24} />;
    }
  };

  const getStatusColor = () => {
    switch (train.status) {
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
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Detalhes do Treino</h1>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {getStatusIcon()}
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Treino #{train.id}</h2>
              <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor()}`}>
                {train.status}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Progresso</p>
            <p className="text-2xl font-semibold text-slate-800">{train.progress}%</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-500 mb-1">Epochs</p>
            <p className="text-lg font-semibold text-slate-800">{train.params.epochs}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-500 mb-1">Learning Rate</p>
            <p className="text-lg font-semibold text-slate-800">{train.params.learning_rate}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-500 mb-1">Batch Size</p>
            <p className="text-lg font-semibold text-slate-800">{train.params.batch_size}</p>
          </div>
        </div>
      </div>

      {train.status === "ready" && (
        <>
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Settings className="text-slate-500" size={20} />
              <h3 className="font-medium text-slate-800">Métricas</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500 mb-1">Accuracy</p>
                <p className="text-2xl font-semibold text-slate-800">{train.accuracy?.toFixed(4)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500 mb-1">Loss</p>
                <p className="text-2xl font-semibold text-slate-800">{train.loss?.toFixed(4)}</p>
              </div>
            </div>

            <button
              onClick={handleDownload}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200"
            >
              <Download size={18} />
              Baixar Modelo
            </button>
          </div>

          {train.class_names && (
            <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
              <h3 className="font-medium text-slate-800 mb-4">Classes</h3>
              <div className="grid grid-cols-2 gap-2">
                {train.class_names.map((className, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-700">
                    <span className="font-medium">{idx}:</span> {className}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Target className="text-slate-500" size={20} />
              <h3 className="font-medium text-slate-800">Testar Inferência</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Selecionar Imagem</label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>

              <button
                onClick={handlePredict}
                disabled={!selectedFile}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload size={18} />
                Prever
              </button>

              {previewUrl && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-700 mb-2">Preview</p>
                  <div className="bg-slate-50 rounded-lg p-4 flex justify-center">
                    <img src={previewUrl} alt="Preview" className="max-w-xs rounded-lg" />
                  </div>
                </div>
              )}

              {prediction && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="text-green-600" size={20} />
                    <h4 className="font-medium text-green-800">Resultado</h4>
                  </div>
                  <div className="space-y-1">
                    <p className="text-green-700"><strong>Classe:</strong> {getClassName(prediction.predicted_class)}</p>
                    <p className="text-green-700"><strong>Confiança:</strong> {(prediction.confidence * 100).toFixed(2)}%</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}