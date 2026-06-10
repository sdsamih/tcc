from fastapi import FastAPI, BackgroundTasks, UploadFile, File
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import time
import uuid
import os
import zipfile
import shutil
from PIL import Image
import numpy as np

from src.database import engine
from src.models import Base
from src.database import SessionLocal

from src.models import Train, Dataset, Experiment

import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms

app = FastAPI()

# Configurar logging para não mostrar logs de acesso do Uvicorn
import logging
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

trains = {}

#modelo de dados para parametros de um treinamento
class TrainParams(BaseModel):
    epochs: int
    learning_rate: float
    batch_size: int
    experiment_id: str  # Agora obrigatório
    architecture: str = "simple"  # "simple" ou "cnn"

#modelo de dados para criar um experimento
class ExperimentParams(BaseModel):
    name: str
    dataset_id: str | None = None
    architecture: str = "simple"

def real_training(train_id: str):
    db = SessionLocal()

    train = db.query(Train).filter(Train.id == train_id).first()
    
    # Buscar experimento associado ao treino
    experiment = db.query(Experiment).filter(Experiment.id == train.experiment_id).first()

    # Carregar dataset
    if experiment.dataset_id:
        dataset = db.query(Dataset).filter(Dataset.id == experiment.dataset_id).first()
        
        # Carregar imagens do dataset customizado
        x_train = []
        y_train = []
        x_test = []
        y_test = []
        
        for class_idx, class_name in enumerate(dataset.classes):
            class_path = os.path.join(dataset.path, class_name)
            images = os.listdir(class_path)
            
            # 80% treino, 20% teste
            split_idx = int(len(images) * 0.8)
            
            for i, img_file in enumerate(images):
                img_path = os.path.join(class_path, img_file)
                img = Image.open(img_path)
                img_array = np.array(img) / 255.0
                
                if i < split_idx:
                    x_train.append(img_array)
                    y_train.append(class_idx)
                else:
                    x_test.append(img_array)
                    y_test.append(class_idx)
        
        x_train = np.array(x_train)
        y_train = np.array(y_train)
        x_test = np.array(x_test)
        y_test = np.array(y_test)

        # Verificações de diagnóstico
        print(f"Dataset: {dataset.name}")
        print(f"Classes: {dataset.classes}")
        print(f"x_train shape: {x_train.shape}, y_train shape: {y_train.shape}")
        print(f"x_test shape: {x_test.shape}, y_test shape: {y_test.shape}")
        print(f"Distribuição de classes no treino: {np.bincount(y_train)}")
        print(f"Distribuição de classes no teste: {np.bincount(y_test)}")
        print(f"x_train range: [{x_train.min():.4f}, {x_train.max():.4f}]")

        num_classes = dataset.num_classes
        class_names = dataset.classes
    else:
        # carregar MNIST
        mnist_train = datasets.MNIST(root='./mnist_data', train=True, download=True, transform=transforms.ToTensor())
        mnist_test = datasets.MNIST(root='./mnist_data', train=False, download=True, transform=transforms.ToTensor())
        
        x_train = mnist_train.data.numpy() / 255.0
        y_train = mnist_train.targets.numpy()
        x_test = mnist_test.data.numpy() / 255.0
        y_test = mnist_test.targets.numpy()
        
        num_classes = 10
        class_names = [str(i) for i in range(10)]

        print(f"MNIST dataset carregado")
        print(f"x_train shape: {x_train.shape}, y_train shape: {y_train.shape}")
        print(f"Distribuição de classes no treino: {np.bincount(y_train)}")
        print(f"Distribuição de classes no teste: {np.bincount(y_test)}")

    # Definir classes de modelo PyTorch
    class SimpleModel(nn.Module):
        def __init__(self, num_classes):
            super(SimpleModel, self).__init__()
            self.flatten = nn.Flatten()
            self.fc1 = nn.Linear(28 * 28, 128)
            self.fc2 = nn.Linear(128, num_classes)
            self.relu = nn.ReLU()
        
        def forward(self, x):
            x = self.flatten(x)
            x = self.relu(self.fc1(x))
            x = self.fc2(x)
            return x
    
    class CNNModel(nn.Module):
        def __init__(self, num_classes):
            super(CNNModel, self).__init__()
            self.conv1 = nn.Conv2d(1, 32, kernel_size=3)
            self.pool = nn.MaxPool2d(2, 2)
            self.conv2 = nn.Conv2d(32, 64, kernel_size=3)
            self.flatten = nn.Flatten()
            self.fc1 = nn.Linear(64 * 5 * 5, 128)
            self.fc2 = nn.Linear(128, num_classes)
            self.relu = nn.ReLU()
        
        def forward(self, x):
            x = self.pool(self.relu(self.conv1(x)))
            x = self.pool(self.relu(self.conv2(x)))
            x = self.flatten(x)
            x = self.relu(self.fc1(x))
            x = self.fc2(x)
            return x
    
    # Criar modelo baseado na arquitetura
    if experiment.architecture == "cnn":
        model = CNNModel(num_classes)
    else:
        model = SimpleModel(num_classes)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=train.learning_rate)

    # Converter dados para tensores PyTorch
    x_train_tensor = torch.FloatTensor(x_train).unsqueeze(1)  # Adicionar canal
    y_train_tensor = torch.LongTensor(y_train)
    x_test_tensor = torch.FloatTensor(x_test).unsqueeze(1)
    y_test_tensor = torch.LongTensor(y_test)
    
    # Criar DataLoader
    train_dataset = torch.utils.data.TensorDataset(x_train_tensor, y_train_tensor)
    train_loader = torch.utils.data.DataLoader(train_dataset, batch_size=train.batch_size, shuffle=True)

    # Loop de treinamento
    for epoch in range(train.epochs):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        
        for batch_idx, (inputs, labels) in enumerate(train_loader):
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
        
        # Validação
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0
        
        with torch.no_grad():
            # Usar parte dos dados para validação (10%)
            val_size = int(len(x_test_tensor) * 0.1)
            val_inputs = x_test_tensor[:val_size]
            val_labels = y_test_tensor[:val_size]
            
            outputs = model(val_inputs)
            val_loss = criterion(outputs, val_labels).item()
            _, predicted = torch.max(outputs.data, 1)
            val_total = val_labels.size(0)
            val_correct = (predicted == val_labels).sum().item()
        
        # Atualizar progresso
        train.progress = int(((epoch + 1) / train.epochs) * 100)
        train_accuracy = correct / total
        val_accuracy = val_correct / val_total
        
        print(f"Epoch {epoch + 1}/{train.epochs} - loss: {running_loss/len(train_loader):.4f} - accuracy: {train_accuracy:.4f} - val_loss: {val_loss:.4f} - val_accuracy: {val_accuracy:.4f}")
        db.commit()
    
    # Avaliação final
    model.eval()
    with torch.no_grad():
        outputs = model(x_test_tensor)
        loss = criterion(outputs, y_test_tensor).item()
        _, predicted = torch.max(outputs.data, 1)
        accuracy = (predicted == y_test_tensor).sum().item() / len(y_test_tensor)

    # salvar modelo
    models_dir = "models"
    if not os.path.exists(models_dir):
        os.makedirs(models_dir)
    
    model_path = os.path.join(models_dir, f"{train_id}.pt")
    torch.save({
        'model_state_dict': model.state_dict(),
        'num_classes': num_classes,
        'architecture': experiment.architecture
    }, model_path)

    train.status = "ready"
    train.progress = 100
    train.accuracy = float(accuracy)
    train.loss = float(loss)
    train.model_path = model_path
    train.class_names = class_names

    db.commit()
    db.close()

