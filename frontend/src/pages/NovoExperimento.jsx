import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Database, Cpu, Play, Info, ArrowRight } from "lucide-react";
import { Tooltip } from "react-tooltip";
import { apiGet, apiPost } from "../utils/api";

export default function NovoExperimento() {
  const [step, setStep] = useState(1); // 1: Criar experimento, 2: Criar primeiro treino
  const [experimentName, setExperimentName] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [architecture, setArchitecture] = useState("simple");
  const [datasets, setDatasets] = useState([]);
  const [experimentId, setExperimentId] = useState(null);
  
  // Parâmetros do treino
  const [epochs, setEpochs] = useState(10);
  const [learningRate, setLearningRate] = useState(0.001);
  const [batchSize, setBatchSize] = useState(32);
  const [earlyStopping, setEarlyStopping] = useState(false);
  const [dataAugmentation, setDataAugmentation] = useState(false);
  
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    fetchDatasets();
    // Carregar experiment_id do localStorage caso a página tenha sido recarregada
    const pendingExperimentId = localStorage.getItem('pendingExperimentId');
    if (pendingExperimentId) {
      console.log("Carregando experiment_id do localStorage:", pendingExperimentId);
      // Verificar se o experimento ainda existe no backend
      apiGet(`/experiment/${pendingExperimentId}`)
        .then(data => {
          if (data.error) {
            // Experimento não existe mais, limpar localStorage
            localStorage.removeItem('pendingExperimentId');
            setStep(1);
          } else {
            setExperimentId(pendingExperimentId);
            setStep(2);
          }
        })
        .catch(() => {
          // Erro ao verificar, limpar localStorage e começar do step 1
          localStorage.removeItem('pendingExperimentId');
          setStep(1);
        });
    }
  }, []);

  const getArchitectureName = (architecture) => {
    const architectureNames = {
      "simple": "Simples (Dense)",
      "cnn": "CNN",
      "mobilenet": "MobileNet",
      "resnet50": "ResNet50",
      "inceptionv3": "InceptionV3",
      "xception": "Xception",
      "densenet121": "DenseNet121"
    };
    return architectureNames[architecture] || architecture;
  };

  const fetchDatasets = async () => {
    try {
      const data = await apiGet("/datasets");
      setDatasets(data);
    } catch (error) {
      console.error("Erro ao buscar datasets:", error);
    }
  };

  const handleCreateExperiment = async (e) => {
    e.preventDefault();

    const payload = {
      name: experimentName,
      dataset_id: datasetId || "",
      architecture: architecture,
    };

    try {
      const data = await apiPost("/experiment", payload);

      console.log("Resposta do backend ao criar experimento:", data);

      if (!data.experiment_id) {
        setMessage("Erro: ID do experimento não retornado");
        return;
      }

      console.log("Setting experimentId to:", data.experiment_id, "Tipo:", typeof data.experiment_id);
      setExperimentId(data.experiment_id);
      localStorage.setItem('pendingExperimentId', data.experiment_id);
      console.log("Salvo no localStorage:", localStorage.getItem('pendingExperimentId'));
      setStep(2);
      setMessage("");
    } catch (error) {
      console.error("Erro ao criar experimento:", error);
      setMessage("Erro ao criar experimento. Verifique se o backend está rodando.");
    }
  };

  const handleCreateTrain = async (e) => {
    e.preventDefault();

    // Validar se experimentId existe
    if (!experimentId) {
      setMessage("Erro: ID do experimento não encontrado. Por favor, crie um novo experimento.");
      return;
    }

    console.log("Criando treino com experiment_id:", experimentId, "Tipo:", typeof experimentId);

    const payload = {
      experiment_id: String(experimentId),
      epochs: Number(epochs),
      learning_rate: Number(learningRate),
      batch_size: Number(batchSize),
      early_stopping: earlyStopping,
      data_augmentation: dataAugmentation,
    };

    console.log("Payload a ser enviado:", payload);

    try {
      const data = await apiPost(`/experiment/${experimentId}/train`, payload);

      if (!data.train_id) {
        setMessage("Erro: ID do treino não retornado");
        return;
      }

      // Limpar o localStorage após o treino ser criado com sucesso
      localStorage.removeItem('pendingExperimentId');
      navigate(`/experimento/${experimentId}`);
    } catch (error) {
      console.error("Erro ao criar treino:", error);
      setMessage("Erro ao criar treino. Verifique se o backend está rodando.");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">
        {step === 1 ? "Novo Experimento" : "Primeiro Treino"}
      </h1>

      {step === 1 ? (
        <form onSubmit={handleCreateExperiment} className="max-w-2xl">
          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-slate-700">Nome do Experimento</label>
                <Info 
                  size={16} 
                  className="text-slate-400 cursor-help" 
                  data-tooltip-id="name-tooltip"
                  data-tooltip-place="right"
                />
              </div>
              <input
                type="text"
                value={experimentName}
                onChange={(e) => setExperimentName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                placeholder="Ex: Experimento CNN MNIST"
                required
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
                <option value="mobilenet">MobileNet (Transfer Learning)</option>
                <option value="resnet50">ResNet50 (Transfer Learning)</option>
                <option value="inceptionv3">InceptionV3 (Transfer Learning)</option>
                <option value="xception">Xception (Transfer Learning)</option>
                <option value="densenet121">DenseNet121 (Transfer Learning)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200"
            >
              <Play size={18} />
              Criar Experimento
            </button>
          </div>

          {message && (
            <p className="mt-4 text-center text-red-600">{message}</p>
          )}
        </form>
      ) : (
        <form onSubmit={handleCreateTrain} className="max-w-2xl">
          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
            <div className="bg-slate-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-600">
                <strong>Experimento:</strong> {experimentName}<br/>
                <strong>Arquitetura:</strong> {getArchitectureName(architecture)}<br/>
                <strong>Dataset:</strong> {datasetId ? datasets.find(d => d.id === datasetId)?.name : "MNIST (padrão)"}
              </p>
            </div>

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
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={earlyStopping}
                  onChange={(e) => setEarlyStopping(e.target.checked)}
                  className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-500"
                />
                <span className="text-sm font-medium text-slate-700">Early Stopping</span>
                <Info 
                  size={16} 
                  className="text-slate-400 cursor-help" 
                  data-tooltip-id="earlystopping-tooltip"
                  data-tooltip-place="right"
                />
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-6">Para automaticamente quando a validação não melhora</p>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dataAugmentation}
                  onChange={(e) => setDataAugmentation(e.target.checked)}
                  className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-500"
                />
                <span className="text-sm font-medium text-slate-700">Data Augmentation</span>
                <Info 
                  size={16} 
                  className="text-slate-400 cursor-help" 
                  data-tooltip-id="dataaugmentation-tooltip"
                  data-tooltip-place="right"
                />
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-6">Aumenta diversidade do dataset com transformações artificiais</p>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200"
            >
              <Play size={18} />
              Iniciar Primeiro Treino
            </button>
          </div>

          {message && (
            <p className="mt-4 text-center text-red-600">{message}</p>
          )}
        </form>
      )}

      <Tooltip id="name-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que é:</p>
          <p className="mb-3">Um nome para identificar seu experimento. Você pode criar vários treinos com diferentes parâmetros dentro do mesmo experimento.</p>
        </div>
      </Tooltip>

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

      <Tooltip id="dataaugmentation-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que é:</p>
          <p className="mb-3">Aumenta artificialmente a diversidade do dataset aplicando transformações nas imagens de treino.</p>
          <p className="font-semibold mb-2">Operações aplicadas:</p>
          <p className="mb-2"><strong>Modelos de Transfer Learning (224x224):</strong></p>
          <ul className="list-disc pl-5 mb-3">
            <li>RandomResizedCrop: Crop aleatório com resize (escala 0.8-1.0)</li>
            <li>RandomHorizontalFlip: Espelhamento horizontal (50% probabilidade)</li>
            <li>RandomRotation: Rotação aleatória (±15 graus)</li>
            <li>ColorJitter: Variação de brilho, contraste e saturação (±20%)</li>
          </ul>
          <p className="mb-2"><strong>Modelos Simples (28x28):</strong></p>
          <ul className="list-disc pl-5 mb-3">
            <li>RandomHorizontalFlip: Espelhamento horizontal (50% probabilidade)</li>
            <li>RandomRotation: Rotação aleatória (±10 graus)</li>
          </ul>
          <p className="font-semibold mb-2">Importante:</p>
          <p className="mb-3">Data augmentation é aplicado apenas no conjunto de treino. Teste e validação não recebem essas transformações.</p>
        </div>
      </Tooltip>

      <Tooltip id="earlystopping-tooltip">
        <div className="text-sm">
          <p className="font-semibold mb-2">O que é:</p>
          <p className="mb-3">Para automaticamente o treinamento quando a loss de validação não melhora por várias épocas consecutivas.</p>
          <p className="font-semibold mb-2">Benefícios:</p>
          <p className="text-green-600 mb-1">✓ Evita overfitting para no momento ideal</p>
          <p className="text-green-600 mb-1">✓ Economiza tempo de treinamento</p>
          <p className="text-green-600">✓ Previne treinamento excessivo</p>
        </div>
      </Tooltip>
    </div>
  );
}