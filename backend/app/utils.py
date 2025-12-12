from PIL import Image
from typing import List
from fastapi import UploadFile
import io

def stitch_images(upload_files: List[UploadFile]) -> Image.Image:
    """
    Stitches a list of UploadFiles vertically into a single image.
    """
    if not upload_files:
        return None
    
    images = []
    for file in upload_files:
        # Read file content
        content = file.file.read()
        # Reset file cursor for safety (though we likely won't read it again here)
        file.file.seek(0)
        images.append(Image.open(io.BytesIO(content)))
    
    if not images:
        return None

    # Calculate total width and height
    # Width = max width of all images
    # Height = sum of all heights
    max_width = max(img.width for img in images)
    total_height = sum(img.height for img in images)
    
    # Create new blank image
    # RGB mode, white background
    new_im = Image.new('RGB', (max_width, total_height), (255, 255, 255))
    
    y_offset = 0
    for img in images:
        # Left align the image
        x_offset = 0
        new_im.paste(img, (x_offset, y_offset))
        y_offset += img.height
        
    return new_im
