from sqlalchemy import Column, String, Integer, Float, Boolean, JSON, ForeignKey
from .database import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    path = Column(String)
    classes = Column(JSON)  # Lista de nomes das classes
    num_classes = Column(Integer)
    input_shape = Column(JSON)  # Formato da entrada (ex: [224, 224, 3])
    num_images = Column(Integer)

class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=True)
    architecture = Column(String, default="simple")
    created_at = Column(String)  # Timestamp de criação

class Train(Base):
    __tablename__ = "trains"

    id = Column(String, primary_key=True, index=True)
    experiment_id = Column(String, ForeignKey("experiments.id"), nullable=True)
    epochs = Column(Integer)
    learning_rate = Column(Float)
    batch_size = Column(Integer)
    early_stopping = Column(Boolean, default=False)
    data_augmentation = Column(Boolean, default=False)
    
    status = Column(String)
    progress = Column(Integer)

    accuracy = Column(Float, nullable=True)
    loss = Column(Float, nullable=True)
    model_path = Column(String, nullable=True)
    class_names = Column(JSON, nullable=True)
    
    # Additional metrics
    precision = Column(JSON, nullable=True)  # List of precision values per class
    recall = Column(JSON, nullable=True)  # List of recall values per class
    f1_score = Column(JSON, nullable=True)  # List of f1-score values per class
    confusion_matrix = Column(JSON, nullable=True)  # 2D array representing confusion matrix