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
import io
import logging

from src.database import engine
from src.models import Base
from src.database import SessionLocal
from src.models import Train, Dataset, Experiment

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.applications import MobileNet, ResNet50, InceptionV3, Xception, DenseNet121
from tensorflow.keras.applications.mobilenet import preprocess_input as mobilenet_preprocess
from tensorflow.keras.applications.resnet50 import preprocess_input as resnet50_preprocess
from tensorflow.keras.applications.inception_v3 import preprocess_input as inception_v3_preprocess
from tensorflow.keras.applications.xception import preprocess_input as xception_preprocess
from tensorflow.keras.applications.densenet import preprocess_input as densenet_preprocess

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

TRANSFER_LEARNING_MODELS = ["mobilenet", "resnet50", "inceptionv3", "xception", "densenet121"]

PREPROCESS_FN = {
    "mobilenet": mobilenet_preprocess,
    "resnet50": resnet50_preprocess,
    "inceptionv3": inception_v3_preprocess,
    "xception": xception_preprocess,
    "densenet121": densenet_preprocess,
}


class TrainParams(BaseModel):
    epochs: int
    learning_rate: float
    batch_size: int
    experiment_id: str
    architecture: str = "simple"


class ExperimentParams(BaseModel):
    name: str
    dataset_id: str | None = None
    architecture: str = "simple"


def load_image(path, target_size):
    """Abre imagem e força RGB, preservando os valores originais."""
    return Image.open(path).convert("RGB").resize(target_size)


def build_model(architecture, num_classes):
    if architecture in TRANSFER_LEARNING_MODELS:
        base_model_cls = {
            "mobilenet": MobileNet,
            "resnet50": ResNet50,
            "inceptionv3": InceptionV3,
            "xception": Xception,
            "densenet121": DenseNet121,
        }[architecture]

        base_model = base_model_cls(weights="imagenet", include_top=False, input_shape=(224, 224, 3))
        base_model.trainable = False

        inputs = keras.Input(shape=(224, 224, 3))
        x = base_model(inputs)
        x = keras.layers.GlobalAveragePooling2D()(x)
        x = keras.layers.Dense(128, activation="relu")(x)
        x = keras.layers.Dropout(0.2)(x)
        outputs = keras.layers.Dense(num_classes, activation="softmax")(x)
        return keras.Model(inputs=inputs, outputs=outputs)

    elif architecture == "cnn":
        return keras.Sequential([
            keras.layers.Conv2D(32, (3, 3), activation="relu", input_shape=(28, 28, 3)),
            keras.layers.MaxPooling2D((2, 2)),
            keras.layers.Conv2D(64, (3, 3), activation="relu"),
            keras.layers.MaxPooling2D((2, 2)),
            keras.layers.Flatten(),
            keras.layers.Dense(128, activation="relu"),
            keras.layers.Dense(num_classes, activation="softmax"),
        ])

    else:  # simple
        return keras.Sequential([
            keras.layers.Flatten(input_shape=(28, 28, 3)),
            keras.layers.Dense(128, activation="relu"),
            keras.layers.Dense(num_classes, activation="softmax"),
        ])


class ImageDataGenerator(keras.utils.Sequence):
    """Carrega imagens do disco em batches, sem manter tudo na RAM."""

    def __init__(self, samples, batch_size, target_size, preprocess_fn):
        # samples: lista de (path, label) ou (array, label) para MNIST
        self.samples = samples
        self.batch_size = batch_size
        self.target_size = target_size
        self.preprocess_fn = preprocess_fn
        self.indices = np.arange(len(samples))
        np.random.shuffle(self.indices)

    def __len__(self):
        return int(np.ceil(len(self.samples) / self.batch_size))

    def __getitem__(self, idx):
        batch_indices = self.indices[idx * self.batch_size:(idx + 1) * self.batch_size]
        batch = [self.samples[i] for i in batch_indices]

        images = []
        labels = []
        for path_or_array, label in batch:
            if isinstance(path_or_array, str):
                img_array = np.array(load_image(path_or_array, self.target_size), dtype="float32")
            else:
                img_array = path_or_array.astype("float32")
            images.append(img_array)
            labels.append(label)

        x = np.array(images)
        x = self.preprocess_fn(x)
        return x, np.array(labels)

    def on_epoch_end(self):
        np.random.shuffle(self.indices)


