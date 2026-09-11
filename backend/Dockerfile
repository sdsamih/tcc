FROM python:3.12-slim

WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copiar arquivo de dependências
COPY pyproject.toml uv.lock ./

# Instalar uv e as dependências
RUN pip install uv && \
    uv sync --frozen

# Copiar código do backend
COPY src/ ./src/

# Criar diretório para modelos
RUN mkdir -p models

# Expor porta
EXPOSE 8000

# Comando para rodar a aplicação
CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
