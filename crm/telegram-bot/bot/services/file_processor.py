"""
File Processing Service
Excel, PDF, CSV, Image parsing
"""

import logging
import os
import tempfile
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class FileAnalysis:
    """File analysis result"""

    extracted_text: str
    summary: str
    data: Optional[Dict]
    error: Optional[str]
    processing_time_ms: int


class FileProcessor:
    """Service for processing uploaded files"""

    def __init__(self):
        self.supported_types = {
            "xlsx": self.process_excel,
            "xls": self.process_excel,
            "csv": self.process_csv,
            "pdf": self.process_pdf,
            "png": self.process_image,
            "jpg": self.process_image,
            "jpeg": self.process_image,
        }

    async def process_file(
        self, bot, file_id: str, file_type: str, file_name: Optional[str] = None
    ) -> FileAnalysis:
        """
        Process uploaded file based on type

        Args:
            bot: Telegram bot instance
            file_id: Telegram file_id
            file_type: MIME type or extension
            file_name: Original file name

        Returns:
            FileAnalysis with extracted data
        """
        import time

        start_time = time.time()

        # Determine processor
        ext = file_type.lower().split("/")[-1]  # e.g., "application/pdf" -> "pdf"
        if "." in (file_name or ""):
            ext = file_name.rsplit(".", 1)[-1].lower()

        processor = self.supported_types.get(ext)

        if not processor:
            return FileAnalysis(
                extracted_text="",
                summary=f"Тип файлу {ext} не підтримується",
                data=None,
                error=f"Unsupported file type: {ext}",
                processing_time_ms=int((time.time() - start_time) * 1000),
            )

        try:
            # Download file from Telegram
            file_path, file_size = await self._download_file(bot, file_id, ext)
            if not file_path:
                return FileAnalysis(
                    extracted_text="",
                    summary="Помилка завантаження файлу",
                    data=None,
                    error="Failed to download file",
                    processing_time_ms=int((time.time() - start_time) * 1000),
                )

            # Process
            result = await processor(file_path, file_name)

            # Cleanup
            try:
                os.remove(file_path)
            except:
                pass

            result.processing_time_ms = int((time.time() - start_time) * 1000)
            return result

        except Exception as e:
            logger.error(f"File processing error: {e}")
            return FileAnalysis(
                extracted_text="",
                summary="Помилка обробки файлу",
                data=None,
                error=str(e),
                processing_time_ms=int((time.time() - start_time) * 1000),
            )

    async def _download_file(
        self, bot, file_id: str, ext: str
    ) -> Tuple[Optional[str], Optional[int]]:
        """Download file from Telegram"""
        try:
            file = await bot.get_file(file_id)

            temp_dir = os.path.join(tempfile.gettempdir(), "telegram_files")
            os.makedirs(temp_dir, exist_ok=True)

            file_path = os.path.join(temp_dir, f"{file_id}.{ext}")
            await file.download_to_drive(file_path)

            file_size = os.path.getsize(file_path)
            logger.info(f"Downloaded {file_path} ({file_size} bytes)")

            return file_path, file_size

        except Exception as e:
            logger.error(f"Download error: {e}")
            return None, None

    async def process_excel(
        self, file_path: str, file_name: Optional[str] = None
    ) -> FileAnalysis:
        """Process Excel file"""
        import pandas as pd

        try:
            # Read all sheets
            excel_file = pd.ExcelFile(file_path)
            sheets = {}

            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(excel_file, sheet_name=sheet_name)
                sheets[sheet_name] = df

            # Build text representation
            text_parts = []
            for sheet_name, df in sheets.items():
                text_parts.append(f"\n=== Аркуш: {sheet_name} ===\n")
                text_parts.append(df.to_string(max_rows=50))

            extracted_text = "".join(text_parts)

            # Summary
            total_rows = sum(len(df) for df in sheets.values())
            total_cols = sum(len(df.columns) for df in sheets.values())

            summary = f"📊 Excel файл: {len(sheets)} аркушів, {total_rows} рядків, {total_cols} колонок"

            # JSON data
            data = {
                "sheets": {
                    name: df.head(20).to_dict(orient="records")
                    for name, df in sheets.items()
                },
                "metadata": {
                    "total_sheets": len(sheets),
                    "total_rows": total_rows,
                    "columns": {name: list(df.columns) for name, df in sheets.items()},
                },
            }

            return FileAnalysis(
                extracted_text=extracted_text,
                summary=summary,
                data=data,
                error=None,
                processing_time_ms=0,
            )

        except Exception as e:
            logger.error(f"Excel processing error: {e}")
            return FileAnalysis(
                extracted_text="",
                summary="Помилка обробки Excel",
                data=None,
                error=str(e),
                processing_time_ms=0,
            )

    async def process_csv(
        self, file_path: str, file_name: Optional[str] = None
    ) -> FileAnalysis:
        """Process CSV file"""
        import pandas as pd

        try:
            df = pd.read_csv(file_path)

            extracted_text = df.to_string(max_rows=100)

            summary = f"📄 CSV файл: {len(df)} рядків, {len(df.columns)} колонок\nКолонки: {', '.join(df.columns[:10].tolist())}"

            data = {
                "rows": len(df),
                "columns": list(df.columns),
                "data": df.head(20).to_dict(orient="records"),
            }

            return FileAnalysis(
                extracted_text=extracted_text,
                summary=summary,
                data=data,
                error=None,
                processing_time_ms=0,
            )

        except Exception as e:
            logger.error(f"CSV processing error: {e}")
            return FileAnalysis(
                extracted_text="",
                summary="Помилка обробки CSV",
                data=None,
                error=str(e),
                processing_time_ms=0,
            )

    async def process_pdf(
        self, file_path: str, file_name: Optional[str] = None
    ) -> FileAnalysis:
        """Process PDF file"""
        try:
            import pdfplumber

            text_parts = []
            tables = []

            with pdfplumber.open(file_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    text = page.extract_text()
                    if text:
                        text_parts.append(f"\n=== Сторінка {page_num + 1} ===\n{text}")

                    # Extract tables
                    page_tables = page.extract_tables()
                    for table in page_tables:
                        tables.append({"page": page_num + 1, "data": table})

            extracted_text = "\n".join(text_parts)

            summary = f"📑 PDF файл: {len(pdf.pages)} сторінок"

            data = {"pages": len(pdf.pages), "tables_count": len(tables)}

            return FileAnalysis(
                extracted_text=extracted_text[:10000],  # Limit size
                summary=summary,
                data=data,
                error=None,
                processing_time_ms=0,
            )

        except Exception as e:
            logger.error(f"PDF processing error: {e}")
            return FileAnalysis(
                extracted_text="",
                summary="Помилка обробки PDF",
                data=None,
                error=str(e),
                processing_time_ms=0,
            )

    async def process_image(
        self, file_path: str, file_name: Optional[str] = None
    ) -> FileAnalysis:
        """Process image with OCR"""
        try:
            from PIL import Image
            import pytesseract

            # Open image
            img = Image.open(file_path)

            # OCR
            text = pytesseract.image_to_string(img, lang="uk+eng")

            summary = f"🖼️ Зображення: {img.size[0]}x{img.size[1]} пікселів"

            return FileAnalysis(
                extracted_text=text,
                summary=summary,
                data={"width": img.size[0], "height": img.size[1]},
                error=None,
                processing_time_ms=0,
            )

        except ImportError:
            return FileAnalysis(
                extracted_text="",
                summary="OCR не налаштовано",
                data=None,
                error="pytesseract not installed",
                processing_time_ms=0,
            )
        except Exception as e:
            logger.error(f"Image processing error: {e}")
            return FileAnalysis(
                extracted_text="",
                summary="Помилка обробки зображення",
                data=None,
                error=str(e),
                processing_time_ms=0,
            )


file_processor = FileProcessor()
