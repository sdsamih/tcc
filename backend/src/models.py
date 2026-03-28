from sqlalchemy import Column, String, Integer, Float
from .database import Base

class Train(Base):
    __tablename__ = "trains"

    id = Column(String, primary_key=True, index=True)
    epochs = Column(Integer)
    learning_rate = Column(Float)
    batch_size = Column(Integer)

    status = Column(String)
    progress = Column(Integer)