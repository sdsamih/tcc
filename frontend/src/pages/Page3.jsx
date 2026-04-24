import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function Page3() {
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
    return <p>Carregando...</p>;
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

  return (
    <div>
      <h1>Detalhes do Treino</h1>

      <p><strong>ID:</strong> {train.id}</p>
      <p><strong>Status:</strong> {train.status}</p>
      <p><strong>Progresso:</strong> {train.progress}%</p>

      {train.status === "ready" && (
        <>
          <p><strong>Accuracy:</strong> {train.accuracy?.toFixed(4)}</p>
          <p><strong>Loss:</strong> {train.loss?.toFixed(4)}</p>
          <button onClick={handleDownload}>Baixar Modelo</button>

          {train.class_names && (
            <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#f0f0f0", borderRadius: "5px" }}>
              <h3>Classes:</h3>
              <ul>
                {train.class_names.map((className, idx) => (
                  <li key={idx}>{idx}: {className}</li>
                ))}
              </ul>
            </div>
          )}

          <h2>Testar Inferência</h2>
          <div>
            <input type="file" onChange={handleFileChange} accept="image/*" />
            <button onClick={handlePredict} disabled={!selectedFile}>
              Prever
            </button>
          </div>

          {previewUrl && (
            <div>
              <h3>Imagem:</h3>
              <img src={previewUrl} alt="Preview" style={{ maxWidth: "200px" }} />
            </div>
          )}

          {prediction && (
            <div>
              <h3>Resultado:</h3>
              <p><strong>Classe:</strong> {getClassName(prediction.predicted_class)}</p>
              <p><strong>Confiança:</strong> {(prediction.confidence * 100).toFixed(2)}%</p>
            </div>
          )}
        </>
      )}

      <h2>Parâmetros</h2>
      <p>Epochs: {train.params.epochs}</p>
      <p>Learning Rate: {train.params.learning_rate}</p>
      <p>Batch Size: {train.params.batch_size}</p>
    </div>
  );
}