import cv2
import numpy as np
from typing import Tuple, List, Dict, Any

class FaceDetector:
    def __init__(self):
        # Load Haar Cascade as a guaranteed local fallback
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self.cascade = cv2.CascadeClassifier(cascade_path)
        self.mediapipe_detector = None
        self._init_mediapipe()

    def _init_mediapipe(self):
        try:
            import mediapipe as mp
            # Use solutions.face_detection if available
            if hasattr(mp, "solutions") and hasattr(mp.solutions, "face_detection"):
                self.mp_face = mp.solutions.face_detection
                self.mediapipe_detector = self.mp_face.FaceDetection(
                    min_detection_confidence=0.5,
                    model_selection=0
                )
        except Exception as e:
            print(f"[FaceDetector] MediaPipe solutions init notice: {e}, using OpenCV Cascade fallback")

    def detect_faces(self, image_bgr: np.ndarray) -> Tuple[int, List[Dict[str, Any]]]:
        h, w, _ = image_bgr.shape
        faces_out = []

        # Try MediaPipe first
        if self.mediapipe_detector is not None:
            try:
                rgb_img = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
                results = self.mediapipe_detector.process(rgb_img)
                if results and results.detections:
                    for det in results.detections:
                        score = det.score[0] if det.score else 0.8
                        bbox = det.location_data.relative_bounding_box
                        x = int(bbox.xmin * w)
                        y = int(bbox.ymin * h)
                        box_w = int(bbox.width * w)
                        box_h = int(bbox.height * h)
                        faces_out.append({
                            "box": [max(0, x), max(0, y), box_w, box_h],
                            "confidence": float(score)
                        })
                    return len(faces_out), faces_out
            except Exception as e:
                pass

        # OpenCV Haar Cascade fallback
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        detected = self.cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )

        for (x, y, bw, bh) in detected:
            faces_out.append({
                "box": [int(x), int(y), int(bw), int(bh)],
                "confidence": 0.85
            })

        return len(faces_out), faces_out
