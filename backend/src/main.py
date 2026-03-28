from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import time
import uuid

from src.database import engine
from src.models import Base
from src.database import SessionLocal

from src.models import Train

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

#funcao de treinamento falso (simular o tempo de processamento)
def fake_training(train_id: str):
    db = SessionLocal()

    for i in range(10):
        time.sleep(1)

        train = db.query(Train).filter(Train.id == train_id).first()
        train.progress = (i + 1) * 10
        db.commit()

    train.status = "ready"
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

    background_tasks.add_task(fake_training, train_id)

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