def real_training(train_id: str):
    db = SessionLocal()

    train = db.query(Train).filter(Train.id == train_id).first()
    experiment = db.query(Experiment).filter(Experiment.id == train.experiment_id).first()

    is_transfer_learning = experiment.architecture in TRANSFER_LEARNING_MODELS
    target_size = (224, 224) if is_transfer_learning else (28, 28)

    if is_transfer_learning:
        preprocess_fn = PREPROCESS_FN[experiment.architecture]
    else:
        preprocess_fn = lambda x: x / 255.0

    if experiment.dataset_id:
        dataset = db.query(Dataset).filter(Dataset.id == experiment.dataset_id).first()

        train_samples, test_samples = [], []

        for class_idx, class_name in enumerate(dataset.classes):
            class_path = os.path.join(dataset.path, class_name)
            images = os.listdir(class_path)
            split_idx = int(len(images) * 0.8)

            for i, img_file in enumerate(images):
                img_path = os.path.join(class_path, img_file)
                if i < split_idx:
                    train_samples.append((img_path, class_idx))
                else:
                    test_samples.append((img_path, class_idx))

        num_classes = dataset.num_classes
        class_names = dataset.classes

    else:
        # MNIST — converte para RGB antecipadamente (dataset pequeno, cabe na RAM)
        (x_raw_train, y_raw_train), (x_raw_test, y_raw_test) = keras.datasets.mnist.load_data()

        def mnist_to_rgb(data):
            imgs = []
            for img in data:
                arr = np.array(Image.fromarray(img.astype("uint8")).convert("RGB").resize(target_size))
                imgs.append(arr)
            return imgs

        mnist_train_imgs = mnist_to_rgb(x_raw_train)
        mnist_test_imgs = mnist_to_rgb(x_raw_test)

        train_samples = list(zip(mnist_train_imgs, y_raw_train.tolist()))
        test_samples = list(zip(mnist_test_imgs, y_raw_test.tolist()))

        num_classes = 10
        class_names = [str(i) for i in range(10)]

    np.random.shuffle(train_samples)
    np.random.shuffle(test_samples)

    # Separar validação dos dados de treino (10%)
    val_split = int(len(train_samples) * 0.1)
    val_samples = train_samples[:val_split]
    fit_samples = train_samples[val_split:]

    print(f"Treino: {len(fit_samples)}, Validação: {len(val_samples)}, Teste: {len(test_samples)}")
    print(f"Classes: {class_names}")

    train_gen = ImageDataGenerator(fit_samples, train.batch_size, target_size, preprocess_fn)
    val_gen = ImageDataGenerator(val_samples, train.batch_size, target_size, preprocess_fn)
    test_gen = ImageDataGenerator(test_samples, train.batch_size, target_size, preprocess_fn)

    model = build_model(experiment.architecture, num_classes)
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=train.learning_rate),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    class ProgressCallback(keras.callbacks.Callback):
        def on_epoch_end(self, epoch, logs=None):
            train.progress = int(((epoch + 1) / train.epochs) * 100)
            if logs:
                print(
                    f"Epoch {epoch + 1}/{train.epochs} "
                    f"- loss: {logs.get('loss', 0):.4f} "
                    f"- accuracy: {logs.get('accuracy', 0):.4f} "
                    f"- val_loss: {logs.get('val_loss', 0):.4f} "
                    f"- val_accuracy: {logs.get('val_accuracy', 0):.4f}"
                )
            db.commit()

    model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=train.epochs,
        callbacks=[ProgressCallback()],
        verbose=0,
    )

    loss, accuracy = model.evaluate(test_gen, verbose=0)

    models_dir = "models"
    os.makedirs(models_dir, exist_ok=True)
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


@app.post("/experiment")
def create_experiment(params: ExperimentParams):
    db = SessionLocal()

    new_experiment = Experiment(
        id=str(uuid.uuid4()),
        name=params.name,
        dataset_id=params.dataset_id or None,
        architecture=params.architecture,
        created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
    )

    db.add(new_experiment)
    db.commit()
    experiment_id = new_experiment.id
    db.close()

    return {"experiment_id": experiment_id}


