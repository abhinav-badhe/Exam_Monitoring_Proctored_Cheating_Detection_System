from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.cv_routes import router as cv_router

app = FastAPI(
    title="ProctorAI Computer Vision & Anomaly Detection Service",
    description="Python microservice providing real-time face, head pose, mobile device, and anomaly detection.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "proctor-ai-service",
        "version": "1.0.0",
        "cv_pipeline": "operational"
    }

app.include_router(cv_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
