import cv2
import numpy as np
from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.schemas.cv_schemas import AnalyzeFrameResponse, Anomaly, HeadPose
from app.detection.face_detector import FaceDetector
from app.detection.head_pose import HeadPoseEstimator
from app.detection.phone_detector import PhoneDetector

router = APIRouter(prefix="/api/cv", tags=["Computer Vision"])

face_detector = FaceDetector()
head_pose_estimator = HeadPoseEstimator()
phone_detector = PhoneDetector()

@router.post("/analyze-frame", response_model=AnalyzeFrameResponse)
async def analyze_frame(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise HTTPException(status_code=400, detail="Could not decode image from uploaded file")

        # 1. Face Detection
        face_count, faces = face_detector.detect_faces(image)
        primary_face_box = faces[0]["box"] if face_count > 0 else None

        # 2. Head Pose & Looking Away
        head_pose_dict, looking_away = head_pose_estimator.estimate_pose(image, primary_face_box)

        # 3. Mobile Phone Detection
        phone_detected, phone_conf, phone_box = phone_detector.detect_phone(image)

        # 4. Synthesize Explainable Anomalies
        anomalies = []

        if face_count == 0:
            anomalies.append(Anomaly(
                eventType="NO_FACE_DETECTED",
                severity="HIGH",
                description="No face detected in candidate camera frame.",
                confidence=0.90
            ))
        elif face_count > 1:
            anomalies.append(Anomaly(
                eventType="MULTIPLE_FACES_DETECTED",
                severity="HIGH",
                description=f"Multiple individuals ({face_count} faces) visible in camera frame.",
                confidence=0.88,
                metadata={"faceCount": face_count}
            ))

        if face_count == 1 and looking_away:
            anomalies.append(Anomaly(
                eventType="LOOKING_AWAY",
                severity="MEDIUM",
                description="Head pose indicated looking away from examination display.",
                confidence=0.75,
                metadata=head_pose_dict
            ))

        if phone_detected:
            anomalies.append(Anomaly(
                eventType="PHONE_DETECTED",
                severity="CRITICAL",
                description=f"Mobile electronic device visible in frame (confidence: {phone_conf * 100:.1f}%).",
                confidence=phone_conf,
                metadata={"box": phone_box}
            ))

        return AnalyzeFrameResponse(
            faceDetected=face_count > 0,
            faceCount=face_count,
            lookingAway=looking_away,
            headPose=HeadPose(**head_pose_dict),
            phoneDetected=phone_detected,
            phoneConfidence=phone_conf,
            anomalies=anomalies,
            processedTimestamp=datetime.now(timezone.utc).isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Frame processing error: {str(e)}")
