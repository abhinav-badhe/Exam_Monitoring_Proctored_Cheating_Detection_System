from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.anomaly.feature_extractor import BehaviouralFeatureExtractor
from app.anomaly.rule_engine import ProctorRuleEngine
from app.anomaly.isolation_forest_model import IsolationForestAnomalyModel

router = APIRouter(prefix="/api/anomaly", tags=["Anomaly Detection"])

extractor = BehaviouralFeatureExtractor()
rule_engine = ProctorRuleEngine()
iso_forest = IsolationForestAnomalyModel()

class EvaluateSessionRequest(BaseModel):
    attemptId: str
    events: List[Dict[str, Any]]

class EvaluateSessionResponse(BaseModel):
    attemptId: str
    score: float
    riskLevel: str
    explanation: Dict[str, Any]
    modelVersion: str

@router.post("/evaluate-session", response_model=EvaluateSessionResponse)
def evaluate_session(payload: EvaluateSessionRequest):
    features = extractor.extract_features(payload.events)
    rule_score, rule_violations = rule_engine.evaluate(payload.events, features)
    final_score, risk_level, explanation = iso_forest.evaluate_combined(
        features,
        rule_score,
        rule_violations
    )

    return EvaluateSessionResponse(
        attemptId=payload.attemptId,
        score=final_score,
        riskLevel=risk_level,
        explanation=explanation,
        modelVersion="IsolationForest-Rules-v1.0"
    )