@app.get("/experiment")
def list_experiments():
    db = SessionLocal()
    experiments = db.query(Experiment).all()

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
def get_experiment(experiment_id: str):
    db = SessionLocal()

    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        db.close()
        return {"error": "not found"}

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
def list_experiment_trains(experiment_id: str):
    db = SessionLocal()
    trains = db.query(Train).filter(Train.experiment_id == experiment_id).all()
    db.close()
    return [_serialize_train(t) for t in trains]


@app.post("/experiment/{experiment_id}/train")
def create_train_in_experiment(experiment_id: str, params: TrainParams, background_tasks: BackgroundTasks):
    db = SessionLocal()

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
        progress=0,
    )

    db.add(new_train)
    db.commit()
    db.close()

    background_tasks.add_task(real_training, train_id)

    return {"train_id": train_id}


@app.get("/train")
def list_trains():
    db = SessionLocal()
    trains = db.query(Train).all()
    db.close()
    return [_serialize_train(t, include_experiment=True) for t in trains]


@app.get("/train/{train_id}")
def get_train(train_id: str):
    db = SessionLocal()
    t = db.query(Train).filter(Train.id == train_id).first()
    db.close()

    if not t:
        return {"error": "not found"}

    return _serialize_train(t, include_experiment=True)


@app.get("/train/{train_id}/download")
def download_model(train_id: str):
    db = SessionLocal()
    t = db.query(Train).filter(Train.id == train_id).first()
    db.close()

    if not t or not t.model_path or not os.path.exists(t.model_path):
        return {"error": "model not found or not ready"}

    return FileResponse(
        t.model_path,
        media_type="application/octet-stream",
        filename=f"{train_id}.keras",
    )


@app.post("/train/{train_id}/predict")
async def predict(train_id: str, file: UploadFile = File(...)):
    db = SessionLocal()
    t = db.query(Train).filter(Train.id == train_id).first()
    experiment = db.query(Experiment).filter(Experiment.id == t.experiment_id).first()
    db.close()

    if not t or not t.model_path or not os.path.exists(t.model_path):
        return {"error": "model not found or not ready"}

    is_transfer_learning = experiment.architecture in TRANSFER_LEARNING_MODELS
    target_size = (224, 224) if is_transfer_learning else (28, 28)

    model = keras.models.load_model(t.model_path)

    contents = await file.read()
    image_array = np.array(
        Image.open(io.BytesIO(contents)).convert("RGB").resize(target_size),
        dtype="float32",
    )
    image_array = np.expand_dims(image_array, axis=0)

    if is_transfer_learning:
        image_array = PREPROCESS_FN[experiment.architecture](image_array)
    else:
        image_array = image_array / 255.0

    prediction = model.predict(image_array, verbose=0)
    predicted_class = int(np.argmax(prediction))
    confidence = float(prediction[0][predicted_class])

    return {
        "predicted_class": predicted_class,
        "confidence": confidence,
        "probabilities": prediction[0].tolist(),
    }


@app.post("/datasets/upload")
async def upload_dataset(file: UploadFile = File(...), name: str = "Custom Dataset"):
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

    # Se houver uma única pasta raiz, usa ela como base
    items = os.listdir(extract_path)
    base_path = extract_path
    if len(items) == 1:
        potential_base = os.path.join(extract_path, items[0])
        if os.path.isdir(potential_base):
            base_path = potential_base

    classes = [item for item in os.listdir(base_path) if os.path.isdir(os.path.join(base_path, item))]

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
                    # Força RGB para garantir 3 canais consistentes
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
def list_datasets():
    db = SessionLocal()
    datasets = db.query(Dataset).all()
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


def _serialize_train(t, include_experiment=False):
    data = {
        "id": t.id,
        "status": t.status,
        "progress": t.progress,
        "params": {
            "epochs": t.epochs,
            "learning_rate": t.learning_rate,
            "batch_size": t.batch_size,
        },
        "accuracy": t.accuracy,
        "loss": t.loss,
        "model_path": t.model_path,
        "class_names": t.class_names,
    }
    if include_experiment:
        data["experiment_id"] = t.experiment_id
    return data