@app.post("/experiment")
def create_experiment(params: ExperimentParams):
    db = SessionLocal()
    
    experiment_id = str(uuid.uuid4())
    created_at = time.strftime("%Y-%m-%d %H:%M:%S")
    
    # Converter string vazia para None
    dataset_id_to_use = params.dataset_id if params.dataset_id else None
    
    new_experiment = Experiment(
        id=experiment_id,
        name=params.name,
        dataset_id=dataset_id_to_use,
        architecture=params.architecture,
        created_at=created_at
    )
    
    db.add(new_experiment)
    db.commit()
    db.close()
    
    return {"experiment_id": experiment_id}

@app.get("/experiment")
def list_experiments():
    db = SessionLocal()
    experiments = db.query(Experiment).all()
    
    result = []
    for exp in experiments:
        # Contar quantos treinos tem neste experimento
        train_count = db.query(Train).filter(Train.experiment_id == exp.id).count()
        
        result.append({
            "id": exp.id,
            "name": exp.name,
            "dataset_id": exp.dataset_id,
            "architecture": exp.architecture,
            "created_at": exp.created_at,
            "train_count": train_count
        })
    
    db.close()
    return result

@app.get("/experiment/{experiment_id}")
def get_experiment(experiment_id: str):
    db = SessionLocal()
    
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    
    if not exp:
        db.close()
        return {"error": "not found"}
    
    # Buscar todos os treinos deste experimento
    trains = db.query(Train).filter(Train.experiment_id == experiment_id).all()
    
    trains_result = []
    for t in trains:
        trains_result.append({
            "id": t.id,
            "status": t.status,
            "progress": t.progress,
            "params": {
                "epochs": t.epochs,
                "learning_rate": t.learning_rate,
                "batch_size": t.batch_size
            },
            "accuracy": t.accuracy,
            "loss": t.loss,
            "model_path": t.model_path,
            "class_names": t.class_names
        })
    
    db.close()
    
    return {
        "id": exp.id,
        "name": exp.name,
        "dataset_id": exp.dataset_id,
        "architecture": exp.architecture,
        "created_at": exp.created_at,
        "trains": trains_result
    }

