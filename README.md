# TCC - Sistema de Treinamento de Modelos de Machine Learning

Sistema completo para treinamento e inferência de modelos de classificação de imagens com interface web.

## 📋 Visão Geral

O projeto consiste em uma aplicação full-stack para treinamento de modelos de machine learning, permitindo:
- Criar experimentos de treinamento
- Treinar modelos com datasets customizados ou MNIST
- Escolher entre múltiplas arquiteturas (Simple, CNN, MobileNet, ResNet50, InceptionV3, DenseNet121, EfficientNet-B0)
- Acompanhar progresso do treinamento em tempo real
- Visualizar métricas detalhadas (accuracy, precision, recall, f1-score, matriz de confusão)
- Fazer predições com modelos treinados
- Baixar modelos treinados
- Suporte a early stopping

## 🏗️ Arquitetura

### Backend (Python/FastAPI)
- **Framework**: FastAPI
- **ML**: PyTorch, torchvision, scikit-learn
- **Banco de Dados**: SQLite (SQLAlchemy)
- **Gerenciador de Pacotes**: UV

### Frontend (React/Vite)
- **Framework**: React
- **Build Tool**: Vite
- **Roteamento**: React Router DOM
- **UI**: TailwindCSS, Lucide Icons

## 📁 Estrutura do Projeto

```
tcc/
├── backend/
│   ├── src/
│   │   ├── main.py          # API FastAPI com endpoints
│   │   ├── database.py      # Configuração do SQLite
│   │   └── models.py        # Modelos SQLAlchemy (Train, Dataset, Experiment)
│   ├── datasets/            # Datasets customizados
│   ├── models/              # Modelos treinados (.pt)
│   └── pyproject.toml       # Dependências Python
└── frontend/
    ├── src/
    │   ├── components/      # Componentes React (Navbar, Sidebar)
    │   ├── pages/           # Páginas da aplicação
    │   │   ├── DetalhesExperimento.jsx
    │   │   ├── HistoricoExperimentos.jsx
    │   │   ├── ListaDatasets.jsx
    │   │   ├── NovoExperimento.jsx
    │   │   └── UploadDataset.jsx
    │   ├── main.jsx         # Entry point
    │   └── App.jsx          # Componente principal
    └── package.json         # Dependências Node.js
```

## 🔧 Funcionalidades Implementadas

### Backend

#### Endpoints de Experimentos
- **POST /experiment**: Cria um novo experimento
- **GET /experiment**: Lista todos os experimentos
- **GET /experiment/{experiment_id}**: Obtém detalhes de um experimento específico
- **PUT /experiment/{experiment_id}**: Atualiza nome do experimento
- **DELETE /experiment/{experiment_id}**: Deleta um experimento
- **POST /experiment/{experiment_id}/train**: Inicia um novo treinamento no experimento
- **GET /experiment/{experiment_id}/trains**: Lista treinamentos do experimento

#### Endpoints de Treinamento
- **GET /train**: Lista todos os treinamentos
- **GET /train/{train_id}**: Obtém detalhes de um treinamento específico
- **DELETE /train/{train_id}**: Deleta um treinamento
- **GET /train/{train_id}/download**: Baixa o modelo treinado (.pt)
- **POST /train/{train_id}/predict**: Faz predição com imagem enviada

#### Endpoints de Datasets
- **POST /datasets/upload**: Faz upload de dataset customizado (ZIP)
  - Estrutura esperada: ZIP com pastas por classe
  - Imagens são convertidas para RGB
  - Divide 80% treino / 10% validação / 10% teste automaticamente
  
- **GET /datasets**: Lista todos os datasets disponíveis
- **PUT /datasets/{dataset_id}**: Atualiza nome do dataset
- **DELETE /datasets/{dataset_id}**: Deleta um dataset

#### Modelos de Dados
- **Experiment**: ID, name, dataset_id, architecture, created_at
- **Train**: ID, experiment_id, epochs, learning_rate, batch_size, early_stopping, status, progress, accuracy, loss, model_path, class_names, precision, recall, f1_score, confusion_matrix
- **Dataset**: ID, name, path, classes, num_classes, input_shape, num_images

