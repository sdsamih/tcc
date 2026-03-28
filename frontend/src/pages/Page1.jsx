import { useEffect, useState } from "react";
import { Link } from "react-router-dom";


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

  return (
    <div>
      <h1>Lista de Treinos</h1>

      {trains.length === 0 ? (
        <p>Nenhum treino encontrado</p>
      ) : (
        <ul>
          {trains.map((train) => (
            <li key={train.id}>
              ID: {train.id} | Status: {train.status} | Progresso: {train.progress}%

              <Link to={`/tela3/${train.id}`}>
                <button>Ver detalhes</button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}