@app.get("/experiment/{experiment_id}/trains")
def list_experiment_trains(experiment_id: str):
    db = SessionLocal()
    
    trains = db.query(Train).filter(Train.experiment_id == experiment_id).all()
    
    result = []
    for t in trains:
        result.append({
            "id": t.id,
            "status": t.status,
            "progress": t.progress,
            "params": {
                "epochs": t.epochs,
                "learning_rate": t.learning_rate,
                "batch_size": t.batch_size
            },
            "accuracy": t.accuracy,
            "loss": t.loss,
            "model_path": t.model_path,
            "class_names": t.class_names
        })
    
    db.close()
    return result

@app.post("/experiment/{experiment_id}/train")
def create_train_in_experiment(experiment_id: str, params: TrainParams, background_tasks: BackgroundTasks):
    db = SessionLocal()
    
    # Verificar se o experimento existe
    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        db.close()
        return {"error": "experiment not found"}
    
    train_id = str(uuid.uuid4())
    
    new_train = Train(
        id=train_id,
        experiment_id=experiment_id,
        epochs=params.epochs,
        learning_rate=params.learning_rate,
        batch_size=params.batch_size,
        status="training",
        progress=0
    )
    
    db.add(new_train)
    db.commit()
    
    background_tasks.add_task(real_training, train_id)
    
    db.close()
    
    return {"train_id": train_id}

@app.get("/train")
def list_trains():
    db = SessionLocal()
    trains = db.query(Train).all()

    result = []
    for t in trains:
        result.append({
            "id": t.id,
            "status": t.status,
            "progress": t.progress,
            "params": {
                "epochs": t.epochs,
                "learning_rate": t.learning_rate,
                "batch_size": t.batch_size
            },
            "accuracy": t.accuracy,
            "loss": t.loss,
            "model_path": t.model_path,
            "class_names": t.class_names,
            "experiment_id": t.experiment_id
        })

    db.close()
    return result

@app.get("/train/{train_id}")
def get_train(train_id: str):
    db = SessionLocal()

    t = db.query(Train).filter(Train.id == train_id).first()

    db.close()

    if not t:
        return {"error": "not found"}

    return {
        "id": t.id,
        "status": t.status,
        "progress": t.progress,
        "params": {
            "epochs": t.epochs,
            "learning_rate": t.learning_rate,
            "batch_size": t.batch_size
        },
        "accuracy": t.accuracy,
        "loss": t.loss,
        "model_path": t.model_path,
        "class_names": t.class_names,
        "experiment_id": t.experiment_id
    }

@app.get("/train/{train_id}/download")
def download_model(train_id: str):
    db = SessionLocal()
    t = db.query(Train).filter(Train.id == train_id).first()
    db.close()

    if not t or not t.model_path:
        return {"error": "model not found or not ready"}

    if not os.path.exists(t.model_path):
        return {"error": "model file not found"}

    return FileResponse(
        t.model_path,
        media_type="application/octet-stream",
        filename=f"{train_id}.pt"
    )

