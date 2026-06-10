# TCC - Sistema de Treinamento de Modelos de Machine Learning

Sistema completo para treinamento e inferência de modelos de classificação de imagens com interface web.

## 📋 Visão Geral

O projeto consiste em uma aplicação full-stack para treinamento de modelos de machine learning, permitindo:
- Treinar modelos com datasets customizados ou MNIST
- Escolher entre arquiteturas simples (Dense) ou CNN
- Acompanhar progresso do treinamento em tempo real
- Fazer predições com modelos treinados
- Baixar modelos treinados

## 🏗️ Arquitetura

### Backend (Python/FastAPI)
- **Framework**: FastAPI
- **ML**: PyTorch
- **Banco de Dados**: SQLite
- **Gerenciador de Pacotes**: UV

### Frontend (React/Vite)
- **Framework**: React 19
- **Build Tool**: Vite
- **Roteamento**: React Router DOM

## 📁 Estrutura do Projeto

```
tcc/
├── backend/
│   ├── src/
│   │   ├── main.py          # API FastAPI com endpoints
│   │   ├── database.py      # Configuração do SQLite
│   │   └── models.py        # Modelos SQLAlchemy (Train, Dataset)
│   ├── datasets/            # Datasets customizados
│   ├── models/              # Modelos treinados (.pt)
│   ├── trains.db            # Banco de dados SQLite
│   └── pyproject.toml       # Dependências Python
└── frontend/
    ├── src/
    │   ├── components/      # Componentes React
    │   ├── pages/           # Páginas da aplicação
    │   └── main.jsx         # Entry point
    └── package.json         # Dependências Node.js
```

## 🔧 Funcionalidades Implementadas

### Backend

#### Endpoints de Treinamento
- **POST /train**: Inicia um novo treinamento
  - Parâmetros: epochs, learning_rate, batch_size, dataset_id (opcional), architecture
  - Arquiteturas: "simple" (Dense) ou "cnn"
  - Executa em background
  
- **GET /train**: Lista todos os treinamentos
- **GET /train/{train_id}**: Obtém detalhes de um treinamento específico
- **GET /train/{train_id}/download**: Baixa o modelo treinado (.pt)
- **POST /train/{train_id}/predict**: Faz predição com imagem enviada

#### Endpoints de Datasets
- **POST /datasets/upload**: Faz upload de dataset customizado (ZIP)
  - Estrutura esperada: ZIP com pastas por classe
  - Imagens são redimensionadas para 28x28 grayscale
  - Divide 80% treino / 20% teste automaticamente
  
- **GET /datasets**: Lista todos os datasets disponíveis

#### Modelos de Dados
- **Train**: ID, epochs, learning_rate, batch_size, dataset_id, architecture, status, progress, accuracy, loss, model_path, class_names
- **Dataset**: ID, name, path, classes, num_classes, input_shape, num_images

#### Arquiteturas de Modelos
- **Simple**: Dense layers (Flatten → Dense(128) → Dense(num_classes))
- **CNN**: Conv2D → MaxPooling → Conv2D → MaxPooling → Flatten → Dense(128) → Dense(num_classes)

### Frontend
- Interface React com navegação entre páginas
- Componentes para interação com a API
- Páginas organizadas por funcionalidade

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- Python 3.12+
- Node.js 18+
- UV (gerenciador de pacotes Python)

### Backend

1. **Navegue para a pasta do backend:**
```bash
cd /home/samih/Documentos/projetos/tcc-backend/tcc/backend
```

2. **Instale as dependências (se ainda não instalou):**
```bash
uv sync
```

3. **Ative o ambiente virtual:**
```bash
source .venv/bin/activate
```

4. **Inicie o servidor:**
```bash
uvicorn src.main:app --reload
```

O backend estará rodando em `http://localhost:8000`

### Frontend

1. **Navegue para a pasta do frontend (em outro terminal):**
```bash
cd /home/samih/Documentos/projetos/tcc-backend/tcc/frontend
```

2. **Instale as dependências (se ainda não instalou):**
```bash
npm install
```

3. **Inicie o servidor de desenvolvimento:**
```bash
npm run dev
```

O frontend estará rodando em `http://localhost:5173`

## 📖 Uso

### Treinar com MNIST (Dataset Padrão)
```bash
curl -X POST http://localhost:8000/train \
  -H "Content-Type: application/json" \
  -d '{
    "epochs": 10,
    "learning_rate": 0.001,
    "batch_size": 32,
    "architecture": "cnn"
  }'
```

### Upload de Dataset Customizado
1. Prepare um ZIP com a estrutura:
```
dataset.zip
├── classe1/
│   ├── imagem1.png
│   ├── imagem2.jpg
│   └── ...
├── classe2/
│   ├── imagem1.png
│   └── ...
└── ...
```

2. Faça o upload:
```bash
curl -X POST http://localhost:8000/datasets/upload \
  -F "file=@dataset.zip" \
  -F "name=Meu Dataset"
```

3. Use o dataset_id retornado para treinar:
```bash
curl -X POST http://localhost:8000/train \
  -H "Content-Type: application/json" \
  -d '{
    "epochs": 10,
    "learning_rate": 0.001,
    "batch_size": 32,
    "dataset_id": "uuid-do-dataset",
    "architecture": "cnn"
  }'
```

### Fazer Predição
```bash
curl -X POST http://localhost:8000/train/{train_id}/predict \
  -F "file=@imagem.png"
```

## 🗄️ Banco de Dados

O SQLite (`trains.db`) é criado automaticamente na primeira execução. Ele armazena:
- Metadados de treinamentos
- Informações de datasets
- Status e progresso de treinamentos

## 📦 Arquivos Gerados

- **models/**: Arquivos .keras dos modelos treinados
- **datasets/**: Datasets customizados processados (imagens 28x28)
- **trains.db**: Banco de dados SQLite

## 🔗 API Documentation

Após iniciar o backend, acesse:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 🛠️ Tecnologias

- **Backend**: FastAPI, PyTorch, SQLAlchemy, SQLite
- **Frontend**: React, Vite, React Router
- **ML**: CNN, Dense Networks, MNIST, Custom Datasets
- **Image Processing**: PIL, NumPy
