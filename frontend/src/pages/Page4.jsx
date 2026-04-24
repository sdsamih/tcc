import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Page4() {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setMessage("Selecione um arquivo ZIP");
      return;
    }

    setUploading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name || "Custom Dataset");

    try {
      const response = await fetch("http://127.0.0.1:8000/datasets/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Dataset "${data.name}" criado com sucesso! ${data.num_classes} classes, ${data.num_images} imagens.`);
        setFile(null);
        setName("");
      } else {
        setMessage(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      setMessage("Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h1>Upload de Dataset</h1>

      <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f0f0f0", borderRadius: "5px" }}>
        <h3>Estrutura do ZIP:</h3>
        <p>O ZIP deve conter pastas, onde cada pasta representa uma classe:</p>
        <pre style={{ backgroundColor: "#fff", padding: "10px", borderRadius: "3px" }}>
{`dataset.zip
├── gato/
│   ├── gato1.jpg
│   ├── gato2.jpg
│   └── ...
├── cachorro/
│   ├── cachorro1.jpg
│   ├── cachorro2.jpg
│   └── ...
└── ...`}
        </pre>
        <p>As imagens serão redimensionadas automaticamente para 28x28 pixels.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px" }}>
          <label>Nome do Dataset:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ marginLeft: "10px", padding: "5px" }}
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label>Arquivo ZIP:</label>
          <input
            type="file"
            accept=".zip"
            onChange={(e) => setFile(e.target.files[0])}
            style={{ marginLeft: "10px" }}
          />
        </div>

        <button type="submit" disabled={uploading}>
          {uploading ? "Enviando..." : "Upload"}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: "15px", color: message.includes("Erro") ? "red" : "green" }}>
          {message}
        </p>
      )}
    </div>
  );
}
