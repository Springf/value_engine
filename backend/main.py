from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from api.routes import router as data_router

app = FastAPI(title="Value Engine API")

# Configure CORS
origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data_router)

@app.get("/")
def read_root():
    return {"message": "Value Engine API is running"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
