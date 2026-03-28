from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import time
import uuid

app = FastAPI()
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
    for i in range(10): #atualiza o progresso do treinamento (na memória), 10%/s
        time.sleep(1)
        trains[train_id]["progress"] = (i + 1) * 10

    #quando acabar, marca como ready
    trains[train_id]["status"] = "ready"

@app.post("/train") #iniciar um treino
def create_train(params: TrainParams, background_tasks: BackgroundTasks):
    train_id = str(uuid.uuid4()) #atribui um id

    trains[train_id] = { #adiciona o treino novo na memória
        "id": train_id,
        "params": params.model_dump(),
        "status": "training",
        "progress": 0
    }

    background_tasks.add_task(fake_training, train_id)

    return {"train_id": train_id}

@app.get("/train") #listar os treinos existentes
def list_trains():
    return list(trains.values())

@app.get("/train/{train_id}") #retornar um treino por id específico
def get_train(train_id: str):
    return trains.get(train_id)