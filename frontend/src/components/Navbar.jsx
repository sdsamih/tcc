import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav style={{
      display: "flex",
      gap: "20px",
      padding: "16px",
      borderBottom: "1px solid #ccc"
    }}>
      <Link to="/">Histórico</Link>
      <Link to="/novo-treino">Criar Treino</Link>
      <Link to="/upload-dataset">Upload Dataset</Link>
    </nav>
  );
}