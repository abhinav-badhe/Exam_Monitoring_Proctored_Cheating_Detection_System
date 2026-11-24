import re
import cv2
import numpy as np
from typing import Dict, Any, List, Tuple

AI_ASSISTANT_INDICATORS = [
    "chatgpt", "openai", "claude", "anthropic", "gemini",
    "copilot", "perplexity", "deepseek", "chat.openai", "claude.ai"
]

UNAUTHORIZED_STUDY_INDICATORS = [
    "chegg", "coursehero", "course hero", "brainly", "quizlet", "stackoverflow"
]

class ScreenOCRService:
    def __init__(self):
        self.reader = None
        self._init_reader()

    def _init_reader(self):
        try:
            import easyocr
            # Initialize English reader on CPU
            self.reader = easyocr.Reader(['en'], gpu=False, verbose=False)
            print("[ScreenOCRService] EasyOCR reader initialized successfully.")
        except Exception as e:
            print(f"[ScreenOCRService] EasyOCR initialization notice: {e}")

    def extract_and_analyze(self, image_bgr: np.ndarray) -> Dict[str, Any]:
        """
        Runs OCR on screen frame and detects visible external reference indicators.
        Returns explainable anomaly records.
        """
        h, w, _ = image_bgr.shape
        detected_text = ""
        matched_indicators: List[Dict[str, Any]] = []

        if self.reader is not None:
            try:
                # Downscale if screen resolution is very large to speed up OCR
                if w > 1280:
                    scale = 1280.0 / w
                    image_proc = cv2.resize(image_bgr, (1280, int(h * scale)))
                else:
                    image_proc = image_bgr

                ocr_results = self.reader.readtext(image_proc)
                text_lines = []
                for bbox, text, conf in ocr_results:
                    if conf >= 0.25:
                        text_lines.append(text)

                detected_text = " ".join(text_lines)
            except Exception as e:
                print(f"[ScreenOCRService] OCR processing error: {e}")

        # Scan for sensitive indicators in lowercase text
        text_lower = detected_text.lower()

        # Check AI Assistants
        for kw in AI_ASSISTANT_INDICATORS:
            if re.search(r'\b' + re.escape(kw) + r'\b', text_lower) or kw in text_lower:
                matched_indicators.append({
                    "category": "EXTERNAL_AI_ASSISTANT",
                    "keyword": kw,
                    "confidence": 0.88
                })

        # Check Unauthorized Study Platforms
        for kw in UNAUTHORIZED_STUDY_INDICATORS:
            if re.search(r'\b' + re.escape(kw) + r'\b', text_lower) or kw in text_lower:
                matched_indicators.append({
                    "category": "UNAUTHORIZED_STUDY_RESOURCE",
                    "keyword": kw,
                    "confidence": 0.85
                })

        # Format explainable anomalies
        anomalies = []
        for match in matched_indicators:
            cat = match["category"]
            kw = match["keyword"]
            if cat == "EXTERNAL_AI_ASSISTANT":
                anomalies.append({
                    "eventType": "EXTERNAL_AI_INDICATOR",
                    "severity": "HIGH",
                    "description": f"Visible external AI assistant indicator ('{kw}') identified on shared screen.",
                    "confidence": match["confidence"],
                    "metadata": {
                        "matchedKeyword": kw,
                        "category": cat,
                        "disclaimer": "Visible screen indicator only; subject to human examiner review."
                    }
                })
            else:
                anomalies.append({
                    "eventType": "UNAUTHORIZED_RESOURCE_INDICATOR",
                    "severity": "HIGH",
                    "description": f"Visible study/homework repository reference ('{kw}') identified on shared screen.",
                    "confidence": match["confidence"],
                    "metadata": {
                        "matchedKeyword": kw,
                        "category": cat,
                        "disclaimer": "Visible screen indicator only; subject to human examiner review."
                    }
                })

        return {
            "hasIndicators": len(anomalies) > 0,
            "detectedTextSnippet": detected_text[:300] if detected_text else "",
            "matchedCount": len(matched_indicators),
            "anomalies": anomalies
        }
