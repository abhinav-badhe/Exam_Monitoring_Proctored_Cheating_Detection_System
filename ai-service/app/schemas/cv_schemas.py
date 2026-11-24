from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class HeadPose(BaseModel):
    yaw: float
    pitch: float
    roll: float

class Anomaly(BaseModel):
    eventType: str
    severity: str
    description: str
    confidence: float
    metadata: Optional[Dict[str, Any]] = None

class AnalyzeFrameResponse(BaseModel):
    faceDetected: bool
    faceCount: int
    lookingAway: bool
    headPose: Optional[HeadPose] = None
    phoneDetected: bool
    phoneConfidence: float
    anomalies: List[Anomaly]
    processedTimestamp: str
