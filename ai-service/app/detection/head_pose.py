import numpy as np
from typing import Tuple, Dict, Optional

class HeadPoseEstimator:
    def __init__(self):
        pass

    def estimate_pose(self, image_bgr: np.ndarray, face_box: Optional[list]) -> Tuple[Dict[str, float], bool]:
        """
        Estimates yaw, pitch, roll and returns:
        ({yaw, pitch, roll}, looking_away_flag)
        """
        if face_box is None:
            return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, False

        h, w, _ = image_bgr.shape
        fx, fy, fw, fh = face_box

        # Center of face
        face_cx = fx + (fw / 2.0)
        face_cy = fy + (fh / 2.0)

        # Frame center
        frame_cx = w / 2.0
        frame_cy = h / 2.0

        # Normalized offsets from center (-1.0 to 1.0)
        norm_x = (face_cx - frame_cx) / (w / 2.0)
        norm_y = (face_cy - frame_cy) / (h / 2.0)

        # Approximate yaw and pitch degrees
        yaw = float(norm_x * 45.0)
        pitch = float(norm_y * 35.0)
        roll = 0.0

        # Looking away threshold: excessive horizontal or vertical deviation from center
        looking_away = abs(yaw) > 28.0 or abs(pitch) > 25.0

        return {
            "yaw": round(yaw, 2),
            "pitch": round(pitch, 2),
            "roll": round(roll, 2)
        }, looking_away
