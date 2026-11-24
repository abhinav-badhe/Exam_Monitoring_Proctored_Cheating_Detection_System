import numpy as np
from sklearn.ensemble import IsolationForest
from typing import List, Dict, Any, Tuple
from app.anomaly.feature_extractor import FEATURE_NAMES

class IsolationForestAnomalyModel:
    def __init__(self):
        self.model = IsolationForest(
            n_estimators=100,
            contamination=0.10,
            random_state=42
        )
        self.is_fitted = False
        self._fit_baseline()

    def _fit_baseline(self):
        """
        Fits on reference baseline distributions of candidate telemetry.
        """
        rng = np.random.default_rng(42)
        n_samples = 250
        n_features = len(FEATURE_NAMES)

        # Baseline: normal candidate exam session features
        # 0: tab_hidden (0-2)
        # 1: window_blur (0-2)
        # 2: copy_paste (0-1)
        # 3: fullscreen_exit (0-1)
        # 4: devtools (0)
        # 5: face_missing (0-2)
        # 6: multi_face (0)
        # 7: looking_away (0-3)
        # 8: phone (0)
        # 9: external_ai (0)
        # 10: interaction_ticks (200-800)
        normal_data = np.zeros((n_samples, n_features), dtype=float)
        normal_data[:, 0] = rng.integers(0, 3, size=n_samples)
        normal_data[:, 1] = rng.integers(0, 3, size=n_samples)
        normal_data[:, 2] = rng.integers(0, 2, size=n_samples)
        normal_data[:, 3] = rng.integers(0, 2, size=n_samples)
        normal_data[:, 4] = 0.0
        normal_data[:, 5] = rng.integers(0, 3, size=n_samples)
        normal_data[:, 6] = 0.0
        normal_data[:, 7] = rng.integers(0, 4, size=n_samples)
        normal_data[:, 8] = 0.0
        normal_data[:, 9] = 0.0
        normal_data[:, 10] = rng.integers(150, 750, size=n_samples)

        # 10% anomalous training samples
        n_anom = 25
        anom_data = np.zeros((n_anom, n_features), dtype=float)
        anom_data[:, 0] = rng.integers(4, 12, size=n_anom)
        anom_data[:, 1] = rng.integers(5, 15, size=n_anom)
        anom_data[:, 2] = rng.integers(3, 8, size=n_anom)
        anom_data[:, 4] = rng.integers(1, 4, size=n_anom)
        anom_data[:, 8] = rng.integers(1, 3, size=n_anom)
        anom_data[:, 9] = rng.integers(1, 4, size=n_anom)

        training_data = np.vstack([normal_data, anom_data])
        self.model.fit(training_data)
        self.is_fitted = True

    def predict_score(self, feature_vector: List[float]) -> float:
        """
        Returns normalized ML anomaly score between 0.0 and 100.0.
        Higher score = more anomalous behaviour.
        """
        if not self.is_fitted:
            return 0.0

        vec = np.array([feature_vector], dtype=float)
        # decision_function gives negative scores for outliers, positive for inliers
        raw_score = self.model.decision_function(vec)[0]

        # Inliers roughly in [0.05, 0.25], outliers in [-0.35, -0.05]
        # Normalizing to [0.0, 100.0]
        norm = (0.25 - raw_score) / 0.50
        ml_score = float(np.clip(norm * 100.0, 0.0, 100.0))
        return round(ml_score, 1)

    def evaluate_combined(
        self,
        features: Dict[str, float],
        rule_score: float,
        rule_violations: List[Dict[str, Any]]
    ) -> Tuple[float, str, Dict[str, Any]]:
        vec = [features[name] for name in FEATURE_NAMES]
        ml_score = self.predict_score(vec)

        # Weighted combination: 65% transparent rules, 35% unsupervised Isolation Forest
        final_score = round(min(100.0, 0.65 * rule_score + 0.35 * ml_score), 1)

        # Determine risk tier
        if final_score < 25.0:
            risk_level = "LOW"
        elif final_score < 50.0:
            risk_level = "MEDIUM"
        elif final_score < 75.0:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"

        explanation = {
            "finalScore": final_score,
            "riskLevel": risk_level,
            "ruleScore": rule_score,
            "mlIsolationForestScore": ml_score,
            "ruleViolations": rule_violations,
            "contributingFeatures": {k: v for k, v in features.items() if v > 0},
            "disclaimer": "ProctorAI anomaly scores serve as prioritisation aids for human examiner review; not definitive misconduct proof."
        }

        return final_score, risk_level, explanation
