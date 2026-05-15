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

from src.models import Train, Dataset

import tensorflow as tf
from tensorflow import keras

app = FastAPI()
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
    dataset_id: str | None = None
    architecture: str = "simple"  # "simple" ou "cnn"

def real_training(train_id: str):
    db = SessionLocal()

    train = db.query(Train).filter(Train.id == train_id).first()

    # Carregar dataset
    if train.dataset_id:
        dataset = db.query(Dataset).filter(Dataset.id == train.dataset_id).first()
        
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
        
        num_classes = dataset.num_classes
        class_names = dataset.classes
    else:
        # carregar MNIST
        (x_train, y_train), (x_test, y_test) = keras.datasets.mnist.load_data()
        x_train = x_train / 255.0
        x_test = x_test / 255.0
        num_classes = 10
        class_names = [str(i) for i in range(10)]

    # modelo adaptável
    if train.architecture == "cnn":
        # CNN para melhor desempenho em imagens
        model = keras.Sequential([
            keras.layers.Reshape((28, 28, 1), input_shape=(28, 28)),
            keras.layers.Conv2D(32, (3, 3), activation='relu'),
            keras.layers.MaxPooling2D((2, 2)),
            keras.layers.Conv2D(64, (3, 3), activation='relu'),
            keras.layers.MaxPooling2D((2, 2)),
            keras.layers.Flatten(),
            keras.layers.Dense(128, activation='relu'),
            keras.layers.Dense(num_classes, activation='softmax')
        ])
    else:
        # Modelo simples (Dense)
        model = keras.Sequential([
            keras.layers.Flatten(input_shape=(28, 28)),
            keras.layers.Dense(128, activation="relu"),
            keras.layers.Dense(num_classes, activation="softmax")
        ])

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=train.learning_rate),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"]
    )

    # callback de progresso
    class ProgressCallback(keras.callbacks.Callback):
        def on_epoch_end(self, epoch, logs=None):
            train.progress = int(((epoch + 1) / train.epochs) * 100)
            db.commit()

    model.fit(
        x_train,
        y_train,
        epochs=train.epochs,
        batch_size=train.batch_size,
        callbacks=[ProgressCallback()],
        verbose=0
    )

    loss, accuracy = model.evaluate(x_test, y_test, verbose=0)

    # salvar modelo
    models_dir = "models"
    if not os.path.exists(models_dir):
        os.makedirs(models_dir)
    
    model_path = os.path.join(models_dir, f"{train_id}.keras")
    model.save(model_path)

    train.status = "ready"
    train.progress = 100
    train.accuracy = float(accuracy)
    train.loss = float(loss)
    train.model_path = model_path
    train.class_names = class_names

    db.commit()
    db.close()

@app.post("/train")
def create_train(params: TrainParams, background_tasks: BackgroundTasks):
    db = SessionLocal()

    train_id = str(uuid.uuid4())

    # Converter string vazia para None
    dataset_id_to_use = params.dataset_id if params.dataset_id else None

    new_train = Train(
        id=train_id,
        epochs=params.epochs,
        learning_rate=params.learning_rate,
        batch_size=params.batch_size,
        dataset_id=dataset_id_to_use,
        architecture=params.architecture,
        status="training",
        progress=0
    )

    db.add(new_train)
    db.commit()

    background_tasks.add_task(real_training, train_id)

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
            "dataset_id": t.dataset_id,
            "architecture": t.architecture
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
        "dataset_id": t.dataset_id,
        "architecture": t.architecture
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
        filename=f"{train_id}.keras"
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
    model = keras.models.load_model(t.model_path)

    # ler imagem
    contents = await file.read()
    from PIL import Image
    import io

    image = Image.open(io.BytesIO(contents)).convert('L').resize((28, 28))
    image_array = np.array(image) / 255.0
    image_array = image_array.reshape(1, 28, 28)

    # predição
    prediction = model.predict(image_array, verbose=0)
    predicted_class = int(np.argmax(prediction))
    confidence = float(prediction[0][predicted_class])

    return {
        "predicted_class": predicted_class,
        "confidence": confidence
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