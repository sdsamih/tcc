import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Upload, Image as ImageIcon, CheckCircle, Loader2, Clock, Settings, Target, Info } from "lucide-react";
import { Tooltip } from "react-tooltip";

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
            <div className="flex items-center gap-2 justify-end mb-1">
              <p className="text-sm text-slate-500">Progresso</p>
              <Info 
                size={14} 
                className="text-slate-400 cursor-help" 
                data-tooltip-id="progress-tooltip"
                data-tooltip-place="left"
              />
            </div>
            <p className="text-2xl font-semibold text-slate-800">{train.progress}%</p>
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
            <p className="text-lg font-semibold text-slate-800">{train.params.epochs}</p>
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
            <p className="text-lg font-semibold text-slate-800">{train.params.learning_rate}</p>
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
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm text-slate-500">Accuracy</p>
                  <Info 
                    size={14} 
                    className="text-slate-400 cursor-help" 
                    data-tooltip-id="accuracy-tooltip"
                    data-tooltip-place="top"
                  />
                </div>
                <p className="text-2xl font-semibold text-slate-800">{train.accuracy?.toFixed(4)}</p>
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
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-medium text-slate-800">Classes</h3>
                <Info 
                  size={14} 
                  className="text-slate-400 cursor-help" 
                  data-tooltip-id="classes-tooltip"
                  data-tooltip-place="right"
                />
              </div>
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

      <Tooltip id="epochs-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que e:</p>
          <p className="mb-3">Numero de vezes que o modelo ve todo o dataset durante o treinamento. Uma epoch = uma passagem completa pelos dados.</p>
          <p className="font-semibold mb-2">Impactos:</p>
          <p className="text-green-600 mb-1">Mais epochs: Modelo aprende melhor, accuracy tende a aumentar</p>
          <p className="text-red-600">Muitas epochs: Overfitting, tempo maior de treinamento</p>
        </div>
      </Tooltip>

      <Tooltip id="learningrate-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que e:</p>
          <p className="mb-3">Taxa de aprendizado. Controla o tamanho do passo que o modelo da ao ajustar os pesos. Valores comuns: 0.0001 a 0.01.</p>
          <p className="font-semibold mb-2">Impactos:</p>
          <p className="text-green-600 mb-1">Taxa alta: Aprendizado rapido, mas pode nao convergir</p>
          <p className="text-green-600 mb-1">Taxa baixa: Convergencia mais estavel, porem mais lenta</p>
          <p className="text-red-600 mb-1">Muito alta: Divergencia, modelo nao aprende</p>
          <p className="text-red-600">Muito baixa: Treinamento muito demorado</p>
        </div>
      </Tooltip>

      <Tooltip id="batchsize-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que e:</p>
          <p className="mb-3">Numero de exemplos processados antes de atualizar os pesos do modelo. Batch size menor = mais atualizacoes por epoch.</p>
          <p className="font-semibold mb-2">Impactos:</p>
          <p className="text-green-600 mb-1">Batch pequeno: Mais atualizacoes, melhor generalizacao, usa menos memoria</p>
          <p className="text-green-600 mb-1">Batch grande: Treinamento mais rapido (GPU), gradientes mais estaveis</p>
          <p className="text-red-600 mb-1">Muito pequeno: Treinamento instavel, ruido nos gradientes</p>
          <p className="text-red-600">Muito grande: Pode generalizar mal, requer mais memoria</p>
        </div>
      </Tooltip>

      <Tooltip id="accuracy-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que e:</p>
          <p className="mb-3">Porcentagem de previsoes corretas do modelo nos dados de teste. Varia de 0 a 1 (ou 0% a 100%).</p>
          <p className="font-semibold mb-2">Interpretacao:</p>
          <p className="text-green-600 mb-1">maior que 0.9: Excelente</p>
          <p className="text-green-600 mb-1">0.8-0.9: Bom</p>
          <p className="text-yellow-600 mb-1">0.7-0.8: Aceitavel</p>
          <p className="text-red-600">menor que 0.7: Precisa melhorar</p>
        </div>
      </Tooltip>

      <Tooltip id="loss-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que e:</p>
          <p className="mb-3">Medida de erro do modelo. Quanto menor, melhor. Representa a diferenca entre previsoes e valores reais.</p>
          <p className="font-semibold mb-2">Interpretacao:</p>
          <p className="text-green-600 mb-1">Loss baixo e estavel: Treinamento bem sucedido</p>
          <p className="text-yellow-600 mb-1">Loss oscilando: Pode precisar ajuste de learning rate</p>
          <p className="text-red-600 mb-1">Loss aumentando: Overfitting ou learning rate muito alto</p>
          <p className="text-slate-500 mt-2">Loss ideal depende do problema, mas geralmente menor que 0.5 e bom para classificacao.</p>
        </div>
      </Tooltip>

      <Tooltip id="classes-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que e:</p>
          <p className="mb-3">Categorias que o modelo pode prever. Cada classe representa um grupo de saida possivel.</p>
          <p className="font-semibold mb-2">Exemplos:</p>
          <p className="mb-2">MNIST: 10 classes (digitos 0-9)</p>
          <p>Customizado: Definido pelo seu dataset (ex: gato, cachorro, passaro)</p>
        </div>
      </Tooltip>

      <Tooltip id="progress-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que e:</p>
          <p className="mb-3">Porcentagem de conclusao do treinamento. Atualiza a cada epoch concluida.</p>
          <p className="font-semibold mb-2">Status:</p>
          <p className="text-blue-600 mb-1">0-99%: Treinando</p>
          <p className="text-green-600">100%: Treino concluido, modelo pronto</p>
        </div>
      </Tooltip>
    </div>
  );
}