import hashlib
# Monkey-patch hashlib.md5 to support 'usedforsecurity' kwarg ignored in Python 3.7 but used by ReportLab
if hasattr(hashlib, 'md5'):
    _original_md5 = hashlib.md5
    def _patched_md5(*args, **kwargs):
        kwargs.pop('usedforsecurity', None)
        return _original_md5(*args, **kwargs)
    hashlib.md5 = _patched_md5

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from PIL import Image
import os

def generate_worksheet(questions, output, include_answers: bool = False):
    """
    Generates a PDF worksheet from a list of Question objects.
    output: Filename (str) or file-like object (BytesIO)
    """
    c = canvas.Canvas(output, pagesize=A4)
    width, height = A4 # 595.27, 841.89 points
    
    margin = 40
    current_y = height - margin
    available_width = width - 2 * margin
    
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
            print(f"Warning: Image not found: {img_path}")
            # Draw placeholder text
            c.drawString(margin, current_y - 20, f"Q{i+1}: Image not found")
            current_y -= 40
            continue

        try:
            # Open with PIL first to verify and handle format
            with Image.open(img_path) as pil_img:
                img_w, img_h = pil_img.size
                aspect = img_h / float(img_w)
                
                # Scale to fit width
                display_w = available_width
                display_h = display_w * aspect
                
                # Check if it fits
                if current_y - display_h < margin:
                    c.showPage()
                    current_y = height - margin
                
                # Use ImageReader for ReportLab
                # This isolates ReportLab from file I/O issues
                img_reader = ImageReader(pil_img)
                
                # Draw Image
                c.drawImage(img_reader, margin, current_y - display_h, width=display_w, height=display_h)
                
                # Add Question Number/Label
                c.drawString(margin, current_y + 5, f"Q{i+1} [ID: {q.id}] ({q.question_number or '?'})")
                
                current_y -= (display_h + 20) # Add spacing
            
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
                    with Image.open(ans_path) as ans_pil:
                        ans_w, ans_h = ans_pil.size
                        ans_aspect = ans_h / float(ans_w)
                        
                        ans_display_w = available_width
                        ans_display_h = ans_display_w * ans_aspect
                        
                        if current_y - ans_display_h < margin:
                            c.showPage()
                            current_y = height - margin
                            
                        ans_reader = ImageReader(ans_pil)
                        c.drawImage(ans_reader, margin, current_y - ans_display_h, width=ans_display_w, height=ans_display_h)
                        current_y -= (ans_display_h + 20)

        except Exception as e:
            print(f"Error processing image for Q{q.id}: {e}")
            c.drawString(margin, current_y - 20, f"Error loading Q{i+1}")
            current_y -= 40
 
    try:
        c.save()
    except Exception as e:
        with open("debug_log.txt", "a") as f:
            f.write(f"PDF Save Error: {e}\n")
        raise e
