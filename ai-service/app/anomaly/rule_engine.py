from typing import List, Dict, Any, Tuple
from datetime import datetime

class ProctorRuleEngine:
    def evaluate(self, events: List[Dict[str, Any]], features: Dict[str, float]) -> Tuple[float, List[Dict[str, Any]]]:
        violations = []
        rule_points = 0.0

        # Sort events by timestamp if available
        sorted_events = sorted(
            events,
            key=lambda e: e.get("createdAt") or e.get("timestamp") or ""
        )

        # Rule 1: Window Blur / Tab Hidden followed closely by a Paste Attempt
        blur_timestamps = []
        for evt in sorted_events:
            etype = evt.get("eventType", "")
            ts_str = evt.get("createdAt") or evt.get("timestamp")
            if not ts_str:
                continue

            try:
                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            except Exception:
                continue

            if etype in ("WINDOW_BLUR", "TAB_HIDDEN"):
                blur_timestamps.append(dt)
            elif etype == "PASTE_ATTEMPT":
                # Check if any blur happened in preceding 20 seconds
                for b_dt in blur_timestamps[-5:]:
                    diff_sec = (dt - b_dt).total_seconds()
                    if 0 <= diff_sec <= 20:
                        violations.append({
                            "rule": "BLUR_PASTE_SEQUENCE",
                            "severity": "HIGH",
                            "points": 25.0,
                            "explanation": f"Candidate pasted content within {diff_sec:.1f}s of returning from window/tab switch."
                        })
                        rule_points += 25.0
                        break

        # Rule 2: Multi-Face + Mobile Phone
        if features.get("multi_face_count", 0) > 0 and features.get("phone_detected_count", 0) > 0:
            violations.append({
                "rule": "MULTI_FACE_AND_PHONE",
                "severity": "CRITICAL",
                "points": 35.0,
                "explanation": "Concurrent indication of multiple individuals and visible mobile device."
            })
            rule_points += 35.0

        # Rule 3: DevTools & Extension Shortcuts
        devtools_count = features.get("devtools_attempt_count", 0)
        if devtools_count > 0:
            violations.append({
                "rule": "DEVTOOLS_INSPECTION_ATTEMPT",
                "severity": "HIGH",
                "points": 20.0,
                "explanation": f"Candidate attempted unauthorized inspection or browser extension shortcuts ({int(devtools_count)} time(s))."
            })
            rule_points += 20.0

        # Rule 4: External AI Tool Indicators
        ext_count = features.get("external_indicator_count", 0)
        if ext_count > 0:
            violations.append({
                "rule": "EXTERNAL_AI_ASSISTANT_INDICATOR",
                "severity": "HIGH",
                "points": 30.0,
                "explanation": f"Visible external AI assistant or unauthorized tool indicators detected on screen ({int(ext_count)} time(s))."
            })
            rule_points += 30.0

        # Rule 5: Frequent Tab / Window Switches
        tab_blur_total = features.get("tab_hidden_count", 0) + features.get("window_blur_count", 0)
        if tab_blur_total >= 4:
            violations.append({
                "rule": "FREQUENT_FOCUS_LOSS",
                "severity": "MEDIUM",
                "points": 15.0,
                "explanation": f"Candidate repeatedly navigated away from examination window ({int(tab_blur_total)} switches)."
            })
            rule_points += 15.0

        # Rule 6: Prolonged Face Missing
        face_missing = features.get("face_missing_count", 0)
        if face_missing >= 3:
            violations.append({
                "rule": "PROLONGED_FACE_ABSENCE",
                "severity": "MEDIUM",
                "points": 15.0,
                "explanation": f"Candidate face was absent from camera frame across multiple intervals ({int(face_missing)} times)."
            })
            rule_points += 15.0

        normalized_score = min(100.0, rule_points)
        return normalized_score, violations
