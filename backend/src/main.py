from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import time
import uuid

from src.database import engine
from src.models import Base
from src.database import SessionLocal

from src.models import Train

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

def real_training(train_id: str):
    db = SessionLocal()

    train = db.query(Train).filter(Train.id == train_id).first()

    # carregar MNIST
    (x_train, y_train), (x_test, y_test) = keras.datasets.mnist.load_data()

    # normalizar
    x_train = x_train / 255.0
    x_test = x_test / 255.0

    # modelo simples
    model = keras.Sequential([
        keras.layers.Flatten(input_shape=(28, 28)),
        keras.layers.Dense(128, activation="relu"),
        keras.layers.Dense(10, activation="softmax")
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

    train.status = "ready"
    train.progress = 100
    train.accuracy = float(accuracy)
    train.loss = float(loss)

    db.commit()
    db.close()

@app.post("/train")
def create_train(params: TrainParams, background_tasks: BackgroundTasks):
    db = SessionLocal()

    train_id = str(uuid.uuid4())

    new_train = Train(
        id=train_id,
        epochs=params.epochs,
        learning_rate=params.learning_rate,
        batch_size=params.batch_size,
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
            }
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
        }
    }