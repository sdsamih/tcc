import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function Page3() {
  const { id } = useParams();
  const [train, setTrain] = useState(null);

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
        </>
      )}

      <h2>Parâmetros</h2>
      <p>Epochs: {train.params.epochs}</p>
      <p>Learning Rate: {train.params.learning_rate}</p>
      <p>Batch Size: {train.params.batch_size}</p>
    </div>
  );
}