#### Arquiteturas de Modelos
- **Simple**: Dense layers (Flatten → Dense(128) → Dense(num_classes)) - imagens 28x28
- **CNN**: Conv2D → MaxPooling → Conv2D → MaxPooling → Flatten → Dense(128) → Dense(num_classes) - imagens 28x28
- **MobileNetV2**: Transfer learning com ImageNet - imagens 224x224
- **ResNet50**: Transfer learning com ImageNet - imagens 224x224
- **InceptionV3**: Transfer learning com ImageNet - imagens 224x224
- **Xception**: EfficientNet-B0 (substituto) com transfer learning ImageNet - imagens 224x224
  - Nota: O sistema exibe "Xception" mas usa EfficientNet-B0 internamente
- **DenseNet121**: Transfer learning com ImageNet - imagens 224x224

### Frontend
- Interface React com navegação entre páginas
- Páginas:
  - **Novo Experimento**: Criar novos experimentos de treinamento
  - **Histórico de Experimentos**: Visualizar todos os experimentos
  - **Detalhes do Experimento**: Ver detalhes, treinar, testar predições
  - **Lista de Datasets**: Gerenciar datasets customizados
  - **Upload de Dataset**: Fazer upload de novos datasets
- Visualização de métricas em tempo real
- Tabelas de métricas por classe (precision, recall, f1-score)
- Matriz de confusão interativa

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- Python 3.12+
- Node.js 18+
- UV (gerenciador de pacotes Python)

### Backend

1. **Navegue para a pasta do backend:**
```bash
cd backend
```

2. **Instale as dependências (se ainda não instalou):**
```bash
uv sync
```

3. **Ative o ambiente virtual:**
```bash
# Linux/Mac
source .venv/bin/activate
# Windows
.venv\Scripts\activate
```

4. **Inicie o servidor:**
```bash
uvicorn src.main:app --reload
```

O backend estará rodando em `http://localhost:8000`

### Frontend

1. **Navegue para a pasta do frontend (em outro terminal):**
```bash
cd frontend
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

### Interface Web

1. Acesse `http://localhost:5173` no navegador
2. Crie um novo experimento em "Novo Experimento"
3. Escolha:
   - Dataset customizado (faça upload primeiro em "Upload de Dataset")
   - Ou use MNIST (dataset padrão, sem necessidade de upload)
4. Selecione a arquitetura desejada
5. Configure parâmetros de treinamento (epochs, learning rate, batch size)
6. Inicie o treinamento e acompanhe o progresso
7. Após conclusão, visualize métricas detalhadas e faça predições

### Upload de Dataset Customizado

Prepare um ZIP com a estrutura:
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

Use a página "Upload de Dataset" na interface para fazer o upload.

## ️ Banco de Dados

O SQLite é criado automaticamente na primeira execução. Ele armazena:
- Metadados de experimentos
- Informações de datasets
- Detalhes de treinamentos (parâmetros, métricas, status)

## 📦 Arquivos Gerados

- **models/**: Arquivos .pt dos modelos treinados (PyTorch)
- **datasets/**: Datasets customizados processados
- Banco de dados SQLite

## 🔗 API Documentation

Após iniciar o backend, acesse:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 🛠️ Tecnologias

- **Backend**: FastAPI, PyTorch, torchvision, scikit-learn, SQLAlchemy, SQLite
- **Frontend**: React, Vite, React Router, TailwindCSS, Lucide Icons
- **ML**: CNN, Dense Networks, Transfer Learning (MobileNet, ResNet, Inception, DenseNet, EfficientNet)
- **Image Processing**: PIL, NumPy

## 📊 Métricas Calculadas

- **Accuracy**: Porcentagem de predições corretas
- **Precision**: Por classe (TP / (TP + FP))
- **Recall**: Por classe (TP / (TP + FN))
- **F1-Score**: Por classe (2 * (precision * recall) / (precision + recall))
- **Confusion Matrix**: Matriz completa de predições vs verdadeiros
- **Loss**: Erro do modelo no conjunto de teste
