from PIL import Image
from typing import List, Union
from fastapi import UploadFile
import io


def _convert_to_rgb(img: Image.Image) -> Image.Image:
    """Convert image to RGB mode for JPEG compatibility."""
    if img.mode in ('RGBA', 'P', 'LA'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        if img.mode in ('RGBA', 'LA'):
            background.paste(img, mask=img.split()[-1])
        else:
            background.paste(img)
        return background
    elif img.mode != 'RGB':
        return img.convert('RGB')
    return img


def stitch_images(upload_files: List[UploadFile]) -> Image.Image:
    """
    Stitches a list of UploadFiles vertically into a single image.
    Images are right-aligned.
    """
    if not upload_files:
        return None

    images = []
    for file in upload_files:
        content = file.file.read()
        file.file.seek(0)
        img = Image.open(io.BytesIO(content))
        img = _convert_to_rgb(img)
        images.append(img)

    if not images:
        return None

    # Calculate total width and height
    max_width = max(img.width for img in images)
    total_height = sum(img.height for img in images)

    # Create new blank image with white background
    new_im = Image.new('RGB', (max_width, total_height), (255, 255, 255))

    y_offset = 0
    for img in images:
        # Right align the image
        x_offset = max_width - img.width
        new_im.paste(img, (x_offset, y_offset))
        y_offset += img.height

    return new_im


def stitch_images_from_bytes(image_bytes_list: List[bytes]) -> Image.Image:
    """
    Stitches a list of image bytes vertically into a single image.
    Images are right-aligned. Used for multi-image upload in Studio.
    """
    if not image_bytes_list:
        return None

    images = []
    for content in image_bytes_list:
        img = Image.open(io.BytesIO(content))
        img = _convert_to_rgb(img)
        images.append(img)

    if not images:
        return None

    # Calculate total width and height
    max_width = max(img.width for img in images)
    total_height = sum(img.height for img in images)

    # Create new blank image with white background
    new_im = Image.new('RGB', (max_width, total_height), (255, 255, 255))

    y_offset = 0
    for img in images:
        # Right align the image
        x_offset = max_width - img.width
        new_im.paste(img, (x_offset, y_offset))
        y_offset += img.height

    return new_im
