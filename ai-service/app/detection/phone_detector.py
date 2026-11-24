import numpy as np
from typing import Tuple, Optional, List

class PhoneDetector:
    def __init__(self):
        self.model = None
        self._init_yolo()

    def _init_yolo(self):
        try:
            from ultralytics import YOLO
            # Load the lightweight nano model
            self.model = YOLO("yolov8n.pt")
            print("[PhoneDetector] YOLOv8n initialized successfully.")
        except Exception as e:
            print(f"[PhoneDetector] YOLO initialization deferred/notice: {e}")

    def detect_phone(self, image_bgr: np.ndarray) -> Tuple[bool, float, Optional[List[int]]]:
        """
        Detects visible mobile phone / cell phone in the frame.
        Returns: (phone_detected, confidence, bounding_box)
        """
        if self.model is None:
            return False, 0.0, None

        try:
            results = self.model(image_bgr, verbose=False)
            if not results or len(results) == 0:
                return False, 0.0, None

            boxes = results[0].boxes
            if boxes is None or len(boxes) == 0:
                return False, 0.0, None

            names = results[0].names  # Class names mapping
            for box in boxes:
                cls_id = int(box.cls[0])
                cls_name = names.get(cls_id, "").lower()
                conf = float(box.conf[0])

                if ("cell phone" in cls_name or "phone" in cls_name or cls_id == 67) and conf >= 0.40:
                    xyxy = box.xyxy[0].tolist()
                    box_coords = [int(xyxy[0]), int(xyxy[1]), int(xyxy[2] - xyxy[0]), int(xyxy[3] - xyxy[1])]
                    return True, round(conf, 3), box_coords

            return False, 0.0, None
        except Exception as e:
            print(f"[PhoneDetector] Detection error: {e}")
            return False, 0.0, None
