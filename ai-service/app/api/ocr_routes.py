import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.ocr.ocr_service import ScreenOCRService

router = APIRouter(prefix="/api/ocr", tags=["Screen OCR & External AI Detection"])

ocr_service = ScreenOCRService()

@router.post("/analyze-screen")
async def analyze_screen(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise HTTPException(status_code=400, detail="Could not decode screen image from uploaded payload")

        results = ocr_service.extract_and_analyze(image)
        return results

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Screen OCR analysis failure: {str(e)}")
