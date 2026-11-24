from typing import List, Dict, Any

FEATURE_NAMES = [
    "tab_hidden_count",
    "window_blur_count",
    "copy_paste_count",
    "fullscreen_exit_count",
    "devtools_attempt_count",
    "face_missing_count",
    "multi_face_count",
    "looking_away_count",
    "phone_detected_count",
    "external_indicator_count",
    "interaction_summary_ticks"
]

class BehaviouralFeatureExtractor:
    def extract_features(self, events: List[Dict[str, Any]]) -> Dict[str, float]:
        features = {name: 0.0 for name in FEATURE_NAMES}

        for evt in events:
            etype = evt.get("eventType", "")

            if etype == "TAB_HIDDEN":
                features["tab_hidden_count"] += 1.0
            elif etype == "WINDOW_BLUR":
                features["window_blur_count"] += 1.0
            elif etype in ("COPY_ATTEMPT", "PASTE_ATTEMPT"):
                features["copy_paste_count"] += 1.0
            elif etype == "FULLSCREEN_EXIT":
                features["fullscreen_exit_count"] += 1.0
            elif etype in ("DEVTOOLS_SHORTCUT", "EXTENSION_SHORTCUT_ATTEMPT", "UNAUTHORIZED_SHORTCUT"):
                features["devtools_attempt_count"] += 1.0
            elif etype == "NO_FACE_DETECTED":
                features["face_missing_count"] += 1.0
            elif etype == "MULTIPLE_FACES_DETECTED":
                features["multi_face_count"] += 1.0
            elif etype == "LOOKING_AWAY":
                features["looking_away_count"] += 1.0
            elif etype == "PHONE_DETECTED":
                features["phone_detected_count"] += 1.0
            elif etype in ("EXTERNAL_AI_INDICATOR", "UNAUTHORIZED_RESOURCE_INDICATOR", "EXTENSION_DOM_INJECTION", "VOICE_ACTIVITY_DETECTED"):
                features["external_indicator_count"] += 1.0
            elif etype == "INTERACTION_SUMMARY":
                meta = evt.get("metadata", {}) or {}
                ticks = meta.get("mouseMoveTicks", 0) + meta.get("keyPressCount", 0)
                features["interaction_summary_ticks"] += float(ticks)

        return features

    def to_vector(self, features: Dict[str, float]) -> List[float]:
        return [features[name] for name in FEATURE_NAMES]
