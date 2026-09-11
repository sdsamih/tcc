from fastapi import FastAPI, BackgroundTasks, UploadFile, File, Form, Request, HTTPException, Depends
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import time
import uuid
import os
import zipfile
import shutil
from PIL import Image
import numpy as np
import io
import logging
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix

from src.database import engine
from src.models import Base
from src.database import SessionLocal
from src.models import Train, Dataset, Experiment, User
from src.auth import verify_password, get_password_hash, create_access_token, decode_access_token

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset as TorchDataset, DataLoader
import torchvision.transforms as transforms
import torchvision.models as models
import timm

app = FastAPI()

logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

TRANSFER_LEARNING_MODELS = ["mobilenet", "resnet50", "inceptionv3", "xception", "densenet121"]

# ImageNet mean/std para normalização dos modelos de transfer learning
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]


class TrainParams(BaseModel):
    epochs: int
    learning_rate: float
    batch_size: int
    experiment_id: str
    architecture: str = "simple"
    early_stopping: bool = False
    data_augmentation: bool = False


class ExperimentParams(BaseModel):
    name: str
    dataset_id: str | None = None
    architecture: str = "simple"


class UpdateNameParams(BaseModel):
    name: str


class RegisterParams(BaseModel):
    username: str
    password: str
    name: str | None = None
    institution: str | None = None
    course: str | None = None


class LoginParams(BaseModel):
    username: str
    password: str


security = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Obtém o ID do usuário a partir do token JWT"""
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token inválido")
    return user_id


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

class ImageFileDataset(TorchDataset):
    """
    Carrega imagens do disco sob demanda.
    samples: lista de (path_ou_array, label)
    """

    def __init__(self, samples, transform):
        self.samples = samples
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path_or_array, label = self.samples[idx]

        if isinstance(path_or_array, str):
            img = Image.open(path_or_array).convert("RGB")
        else:
            img = Image.fromarray(path_or_array).convert("RGB")

        return self.transform(img), label


def make_train_transform(architecture, data_augmentation=False):
    """Retorna o transform de treino correto para cada arquitetura com data augmentation opcional."""
    if architecture in TRANSFER_LEARNING_MODELS:
        size = 224
        if data_augmentation:
            return transforms.Compose([
                transforms.RandomResizedCrop(size, scale=(0.8, 1.0)),
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.RandomRotation(degrees=15),
                transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
                transforms.ToTensor(),
                transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
            ])
        else:
            return transforms.Compose([
                transforms.Resize((size, size)),
                transforms.ToTensor(),
                transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
            ])
    else:
        if data_augmentation:
            return transforms.Compose([
                transforms.Resize((28, 28)),
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.RandomRotation(degrees=10),
                transforms.ToTensor(),
            ])
        else:
            return transforms.Compose([
                transforms.Resize((28, 28)),
                transforms.ToTensor(),
            ])


def make_test_transform(architecture):
    """Retorna o transform de teste correto para cada arquitetura (sem augmentation)."""
    if architecture in TRANSFER_LEARNING_MODELS:
        size = 224
        return transforms.Compose([
            transforms.Resize((size, size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ])
    else:
        return transforms.Compose([
            transforms.Resize((28, 28)),
            transforms.ToTensor(),
        ])


# ---------------------------------------------------------------------------
# Modelos
# ---------------------------------------------------------------------------

def build_model(architecture, num_classes):
    if architecture == "mobilenet":
        model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
        for p in model.parameters():
            p.requires_grad = False
        model.classifier = nn.Sequential(
            nn.Dropout(0.2),
            nn.Linear(model.last_channel, 128),
            nn.ReLU(),
            nn.Linear(128, num_classes),
        )

    elif architecture == "resnet50":
        model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
        for p in model.parameters():
            p.requires_grad = False
        model.fc = nn.Sequential(
            nn.Linear(model.fc.in_features, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, num_classes),
        )

    elif architecture == "inceptionv3":
        model = models.inception_v3(weights=models.Inception_V3_Weights.IMAGENET1K_V1)
        for p in model.parameters():
            p.requires_grad = False
        model.fc = nn.Sequential(
            nn.Linear(model.fc.in_features, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, num_classes),
        )
        model.aux_logits = False

    elif architecture == "xception":
        # Xception do timm
        model = timm.create_model('xception', pretrained=True, num_classes=0)
        for p in model.parameters():
            p.requires_grad = False
        in_features = model.num_features
        model.fc = nn.Sequential(
            nn.Dropout(0.2),
            nn.Linear(in_features, 128),
            nn.ReLU(),
            nn.Linear(128, num_classes),
        )

    elif architecture == "densenet121":
        model = models.densenet121(weights=models.DenseNet121_Weights.IMAGENET1K_V1)
        for p in model.parameters():
            p.requires_grad = False
        model.classifier = nn.Sequential(
            nn.Linear(model.classifier.in_features, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, num_classes),
        )

    elif architecture == "cnn":
        model = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Flatten(),
            nn.Linear(64 * 7 * 7, 128),
            nn.ReLU(),
            nn.Linear(128, num_classes),
        )

    else:  # simple
        model = nn.Sequential(
            nn.Flatten(),
            nn.Linear(28 * 28 * 3, 128),
            nn.ReLU(),
            nn.Linear(128, num_classes),
        )

    return model.to(DEVICE)


# ---------------------------------------------------------------------------
# Treinamento
# ---------------------------------------------------------------------------

def get_device_info():
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        return f"GPU ({gpu_name})"
    else:
        cpu_model = "Desconhecido"
        try:
            with open("/proc/cpuinfo") as f:
                for line in f:
                    if line.startswith("model name"):
                        cpu_model = line.split(":", 1)[1].strip()
                        break
        except Exception:
            pass
        return f"CPU ({cpu_model})"

def real_training(train_id: str):
    db = SessionLocal()

    train = db.query(Train).filter(Train.id == train_id).first()
    experiment = db.query(Experiment).filter(Experiment.id == train.experiment_id).first()

    device_info = get_device_info()
    print(f"{'='*60}")
    print(f"Iniciando treino:  {train_id}")
    print(f"Experimento:       {experiment.name}")
    print(f"Arquitetura:       {experiment.architecture}")
    print(f"Dispositivo:       {device_info}")
    print(f"Epochs: {train.epochs}  |  LR: {train.learning_rate}  |  Batch: {train.batch_size}")
    print(f"Data Augmentation: {train.data_augmentation}")
    print(f"{'='*60}")

    train_transform = make_train_transform(experiment.architecture, train.data_augmentation)
    test_transform = make_test_transform(experiment.architecture)

    if experiment.dataset_id:
        dataset = db.query(Dataset).filter(Dataset.id == experiment.dataset_id).first()

        all_samples = []
        for class_idx, class_name in enumerate(dataset.classes):
            class_path = os.path.join(dataset.path, class_name)
            images = sorted(os.listdir(class_path))
            for img_file in images:
                all_samples.append((os.path.join(class_path, img_file), class_idx))

        num_classes = dataset.num_classes
        class_names = dataset.classes

    else:
        import torchvision.datasets as tv_datasets
        mnist = tv_datasets.MNIST(root="/tmp/mnist", train=True, download=True)
        mnist_test = tv_datasets.MNIST(root="/tmp/mnist", train=False, download=True)

        # Converter para lista de (array, label) para reutilizar ImageFileDataset
        def mnist_samples(ds):
            return [(np.array(img), int(label)) for img, label in ds]

        all_samples = mnist_samples(mnist)
        test_samples = mnist_samples(mnist_test)

        num_classes = 10
        class_names = [str(i) for i in range(10)]

    # Split treino/validacao/teste para dataset customizado
    if experiment.dataset_id:
        np.random.shuffle(all_samples)
        n = len(all_samples)
        
        # Sistema adaptativo de split para datasets pequenos
        if n < 100:
            # Para datasets muito pequenos, usar split mais conservador
            # Mínimo de 1 amostra por split, tentando manter alguma representatividade
            min_per_split = max(1, n // 10)  # Mínimo 1, mas idealmente 10% por split
            test_split = min_per_split
            val_split = min_per_split
            print(f"⚠️  Dataset pequeno ({n} imagens). Usando split conservador para validação/teste.")
        else:
            # Para datasets normais, usar split padrão
            test_split = int(n * 0.2)
            val_split  = int((n - test_split) * 0.1)

        test_samples = all_samples[:test_split]
        val_samples  = all_samples[test_split:test_split + val_split]
        fit_samples  = all_samples[test_split + val_split:]
    else:
        np.random.shuffle(all_samples)
        val_split = int(len(all_samples) * 0.1)
        val_samples = all_samples[:val_split]
        fit_samples = all_samples[val_split:]

    print(f"Treino: {len(fit_samples)}, Validacao: {len(val_samples)}, Teste: {len(test_samples)}")
    print(f"Classes: {class_names}, device: {DEVICE}")

    train_loader = DataLoader(
        ImageFileDataset(fit_samples, train_transform),
        batch_size=train.batch_size,
        shuffle=True,
        num_workers=0,
        pin_memory=False,
    )
    val_loader = DataLoader(
        ImageFileDataset(val_samples, test_transform),
        batch_size=train.batch_size,
        shuffle=False,
        num_workers=0,
    )
    test_loader = DataLoader(
        ImageFileDataset(test_samples, test_transform),
        batch_size=train.batch_size,
        shuffle=False,
        num_workers=0,
    )

    model = build_model(experiment.architecture, num_classes)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=train.learning_rate,
    )

    # Early stopping setup
    use_early_stopping = train.early_stopping
    max_epochs = train.epochs
    patience = 10
    best_val_loss = float('inf')
    epochs_no_improve = 0
    
    for epoch in range(max_epochs):
        # treino
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0

        for inputs, labels in train_loader:
            inputs = inputs.to(DEVICE)
            labels = torch.tensor(labels).to(DEVICE) if not isinstance(labels, torch.Tensor) else labels.to(DEVICE)

            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * inputs.size(0)
            correct += (outputs.argmax(1) == labels).sum().item()
            total += inputs.size(0)

        train_loss = running_loss / total
        train_acc  = correct / total

        # validacao
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0

        with torch.no_grad():
            for inputs, labels in val_loader:
                inputs = inputs.to(DEVICE)
                labels = torch.tensor(labels).to(DEVICE) if not isinstance(labels, torch.Tensor) else labels.to(DEVICE)

                outputs = model(inputs)
                loss = criterion(outputs, labels)

                val_loss += loss.item() * inputs.size(0)
                val_correct += (outputs.argmax(1) == labels).sum().item()
                val_total += inputs.size(0)

        val_loss /= val_total
        val_acc   = val_correct / val_total

        # Early stopping check
        if use_early_stopping:
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                epochs_no_improve = 0
            else:
                epochs_no_improve += 1
                if epochs_no_improve >= patience:
                    print(f"Early stopping triggered at epoch {epoch + 1}")
                    break
        
        # Update progress
        train.progress = int(((epoch + 1) / train.epochs) * 100)
        db.commit()

        epoch_display = f"{epoch + 1}/{train.epochs}"
        print(
            f"Epoch {epoch_display} "
            f"- loss: {train_loss:.4f} - accuracy: {train_acc:.4f} "
            f"- val_loss: {val_loss:.4f} - val_accuracy: {val_acc:.4f}"
        )

    # avaliacao final no teste
    model.eval()
    test_loss = 0.0
    test_correct = 0
    test_total = 0
    
    # Coletar predicoes e labels para calcular metricas adicionais
    all_predictions = []
    all_labels = []

    with torch.no_grad():
        for inputs, labels in test_loader:
            inputs = inputs.to(DEVICE)
            labels = torch.tensor(labels).to(DEVICE) if not isinstance(labels, torch.Tensor) else labels.to(DEVICE)

            outputs = model(inputs)
            loss = criterion(outputs, labels)

            test_loss += loss.item() * inputs.size(0)
            test_correct += (outputs.argmax(1) == labels).sum().item()
            test_total += inputs.size(0)
            
            # Coletar predicoes e labels
            all_predictions.extend(outputs.argmax(1).cpu().numpy())
            all_labels.extend(labels.cpu().numpy())

    accuracy = test_correct / test_total
    loss_val = test_loss / test_total
    
    # Calcular metricas adicionais
    all_predictions = np.array(all_predictions)
    all_labels = np.array(all_labels)
    
    # Precision, Recall, F1-score (por classe)
    precision = precision_score(all_labels, all_predictions, average=None, zero_division=0).tolist()
    recall = recall_score(all_labels, all_predictions, average=None, zero_division=0).tolist()
    f1 = f1_score(all_labels, all_predictions, average=None, zero_division=0).tolist()
    
    # Matriz de confusao
    conf_matrix = confusion_matrix(all_labels, all_predictions).tolist()

    models_dir = "models"
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, f"{train_id}.pt")
    torch.save({
        "model_state": model.state_dict(),
        "architecture": experiment.architecture,
        "num_classes": num_classes,
    }, model_path)

    train.status = "ready"
    train.progress = 100
    train.accuracy = float(accuracy)
    train.loss = float(loss_val)
    train.model_path = model_path
    train.class_names = class_names
    train.precision = precision
    train.recall = recall
    train.f1_score = f1
    train.confusion_matrix = conf_matrix

    db.commit()
    db.close()


# ---------------------------------------------------------------------------
# Predicao
# ---------------------------------------------------------------------------

def load_model_for_inference(model_path, architecture, num_classes):
    checkpoint = torch.load(model_path, map_location=DEVICE)
    model = build_model(architecture, num_classes)
    model.load_state_dict(checkpoint["model_state"])
    model.eval()
    return model


# ---------------------------------------------------------------------------
# Autenticação
# ---------------------------------------------------------------------------

@app.post("/register")
def register(params: RegisterParams):
    """Registra um novo usuário"""
    db = SessionLocal()
    
    # Verificar se o usuário já existe
    existing_user = db.query(User).filter(User.username == params.username).first()
    if existing_user:
        db.close()
        raise HTTPException(status_code=400, detail="Nome de usuário já existe")
    
    # Criar novo usuário
    hashed_password = get_password_hash(params.password)
    new_user = User(
        id=str(uuid.uuid4()),
        username=params.username,
        password=hashed_password,
        name=params.name,
        institution=params.institution,
        course=params.course,
    )
    
    db.add(new_user)
    db.commit()
    user_id = new_user.id
    db.close()
    
    return {"user_id": user_id, "username": params.username}


@app.post("/login")
def login(params: LoginParams):
    """Faz login e retorna um token JWT"""
    db = SessionLocal()
    
    user = db.query(User).filter(User.username == params.username).first()
    if not user or not verify_password(params.password, user.password):
        db.close()
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    # Criar token de acesso
    access_token = create_access_token(data={"sub": user.id})
    db.close()
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username,
    }


@app.get("/me")
def get_current_user_info(current_user_id: str = Depends(get_current_user)):
    """Retorna informações do usuário atual"""
    db = SessionLocal()
    user = db.query(User).filter(User.id == current_user_id).first()
    if not user:
        db.close()
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    user_info = {
        "id": user.id,
        "username": user.username,
        "name": user.name,
        "institution": user.institution,
        "course": user.course,
    }
    db.close()
    return user_info


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/experiment")
def create_experiment(params: ExperimentParams, current_user_id: str = Depends(get_current_user)):
    db = SessionLocal()

    new_experiment = Experiment(
        id=str(uuid.uuid4()),
        name=params.name,
        dataset_id=params.dataset_id or None,
        architecture=params.architecture,
        created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
        user_id=current_user_id,
    )

    db.add(new_experiment)
    db.commit()
    experiment_id = new_experiment.id
    db.close()

    return {"experiment_id": experiment_id}


@app.get("/experiment")
def list_experiments(current_user_id: str = Depends(get_current_user)):
    db = SessionLocal()
    experiments = db.query(Experiment).filter(Experiment.user_id == current_user_id).all()

    result = []
    for exp in experiments:
        train_count = db.query(Train).filter(Train.experiment_id == exp.id).count()
        result.append({
            "id": exp.id,
            "name": exp.name,
            "dataset_id": exp.dataset_id,
            "architecture": exp.architecture,
            "created_at": exp.created_at,
            "train_count": train_count,
        })

    db.close()
    return result


@app.get("/experiment/{experiment_id}")
def get_experiment(experiment_id: str, current_user_id: str = Depends(get_current_user)):
    db = SessionLocal()

    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        db.close()
        return {"error": "not found"}
    
    # Verificar se o experimento pertence ao usuário
    if exp.user_id != current_user_id:
        db.close()
        raise HTTPException(status_code=403, detail="Acesso negado")

    trains = db.query(Train).filter(Train.experiment_id == experiment_id).all()

    result = {
        "id": exp.id,
        "name": exp.name,
        "dataset_id": exp.dataset_id,
        "architecture": exp.architecture,
        "created_at": exp.created_at,
        "trains": [_serialize_train(t) for t in trains],
    }

    db.close()
    return result


@app.get("/experiment/{experiment_id}/trains")
def list_experiment_trains(experiment_id: str, current_user_id: str = Depends(get_current_user)):
    db = SessionLocal()
    
    # Verificar se o experimento pertence ao usuário
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp or exp.user_id != current_user_id:
        db.close()
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    trains = db.query(Train).filter(Train.experiment_id == experiment_id).all()
    db.close()
    return [_serialize_train(t) for t in trains]


@app.put("/experiment/{experiment_id}")
def update_experiment(experiment_id: str, params: UpdateNameParams, current_user_id: str = Depends(get_current_user)):
    db = SessionLocal()
    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        db.close()
        return {"error": "experiment not found"}
    
    # Verificar se o experimento pertence ao usuário
    if experiment.user_id != current_user_id:
        db.close()
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    experiment.name = params.name
    db.commit()
    db.close()
    return {"id": experiment_id, "name": params.name}


@app.delete("/experiment/{experiment_id}")
def delete_experiment(experiment_id: str, current_user_id: str = Depends(get_current_user)):
    db = SessionLocal()
    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        db.close()
        return {"error": "experiment not found"}
    
    # Verificar se o experimento pertence ao usuário
    if experiment.user_id != current_user_id:
        db.close()
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Deletar todos os treinos associados
    trains = db.query(Train).filter(Train.experiment_id == experiment_id).all()
    for train in trains:
        # Deletar arquivo do modelo se existir
        if train.model_path and os.path.exists(train.model_path):
            os.remove(train.model_path)
        db.delete(train)

    db.delete(experiment)
    db.commit()
    db.close()
    return {"message": "experiment deleted"}


@app.post("/experiment/{experiment_id}/train")
def create_train_in_experiment(experiment_id: str, params: TrainParams, background_tasks: BackgroundTasks, current_user_id: str = Depends(get_current_user)):
    db = SessionLocal()

    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        db.close()
        return {"error": "experiment not found"}
    
    # Verificar se o experimento pertence ao usuário
    if experiment.user_id != current_user_id:
        db.close()
        raise HTTPException(status_code=403, detail="Acesso negado")

    train_id = str(uuid.uuid4())

    new_train = Train(
        id=train_id,
        experiment_id=experiment_id,
        epochs=params.epochs,
        learning_rate=params.learning_rate,
        batch_size=params.batch_size,
        early_stopping=params.early_stopping,
        data_augmentation=params.data_augmentation,
        status="training",
        progress=0,
    )

    db.add(new_train)
    db.commit()
    db.close()

    background_tasks.add_task(real_training, train_id)

    return {"train_id": train_id}


@app.get("/train")
def list_trains(current_user_id: str = Depends(get_current_user)):
    db = SessionLocal()
    
    # Listar apenas treinos dos experimentos do usuário
    user_experiments = db.query(Experiment).filter(Experiment.user_id == current_user_id).all()
    experiment_ids = [exp.id for exp in user_experiments]
    trains = db.query(Train).filter(Train.experiment_id.in_(experiment_ids)).all()
    
    db.close()
    return [_serialize_train(t, include_experiment=True) for t in trains]


@app.get("/train/{train_id}")
def get_train(train_id: str, current_user_id: str = Depends(get_current_user)):
    db = SessionLocal()
    t = db.query(Train).filter(Train.id == train_id).first()
    
    if not t:
        db.close()
        return {"error": "not found"}
    
    # Verificar se o treino pertence a um experimento do usuário
    experiment = db.query(Experiment).filter(Experiment.id == t.experiment_id).first()
    if not experiment or experiment.user_id != current_user_id:
        db.close()
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    db.close()
    return _serialize_train(t, include_experiment=True)


@app.delete("/train/{train_id}")
def delete_train(train_id: str, current_user_id: str = Depends(get_current_user)):
    db = SessionLocal()
    train = db.query(Train).filter(Train.id == train_id).first()
    if not train:
        db.close()
        return {"error": "train not found"}
    
    # Verificar se o treino pertence a um experimento do usuário
    experiment = db.query(Experiment).filter(Experiment.id == train.experiment_id).first()
    if not experiment or experiment.user_id != current_user_id:
        db.close()
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Deletar arquivo do modelo se existir
    if train.model_path and os.path.exists(train.model_path):
        os.remove(train.model_path)

    db.delete(train)
    db.commit()
    db.close()
    return {"message": "train deleted"}


@app.get("/train/{train_id}/download")
def download_model(train_id: str, current_user_id: str = Depends(get_current_user)):
    db = SessionLocal()
    t = db.query(Train).filter(Train.id == train_id).first()
    
    if not t or not t.model_path or not os.path.exists(t.model_path):
        db.close()
        return {"error": "model not found or not ready"}
    
    # Verificar se o treino pertence a um experimento do usuário
    experiment = db.query(Experiment).filter(Experiment.id == t.experiment_id).first()
    if not experiment or experiment.user_id != current_user_id:
        db.close()
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    db.close()

    return FileResponse(
        t.model_path,
        media_type="application/octet-stream",
        filename=f"{t.id}.pt",
    )


@app.post("/train/{train_id}/predict")
async def predict(train_id: str, file: UploadFile = File(...), current_user_id: str = Depends(get_current_user)):
    db = SessionLocal()
    t = db.query(Train).filter(Train.id == train_id).first()
    
    if not t or not t.model_path or not os.path.exists(t.model_path):
        db.close()
        return {"error": "model not found or not ready"}
    
    # Verificar se o treino pertence a um experimento do usuário
    experiment = db.query(Experiment).filter(Experiment.id == t.experiment_id).first()
    if not experiment or experiment.user_id != current_user_id:
        db.close()
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    num_classes = len(t.class_names) if t.class_names else 2
    db.close()

    model = load_model_for_inference(t.model_path, experiment.architecture, num_classes)

    transform = make_transform(experiment.architecture)

    contents = await file.read()
    img = Image.open(io.BytesIO(contents)).convert("RGB")
    tensor = transform(img).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        outputs = model(tensor)
        probabilities = torch.softmax(outputs, dim=1)[0]

    predicted_class = int(probabilities.argmax().item())
    confidence = float(probabilities[predicted_class].item())

    return {
        "predicted_class": predicted_class,
        "confidence": confidence,
        "probabilities": probabilities.tolist(),
    }


@app.post("/datasets/upload")
async def upload_dataset(request: Request, file: UploadFile = File(...), current_user_id: str = Depends(get_current_user)):
    # Ler o FormData manualmente
    form_data = await request.form()
    name = form_data.get("name", "Custom Dataset")
    print(f"DEBUG: Recebendo dataset upload - name: '{name}', file: {file.filename}")
    dataset_id = str(uuid.uuid4())
    dataset_path = os.path.join("datasets", dataset_id)
    os.makedirs(dataset_path, exist_ok=True)

    zip_path = os.path.join(dataset_path, "upload.zip")
    with open(zip_path, "wb") as f:
        f.write(await file.read())

    extract_path = os.path.join(dataset_path, "extracted")
    os.makedirs(extract_path, exist_ok=True)

    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(extract_path)

    items = os.listdir(extract_path)
    base_path = extract_path
    if len(items) == 1:
        potential_base = os.path.join(extract_path, items[0])
        if os.path.isdir(potential_base):
            base_path = potential_base

    classes = sorted([
        item for item in os.listdir(base_path)
        if os.path.isdir(os.path.join(base_path, item))
    ])

    if not classes:
        shutil.rmtree(dataset_path)
        return {"error": "No class folders found in dataset"}

    processed_path = os.path.join(dataset_path, "processed")
    os.makedirs(processed_path, exist_ok=True)

    num_images = 0
    for class_name in classes:
        class_src = os.path.join(base_path, class_name)
        class_dst = os.path.join(processed_path, class_name)
        os.makedirs(class_dst, exist_ok=True)

        for img_file in os.listdir(class_src):
            if img_file.lower().endswith((".png", ".jpg", ".jpeg", ".bmp")):
                try:
                    img = Image.open(os.path.join(class_src, img_file)).convert("RGB")
                    img.save(os.path.join(class_dst, img_file))
                    num_images += 1
                except Exception as e:
                    print(f"Error processing {img_file}: {e}")

    db = SessionLocal()
    new_dataset = Dataset(
        id=dataset_id,
        name=name,
        path=processed_path,
        classes=classes,
        num_classes=len(classes),
        num_images=num_images,
        user_id=current_user_id,
    )
    db.add(new_dataset)
    db.commit()
    db.close()

    return {
        "dataset_id": dataset_id,
        "name": name,
        "classes": classes,
        "num_classes": len(classes),
        "num_images": num_images,
    }


@app.get("/datasets")
def list_datasets(current_user_id: str = Depends(get_current_user)):
    db = SessionLocal()
    datasets = db.query(Dataset).filter(Dataset.user_id == current_user_id).all()
    db.close()

    return [
        {
            "id": d.id,
            "name": d.name,
            "classes": d.classes,
            "num_classes": d.num_classes,
            "num_images": d.num_images,
        }
        for d in datasets
    ]


@app.put("/datasets/{dataset_id}")
def update_dataset(dataset_id: str, params: UpdateNameParams, current_user_id: str = Depends(get_current_user)):
    db = SessionLocal()
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        db.close()
        return {"error": "dataset not found"}
    
    # Verificar se o dataset pertence ao usuário
    if dataset.user_id != current_user_id:
        db.close()
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    dataset.name = params.name
    db.commit()
    db.close()
    return {"id": dataset_id, "name": params.name}


@app.delete("/datasets/{dataset_id}")
def delete_dataset(dataset_id: str, current_user_id: str = Depends(get_current_user)):
    db = SessionLocal()
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        db.close()
        return {"error": "dataset not found"}
    
    # Verificar se o dataset pertence ao usuário
    if dataset.user_id != current_user_id:
        db.close()
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Deletar arquivos do dataset
    if os.path.exists(dataset.path):
        shutil.rmtree(os.path.dirname(dataset.path))

    db.delete(dataset)
    db.commit()
    db.close()
    return {"message": "dataset deleted"}


def _serialize_train(t, include_experiment=False):
    data = {
        "id": t.id,
        "status": t.status,
        "progress": t.progress,
        "params": {
            "epochs": t.epochs,
            "learning_rate": t.learning_rate,
            "batch_size": t.batch_size,
            "early_stopping": t.early_stopping,
            "data_augmentation": t.data_augmentation,
        },
        "accuracy": t.accuracy,
        "loss": t.loss,
        "model_path": t.model_path,
        "class_names": t.class_names,
        "precision": t.precision,
        "recall": t.recall,
        "f1_score": t.f1_score,
        "confusion_matrix": t.confusion_matrix,
    }
    if include_experiment:
        data["experiment_id"] = t.experiment_id
    return data