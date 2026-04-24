import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";


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
      dataset_id: datasetId || null,
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

      const data = await response.json();

      navigate(`/tela3/${data.train_id}`);
    } catch (error) {
      console.error("Erro ao criar treino:", error);
      setMessage("Erro ao criar treino");
    }
  };

  return (
    <div>
      <h1>Criar Treino</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Epochs:</label>
          <input
            type="number"
            value={epochs}
            onChange={(e) => setEpochs(e.target.value)}
          />
        </div>

        <div>
          <label>Learning Rate:</label>
          <input
            type="number"
            step="0.0001"
            value={learningRate}
            onChange={(e) => setLearningRate(e.target.value)}
          />
        </div>

        <div>
          <label>Batch Size:</label>
          <input
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(e.target.value)}
          />
        </div>

        <div>
          <label>Dataset (opcional):</label>
          <select
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            style={{ marginLeft: "10px" }}
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
          <label>Arquitetura:</label>
          <select
            value={architecture}
            onChange={(e) => setArchitecture(e.target.value)}
            style={{ marginLeft: "10px" }}
          >
            <option value="simple">Simples (Dense)</option>
            <option value="cnn">CNN (Recomendado para imagens)</option>
          </select>
        </div>

        <button type="submit">Criar Treino</button>
      </form>

      <p>{message}</p>
    </div>
  );
}