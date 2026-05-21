import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Database, Cpu, Play, Info } from "lucide-react";
import { Tooltip } from "react-tooltip";

export default function Page2() {
  const [epochs, setEpochs] = useState(10);
  const [learningRate, setLearningRate] = useState(0.001);
  const [batchSize, setBatchSize] = useState(32);
  const [datasetId, setDatasetId] = useState("");
  const [architecture, setArchitecture] = useState("simple");
  const [datasets, setDatasets] = useState([]);
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

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
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      epochs: Number(epochs),
      learning_rate: Number(learningRate),
      batch_size: Number(batchSize),
      dataset_id: datasetId || "",
      architecture: architecture,
    };

    try {
      const response = await fetch("http://127.0.0.1:8000/train", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = typeof errorData === 'object' ? JSON.stringify(errorData) : errorData.detail || "Falha ao criar treino";
        setMessage(`Erro: ${errorMessage}`);
        return;
      }

      const data = await response.json();

      if (!data.train_id) {
        setMessage("Erro: ID do treino não retornado");
        return;
      }

      navigate(`/tela3/${data.train_id}`);
    } catch (error) {
      console.error("Erro ao criar treino:", error);
      setMessage("Erro ao criar treino. Verifique se o backend está rodando.");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Novo Treino</h1>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-slate-700">Epochs</label>
              <Info 
                size={16} 
                className="text-slate-400 cursor-help" 
                data-tooltip-id="epochs-tooltip"
                data-tooltip-place="right"
              />
            </div>
            <input
              type="number"
              value={epochs}
              onChange={(e) => setEpochs(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-slate-700">Learning Rate</label>
              <Info 
                size={16} 
                className="text-slate-400 cursor-help" 
                data-tooltip-id="learningrate-tooltip"
                data-tooltip-place="right"
              />
            </div>
            <input
              type="number"
              step="0.0001"
              value={learningRate}
              onChange={(e) => setLearningRate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-slate-700">Batch Size</label>
              <Info 
                size={16} 
                className="text-slate-400 cursor-help" 
                data-tooltip-id="batchsize-tooltip"
                data-tooltip-place="right"
              />
            </div>
            <input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-slate-700">Dataset (opcional)</label>
              <Info 
                size={16} 
                className="text-slate-400 cursor-help" 
                data-tooltip-id="dataset-tooltip"
                data-tooltip-place="right"
              />
            </div>
            <select
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
            >
              <option value="">MNIST (padrão)</option>
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.num_classes} classes, {ds.num_images} imagens)
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-slate-700">Arquitetura</label>
              <Info 
                size={16} 
                className="text-slate-400 cursor-help" 
                data-tooltip-id="architecture-tooltip"
                data-tooltip-place="right"
              />
            </div>
            <select
              value={architecture}
              onChange={(e) => setArchitecture(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
            >
              <option value="simple">Simples (Dense)</option>
              <option value="cnn">CNN (Recomendado para imagens)</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200"
          >
            <Play size={18} />
            Criar Treino
          </button>
        </div>

        {message && (
          <p className="mt-4 text-center text-red-600">{message}</p>
        )}
      </form>

      <Tooltip id="epochs-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que é:</p>
          <p className="mb-3">Número de vezes que o modelo vê todo o dataset durante o treinamento. Uma epoch = uma passagem completa pelos dados.</p>
          <p className="font-semibold mb-2">Impactos:</p>
          <p className="text-green-600 mb-1">✓ Mais epochs: Modelo aprende melhor, accuracy tende a aumentar</p>
          <p className="text-red-600">✗ Muitas epochs: Overfitting, tempo maior de treinamento</p>
        </div>
      </Tooltip>

      <Tooltip id="learningrate-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que é:</p>
          <p className="mb-3">Taxa de aprendizado. Controla o tamanho do passo que o modelo dá ao ajustar os pesos. Valores comuns: 0.0001 a 0.01.</p>
          <p className="font-semibold mb-2">Impactos:</p>
          <p className="text-green-600 mb-1">✓ Taxa alta: Aprendizado rápido, mas pode não convergir</p>
          <p className="text-green-600 mb-1">✓ Taxa baixa: Convergência mais estável, porém mais lenta</p>
          <p className="text-red-600 mb-1">✗ Muito alta: Divergência, modelo não aprende</p>
          <p className="text-red-600">✗ Muito baixa: Treinamento muito demorado</p>
        </div>
      </Tooltip>

      <Tooltip id="batchsize-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que é:</p>
          <p className="mb-3">Número de exemplos processados antes de atualizar os pesos do modelo. Batch size menor = mais atualizações por epoch.</p>
          <p className="font-semibold mb-2">Impactos:</p>
          <p className="text-green-600 mb-1">✓ Batch pequeno: Mais atualizações, melhor generalização, usa menos memória</p>
          <p className="text-green-600 mb-1">✓ Batch grande: Treinamento mais rápido (GPU), gradientes mais estáveis</p>
          <p className="text-red-600 mb-1">✗ Muito pequeno: Treinamento instável, ruído nos gradientes</p>
          <p className="text-red-600">✗ Muito grande: Pode generalizar mal, requer mais memória</p>
        </div>
      </Tooltip>

      <Tooltip id="dataset-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que é:</p>
          <p className="mb-3">Conjunto de dados usado para treinar o modelo. Você pode usar o MNIST (dígitos 0-9) ou fazer upload de seu próprio dataset customizado.</p>
          <p className="font-semibold mb-2">Opções:</p>
          <p className="mb-2">• <strong>MNIST:</strong> Dataset padrão com 60.000 imagens de dígitos (0-9). Ideal para testes iniciais.</p>
          <p>• <strong>Customizado:</strong> Seu próprio dataset em formato ZIP, organizado por pastas de classes.</p>
        </div>
      </Tooltip>

      <Tooltip id="architecture-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que é:</p>
          <p className="mb-3">Estrutura da rede neural. Define como as camadas são organizadas e como os dados fluem pelo modelo.</p>
          <p className="font-semibold mb-2">Arquiteturas Disponíveis:</p>
          <p className="mb-2">• <strong>Dense (Simples):</strong> Camadas totalmente conectadas. Boa para dados tabulares, mas limitada para imagens complexas.</p>
          <p className="mb-3">• <strong>CNN:</strong> Usa filtros convolucionais para capturar padrões espaciais. Ideal para imagens, muito mais eficaz para classificação visual.</p>
          <p className="font-semibold mb-2">Recomendação:</p>
          <p className="text-green-600">✓ Use CNN para imagens (melhor desempenho)</p>
          <p className="text-slate-500">• Use Dense apenas para testes rápidos ou datasets muito simples</p>
        </div>
      </Tooltip>
    </div>
  );
}