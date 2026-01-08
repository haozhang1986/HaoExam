import hashlib
import os

from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from .config import logger

# Monkey-patch hashlib.md5 to support 'usedforsecurity' kwarg ignored in Python 3.7 but used by ReportLab
if hasattr(hashlib, 'md5'):
    _original_md5 = hashlib.md5
    def _patched_md5(*args, **kwargs):
        kwargs.pop('usedforsecurity', None)
        return _original_md5(*args, **kwargs)
    hashlib.md5 = _patched_md5

def generate_worksheet(questions, output, include_answers: bool = False):
    """
    Generates a PDF worksheet from a list of Question objects.
    output: Filename (str) or file-like object (BytesIO)
    """
    c = canvas.Canvas(output, pagesize=A4)
    width, height = A4 # 595.27, 841.89 points

    margin = 40
    label_height = 20  # Height for question label
    current_y = height - margin
    available_width = width - 2 * margin
    available_height = height - 2 * margin - label_height  # Max height for image on a single page
    page_has_content = False  # Track if current page has any content

    for i, q in enumerate(questions):
        # 1. Process Question Image
        img_path = q.question_image_path

        # Resolve to absolute path
        if not os.path.isabs(img_path):
             # Assuming running from backend/
             # Check if exists relative to CWD
             if not os.path.exists(img_path):
                 # Try relative to parent (if running from app/)
                 alt_path = os.path.join("..", img_path)
                 if os.path.exists(alt_path):
                     img_path = alt_path

        # Convert to absolute for safety
        img_path = os.path.abspath(img_path)

        if not os.path.exists(img_path):
            logger.warning(f"Image not found: {img_path}")
            # Draw placeholder text
            c.drawString(margin, current_y - 20, f"Q{i+1}: Image not found")
            current_y -= 40
            page_has_content = True
            continue

        try:
            # Open with PIL first to verify and handle format
            with Image.open(img_path) as pil_img:
                img_w, img_h = pil_img.size
                aspect = img_h / float(img_w)

                # Scale to fit width first
                display_w = available_width
                display_h = display_w * aspect

                # If image is too tall, scale down to fit available height
                if display_h > available_height:
                    display_h = available_height
                    display_w = display_h / aspect

                # Calculate total space needed (label + image + spacing)
                total_needed = label_height + display_h + 20

                # Check if it fits on current page
                if current_y - total_needed < margin:
                    # Only create new page if current page has content
                    if page_has_content:
                        c.showPage()
                        current_y = height - margin
                        page_has_content = False

                # Add Question Number/Label
                label = f"Q{i+1} [ID: {q.id}]"
                if q.question_number:
                    label += f" ({q.question_number})"
                c.drawString(margin, current_y - 15, label)
                current_y -= label_height

                # Use ImageReader for ReportLab
                # This isolates ReportLab from file I/O issues
                img_reader = ImageReader(pil_img)

                # Draw Image
                c.drawImage(img_reader, margin, current_y - display_h, width=display_w, height=display_h)

                current_y -= (display_h + 20) # Add spacing
                page_has_content = True
            
            # 2. Process Answer (if requested)
            if include_answers and q.answer_image_path:
                ans_path = q.answer_image_path

                # Resolve path
                if not os.path.isabs(ans_path):
                    if not os.path.exists(ans_path):
                        alt_path = os.path.join("..", ans_path)
                        if os.path.exists(alt_path):
                            ans_path = alt_path

                ans_path = os.path.abspath(ans_path)

                if os.path.exists(ans_path):
                    # Draw "--- Answer ---" separator
                    separator_height = 25

                    with Image.open(ans_path) as ans_pil:
                        ans_w, ans_h = ans_pil.size
                        ans_aspect = ans_h / float(ans_w)

                        ans_display_w = available_width
                        ans_display_h = ans_display_w * ans_aspect

                        # If answer image is too tall, scale down to fit
                        if ans_display_h > available_height - separator_height:
                            ans_display_h = available_height - separator_height
                            ans_display_w = ans_display_h / ans_aspect

                        # Check if separator + answer fits
                        total_ans_needed = separator_height + ans_display_h + 20
                        if current_y - total_ans_needed < margin:
                            if page_has_content:
                                c.showPage()
                                current_y = height - margin
                                page_has_content = False

                        # Draw separator line and text
                        c.setStrokeColorRGB(0.4, 0.4, 0.4)
                        c.setFillColorRGB(0.4, 0.4, 0.4)
                        line_y = current_y - 12
                        c.line(margin, line_y, margin + 60, line_y)
                        c.setFont("Helvetica-Bold", 10)
                        c.drawString(margin + 65, line_y - 4, "Answer")
                        c.line(margin + 110, line_y, width - margin, line_y)
                        c.setFont("Helvetica", 12)  # Reset font
                        c.setFillColorRGB(0, 0, 0)  # Reset color
                        current_y -= separator_height

                        ans_reader = ImageReader(ans_pil)
                        c.drawImage(ans_reader, margin, current_y - ans_display_h, width=ans_display_w, height=ans_display_h)
                        current_y -= (ans_display_h + 20)
                        page_has_content = True

        except Exception as e:
            logger.error(f"Error processing image for Q{q.id}: {e}")
            c.drawString(margin, current_y - 20, f"Error loading Q{i+1}")
            current_y -= 40

    try:
        c.save()
    except Exception as e:
        logger.error(f"PDF Save Error: {e}", exc_info=True)
        raise e
