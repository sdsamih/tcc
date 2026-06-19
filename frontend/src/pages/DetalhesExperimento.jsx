import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Upload, Image as ImageIcon, CheckCircle, Loader2, Clock, Settings, Target, Info, Plus, FlaskConical, Play, Trash2 } from "lucide-react";
import { Tooltip } from "react-tooltip";

export default function DetalhesExperimento() {
  const { id } = useParams();
  const [experiment, setExperiment] = useState(null);
  const [selectedTrainId, setSelectedTrainId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showRetrainForm, setShowRetrainForm] = useState(false);
  const [retrainParams, setRetrainParams] = useState({ epochs: 10, learning_rate: 0.001, batch_size: 32, early_stopping: false });

  useEffect(() => {
    fetchExperiment();
  }, [id]);

  useEffect(() => {
    if (experiment && experiment.trains && experiment.trains.length > 0) {
      if (!selectedTrainId) {
        setSelectedTrainId(experiment.trains[0].id);
      }
    }
  }, [experiment, selectedTrainId]);

  const fetchExperiment = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/experiment/${id}`);
      const data = await response.json();
      setExperiment(data);
    } catch (error) {
      console.error("Erro ao buscar experimento:", error);
    }
  };

  const getSelectedTrain = () => {
    if (!experiment || !experiment.trains) return null;
    return experiment.trains.find(t => t.id === selectedTrainId);
  };

  const selectedTrain = getSelectedTrain();

  useEffect(() => {
    let interval;

    const pollTrain = async () => {
      if (!selectedTrainId) return;
      
      try {
        const response = await fetch(`http://127.0.0.1:8000/train/${selectedTrainId}`);
        const data = await response.json();

        if (data.status === "ready") {
          clearInterval(interval);
        }

        // Atualizar apenas o treino selecionado no experimento
        setExperiment(prev => ({
          ...prev,
          trains: prev.trains.map(t => t.id === selectedTrainId ? data : t)
        }));
      } catch (error) {
        console.error("Erro ao buscar treino:", error);
      }
    };

    if (selectedTrain && selectedTrain.status === "training") {
      pollTrain();
      interval = setInterval(pollTrain, 1000);
    }

    return () => clearInterval(interval);
  }, [selectedTrainId, selectedTrain?.status]);

  if (!experiment) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  const handleDownload = async () => {
    if (!selectedTrain) return;
    
    try {
      const response = await fetch(`http://127.0.0.1:8000/train/${selectedTrain.id}/download`);

      if (!response.ok) {
        console.error("Erro ao baixar modelo");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedTrain.id}.keras`;
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
    if (!selectedFile || !selectedTrain) {
      console.error("Arquivo ou treino não selecionado");
      return;
    }

    console.log("Tentando predict para treino:", selectedTrain.id, "status:", selectedTrain.status);

    if (selectedTrain.status !== "ready") {
      console.error("Treino ainda não está pronto. Status atual:", selectedTrain.status);
      alert("O modelo ainda está treinando. Aguarde a conclusão do treino.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      console.log("Enviando requisição de predict...");
      const response = await fetch(`http://127.0.0.1:8000/train/${selectedTrain.id}/predict`, {
        method: "POST",
        body: formData,
      });

      console.log("Resposta do predict:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erro na resposta do predict:", errorData);
        alert(`Erro ao fazer predição: ${errorData.error || "Erro desconhecido"}`);
        return;
      }

      const data = await response.json();
      console.log("Dados da predição:", data);
      setPrediction(data);
    } catch (error) {
      console.error("Erro ao fazer predição:", error);
      alert("Erro ao fazer predição. Verifique se o backend está rodando.");
    }
  };

  const handleRetrain = async (e) => {
    e.preventDefault();

    const payload = {
      experiment_id: String(id),
      epochs: Number(retrainParams.epochs),
      learning_rate: Number(retrainParams.learning_rate),
      batch_size: Number(retrainParams.batch_size),
      early_stopping: retrainParams.early_stopping,
    };

    try {
      const response = await fetch(`http://127.0.0.1:8000/experiment/${id}/train`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error("Erro ao criar treino");
        return;
      }

      const data = await response.json();
      setShowRetrainForm(false);
      fetchExperiment(); // Recarregar experimento para mostrar o novo treino
      setSelectedTrainId(data.train_id);
    } catch (error) {
      console.error("Erro ao criar treino:", error);
    }
  };

  const handleDeleteTrain = async (trainId) => {
    if (!confirm("Tem certeza que deseja deletar este treino?")) return;
    try {
      const response = await fetch(`http://127.0.0.1:8000/train/${trainId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchExperiment();
        if (selectedTrainId === trainId) {
          setSelectedTrainId(null);
        }
      }
    } catch (error) {
      console.error("Erro ao deletar treino:", error);
    }
  };

  const getClassName = (classIndex) => {
    if (selectedTrain && selectedTrain.class_names && selectedTrain.class_names[classIndex] !== undefined) {
      return selectedTrain.class_names[classIndex];
    }
    return classIndex;
  };

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

  const getStatusIcon = (status) => {
    switch (status) {
      case "ready":
        return <CheckCircle className="text-green-500" size={24} />;
      case "training":
        return <Loader2 className="text-blue-500 animate-spin" size={24} />;
      default:
        return <Clock className="text-slate-400" size={24} />;
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
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Detalhes do Experimento</h1>

      {/* Informações do Experimento */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <FlaskConical className="text-slate-500" size={24} />
            <div>
              <h2 className="text-xl font-semibold text-slate-800">{experiment.name}</h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                <span>{getArchitectureName(experiment.architecture)}</span>
                <span>•</span>
                <span>{experiment.created_at}</span>
                <span>•</span>
                <span>{experiment.trains.length} treino{experiment.trains.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowRetrainForm(!showRetrainForm)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200"
          >
            <Plus size={18} />
            Retreinar
          </button>
        </div>

        {/* Formulário de Retreinamento */}
        {showRetrainForm && (
          <form onSubmit={handleRetrain} className="mt-4 p-4 bg-slate-50 rounded-lg">
            <h3 className="font-medium text-slate-800 mb-4">Novo Treino</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Epochs</label>
                <input
                  type="number"
                  value={retrainParams.epochs}
                  onChange={(e) => setRetrainParams({...retrainParams, epochs: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Learning Rate</label>
                <input
                  type="number"
                  step="0.0001"
                  value={retrainParams.learning_rate}
                  onChange={(e) => setRetrainParams({...retrainParams, learning_rate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Batch Size</label>
                <input
                  type="number"
                  value={retrainParams.batch_size}
                  onChange={(e) => setRetrainParams({...retrainParams, batch_size: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={retrainParams.early_stopping}
                  onChange={(e) => setRetrainParams({...retrainParams, early_stopping: e.target.checked})}
                  className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-500"
                />
                <span className="text-sm font-medium text-slate-700">Early Stopping</span>
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-6">Para automaticamente quando a validação não melhora</p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200"
              >
                <Play size={18} />
                Iniciar Treino
              </button>
              <button
                type="button"
                onClick={() => setShowRetrainForm(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Seletor de Treinos */}
      {experiment.trains.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <h3 className="font-medium text-slate-800 mb-4">Treinos</h3>
          <div className="space-y-2">
            {experiment.trains.map((train) => (
              <div
                key={train.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors duration-200 ${
                  selectedTrainId === train.id
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 hover:border-slate-400"
                }`}
              >
                <button
                  onClick={() => setSelectedTrainId(train.id)}
                  className="flex items-center gap-4 flex-1"
                >
                  {getStatusIcon(train.status)}
                  <div className="text-left">
                    <p className="font-medium text-slate-800">Treino #{train.id.slice(0, 8)}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>Epochs: {train.params.epochs}</span>
                      <span>•</span>
                      <span>LR: {train.params.learning_rate}</span>
                      <span>•</span>
                      <span>Batch: {train.params.batch_size}</span>
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-4">
                  {train.status === "ready" && train.accuracy !== null && (
                    <span className="text-sm font-medium text-slate-800">
                      Acc: {train.accuracy.toFixed(4)}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(train.status)}`}>
                    {train.status}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTrain(train.id);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detalhes do Treino Selecionado */}
      {selectedTrain && (
        <>
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                {getStatusIcon(selectedTrain.status)}
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Treino #{selectedTrain.id}</h2>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(selectedTrain.status)}`}>
                    {selectedTrain.status}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <p className="text-sm text-slate-500">Progresso</p>
                  <Info 
                    size={14} 
                    className="text-slate-400 cursor-help" 
                    data-tooltip-id="progress-tooltip"
                    data-tooltip-place="left"
                  />
                </div>
                <p className="text-2xl font-semibold text-slate-800">{selectedTrain.progress}%</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm text-slate-500">Epochs</p>
                  <Info 
                    size={14} 
                    className="text-slate-400 cursor-help" 
                    data-tooltip-id="epochs-tooltip"
                    data-tooltip-place="top"
                  />
                </div>
                <p className="text-lg font-semibold text-slate-800">{selectedTrain.params.epochs}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm text-slate-500">Learning Rate</p>
                  <Info 
                    size={14} 
                    className="text-slate-400 cursor-help" 
                    data-tooltip-id="learningrate-tooltip"
                    data-tooltip-place="top"
                  />
                </div>
                <p className="text-lg font-semibold text-slate-800">{selectedTrain.params.learning_rate}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm text-slate-500">Batch Size</p>
                  <Info 
                    size={14} 
                    className="text-slate-400 cursor-help" 
                    data-tooltip-id="batchsize-tooltip"
                    data-tooltip-place="top"
                  />
                </div>
                <p className="text-lg font-semibold text-slate-800">{selectedTrain.params.batch_size}</p>
              </div>
            </div>
          </div>

          {selectedTrain.status === "ready" && (
            <>
              <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <Settings className="text-slate-500" size={20} />
                  <h3 className="font-medium text-slate-800">Métricas</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm text-slate-500">Accuracy</p>
                      <Info 
                        size={14} 
                        className="text-slate-400 cursor-help" 
                        data-tooltip-id="accuracy-tooltip"
                        data-tooltip-place="top"
                      />
                    </div>
                    <p className="text-2xl font-semibold text-slate-800">{selectedTrain.accuracy?.toFixed(4)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm text-slate-500">Loss</p>
                      <Info 
                        size={14} 
                        className="text-slate-400 cursor-help" 
                        data-tooltip-id="loss-tooltip"
                        data-tooltip-place="top"
                      />
                    </div>
                    <p className="text-2xl font-semibold text-slate-800">{selectedTrain.loss?.toFixed(4)}</p>
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

              {selectedTrain.class_names && (
                <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Target className="text-slate-500" size={20} />
                    <h3 className="font-medium text-slate-800">Classes</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTrain.class_names.map((className, index) => (
                      <span key={index} className="px-3 py-1 bg-slate-100 rounded-full text-sm text-slate-700">
                        {className}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <ImageIcon className="text-slate-500" size={20} />
                  <h3 className="font-medium text-slate-800">Testar Predição</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Upload de Imagem
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        onChange={handleFileChange}
                        accept="image/*"
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none"
                      />
                      <button
                        onClick={handlePredict}
                        disabled={!selectedFile}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Upload size={18} />
                        Predizer
                      </button>
                    </div>
                  </div>

                  {previewUrl && (
                    <div className="flex items-start gap-6">
                      <div className="w-32 h-32 border border-slate-200 rounded-lg overflow-hidden">
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      {prediction && (
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-800 mb-2">Resultado:</h4>
                          <p className="text-lg text-slate-800">
                            Classe: <span className="font-semibold">{getClassName(prediction.predicted_class)}</span>
                          </p>
                          <p className="text-sm text-slate-600 mt-1">
                            Confiança: {(prediction.confidence * 100).toFixed(2)}%
                          </p>
                          <div className="mt-3 space-y-1">
                            {prediction.probabilities.map((prob, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <span className="w-24 text-sm text-slate-600">{getClassName(index)}:</span>
                                <div className="flex-1 bg-slate-200 rounded-full h-2">
                                  <div
                                    className="bg-slate-900 h-2 rounded-full"
                                    style={{ width: `${prob * 100}%` }}
                                  />
                                </div>
                                <span className="text-sm text-slate-600 w-12 text-right">{(prob * 100).toFixed(1)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Tooltips */}
      <Tooltip id="progress-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que é:</p>
          <p className="mb-3">Porcentagem de conclusão do treinamento. Baseada no número de epochs concluídas.</p>
        </div>
      </Tooltip>

      <Tooltip id="epochs-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que é:</p>
          <p className="mb-3">Número de vezes que o modelo vê todo o dataset durante o treinamento.</p>
        </div>
      </Tooltip>

      <Tooltip id="learningrate-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que é:</p>
          <p className="mb-3">Taxa de aprendizado. Controla o tamanho do passo que o modelo dá ao ajustar os pesos.</p>
        </div>
      </Tooltip>

      <Tooltip id="batchsize-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que é:</p>
          <p className="mb-3">Número de exemplos processados antes de atualizar os pesos do modelo.</p>
        </div>
      </Tooltip>

      <Tooltip id="accuracy-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que é:</p>
          <p className="mb-3">Porcentagem de previsões corretas no conjunto de teste. Valores mais altos indicam melhor desempenho.</p>
        </div>
      </Tooltip>

      <Tooltip id="loss-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que é:</p>
          <p className="mb-3">Erro do modelo. Valores mais baixos indicam melhor ajuste aos dados.</p>
        </div>Drop
      </Tooltip>
    </div>
  );
}