import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileArchive, Info, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Database, Loader2 } from "lucide-react";

export default function UploadDataset() {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedOption, setSelectedOption] = useState("upload");

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setMessage("Selecione um arquivo ZIP");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name || "Custom Dataset");

    // Simular progresso do upload
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 200);

    try {
      const response = await fetch("http://127.0.0.1:8000/datasets/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

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
      clearInterval(progressInterval);
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Datasets</h1>

      <div className="max-w-2xl">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-full flex items-center justify-between px-6 py-4 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors duration-200"
        >
          <div className="flex items-center gap-3">
            <Database className="text-slate-600" size={20} />
            <span className="font-medium text-slate-800">Gerenciar Datasets</span>
          </div>
          {showMenu ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
        </button>

        {showMenu && (
          <div className="mt-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => {
                setSelectedOption("upload");
                setShowMenu(false);
              }}
              className={`w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors duration-200 border-b border-slate-100 ${
                selectedOption === "upload" ? "bg-slate-50" : ""
              }`}
            >
              <Upload className="text-slate-600" size={18} />
              <span className="text-slate-700">Enviar Dataset</span>
            </button>
            <button
              onClick={() => {
                setSelectedOption("list");
                setShowMenu(false);
                navigate("/datasets");
              }}
              className={`w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors duration-200 ${
                selectedOption === "list" ? "bg-slate-50" : ""
              }`}
            >
              <Database className="text-slate-600" size={18} />
              <span className="text-slate-700">Datasets Disponíveis</span>
            </button>
          </div>
        )}
      </div>

      {selectedOption === "upload" && (
        <>
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 mt-6">
            <div className="flex items-start gap-3 mb-4">
              <Info className="text-blue-500 mt-0.5" size={20} />
              <h3 className="font-medium text-slate-800">Estrutura do ZIP</h3>
            </div>
            <p className="text-slate-600 mb-4">O ZIP deve conter pastas, onde cada pasta representa uma classe:</p>
            <pre className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 overflow-x-auto mb-4">
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
          </div>

          <form onSubmit={handleSubmit} className="max-w-2xl">
            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nome do Dataset</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                  placeholder="Ex: Meu Dataset"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Arquivo ZIP</label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setFile(e.target.files[0])}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                </div>
                {file && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <FileArchive size={16} />
                    <span>{file.name}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                {uploading ? "Enviando..." : "Upload"}
              </button>

              {uploading && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Progresso do upload</span>
                    <span className="text-sm font-medium text-slate-800">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-slate-900 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {message && (
              <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${
                message.includes("Erro") 
                  ? "bg-red-50 text-red-700 border border-red-200" 
                  : "bg-green-50 text-green-700 border border-green-200"
              }`}>
                {message.includes("Erro") ? (
                  <AlertCircle size={20} />
                ) : (
                  <CheckCircle size={20} />
                )}
                <span>{message}</span>
              </div>
            )}
          </form>
        </>
      )}
    </div>
  );
}