@app.post("/train/{train_id}/predict")
async def predict(train_id: str, file: UploadFile = File(...)):
    db = SessionLocal()
    t = db.query(Train).filter(Train.id == train_id).first()
    db.close()

    if not t or not t.model_path:
        return {"error": "model not found or not ready"}

    if not os.path.exists(t.model_path):
        return {"error": "model file not found"}

    # carregar modelo
    checkpoint = torch.load(t.model_path, map_location='cpu')
    
    # Recriar modelo baseado na arquitetura salva
    num_classes = checkpoint['num_classes']
    architecture = checkpoint['architecture']
    
    class SimpleModel(nn.Module):
        def __init__(self, num_classes):
            super(SimpleModel, self).__init__()
            self.flatten = nn.Flatten()
            self.fc1 = nn.Linear(28 * 28, 128)
            self.fc2 = nn.Linear(128, num_classes)
            self.relu = nn.ReLU()
        
        def forward(self, x):
            x = self.flatten(x)
            x = self.relu(self.fc1(x))
            x = self.fc2(x)
            return x
    
    class CNNModel(nn.Module):
        def __init__(self, num_classes):
            super(CNNModel, self).__init__()
            self.conv1 = nn.Conv2d(1, 32, kernel_size=3)
            self.pool = nn.MaxPool2d(2, 2)
            self.conv2 = nn.Conv2d(32, 64, kernel_size=3)
            self.flatten = nn.Flatten()
            self.fc1 = nn.Linear(64 * 5 * 5, 128)
            self.fc2 = nn.Linear(128, num_classes)
            self.relu = nn.ReLU()
        
        def forward(self, x):
            x = self.pool(self.relu(self.conv1(x)))
            x = self.pool(self.relu(self.conv2(x)))
            x = self.flatten(x)
            x = self.relu(self.fc1(x))
            x = self.fc2(x)
            return x
    
    if architecture == "cnn":
        model = CNNModel(num_classes)
    else:
        model = SimpleModel(num_classes)
    
    model.load_state_dict(checkpoint['model_state_dict'])
    model.eval()

    # ler imagem
    contents = await file.read()
    from PIL import Image
    import io

    image = Image.open(io.BytesIO(contents)).convert('L').resize((28, 28))
    image_array = np.array(image) / 255.0
    image_tensor = torch.FloatTensor(image_array).unsqueeze(0).unsqueeze(0)  # (1, 1, 28, 28)

    # predição
    with torch.no_grad():
        outputs = model(image_tensor)
        probabilities = torch.softmax(outputs, dim=1)
        predicted_class = int(torch.argmax(probabilities, dim=1).item())
        confidence = float(probabilities[0][predicted_class].item())
        probabilities = probabilities[0].tolist()

    return {
        "predicted_class": predicted_class,
        "confidence": confidence,
        "probabilities": probabilities
    }

@app.post("/datasets/upload")
async def upload_dataset(file: UploadFile = File(...), name: str = "Custom Dataset"):
    dataset_id = str(uuid.uuid4())
    datasets_dir = "datasets"
    os.makedirs(datasets_dir, exist_ok=True)
    
    dataset_path = os.path.join(datasets_dir, dataset_id)
    os.makedirs(dataset_path, exist_ok=True)
    
    # Salvar ZIP
    zip_path = os.path.join(dataset_path, "upload.zip")
    with open(zip_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Extrair ZIP
    extract_path = os.path.join(dataset_path, "extracted")
    os.makedirs(extract_path, exist_ok=True)

    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_path)

    # Detectar classes (pastas)
    # Se houver apenas uma pasta no nível raiz, usar ela como base
    items = os.listdir(extract_path)
    base_path = extract_path

    if len(items) == 1:
        potential_base = os.path.join(extract_path, items[0])
        if os.path.isdir(potential_base):
            base_path = potential_base

    classes = []
    for item in os.listdir(base_path):
        item_path = os.path.join(base_path, item)
        if os.path.isdir(item_path):
            classes.append(item)
    
    if not classes:
        shutil.rmtree(dataset_path)
        return {"error": "No class folders found in dataset"}
    
    # Processar imagens: redimensionar para 28x28
    processed_path = os.path.join(dataset_path, "processed")
    os.makedirs(processed_path, exist_ok=True)

    num_images = 0
    for class_name in classes:
        class_path = os.path.join(base_path, class_name)
        processed_class_path = os.path.join(processed_path, class_name)
        os.makedirs(processed_class_path, exist_ok=True)

        for img_file in os.listdir(class_path):
            if img_file.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp')):
                img_path = os.path.join(class_path, img_file)
                try:
                    img = Image.open(img_path).convert('L').resize((28, 28))
                    img.save(os.path.join(processed_class_path, img_file))
                    num_images += 1
                except Exception as e:
                    print(f"Error processing {img_file}: {e}")
    
    # Salvar no banco
    db = SessionLocal()
    new_dataset = Dataset(
        id=dataset_id,
        name=name,
        path=processed_path,
        classes=classes,
        num_classes=len(classes),
        num_images=num_images
    )
    db.add(new_dataset)
    db.commit()
    db.close()
    
    return {
        "dataset_id": dataset_id,
        "name": name,
        "classes": classes,
        "num_classes": len(classes),
        "num_images": num_images
    }

@app.get("/datasets")
def list_datasets():
    db = SessionLocal()
    datasets = db.query(Dataset).all()
    db.close()
    
    result = []
    for d in datasets:
        result.append({
            "id": d.id,
            "name": d.name,
            "classes": d.classes,
            "num_classes": d.num_classes,
            "num_images": d.num_images
        })
    
    return result