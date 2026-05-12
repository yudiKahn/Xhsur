import fitz
from PIL import Image
import io
import os
import numpy as np


def find_content_bbox_projection(pix, threshold=245, min_dark_pixels=8):
    """
    Projection-based crop detection.

    Ignores tiny scan artifacts and crops
    based on actual text density.
    """

    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("L")

    arr = np.array(img)

    # Dark pixels mask
    dark = arr < threshold

    # Count dark pixels per row/column
    row_counts = dark.sum(axis=1)
    col_counts = dark.sum(axis=0)

    # Keep only rows/cols with enough dark pixels
    rows = np.where(row_counts > min_dark_pixels)[0]
    cols = np.where(col_counts > min_dark_pixels)[0]

    if len(rows) == 0 or len(cols) == 0:
        return None

    top = rows[0]
    bottom = rows[-1]

    left = cols[0]
    right = cols[-1]

    return (left, top, right, bottom)


def autocrop_pdf(input_path, padding=0):

    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        return

    src = fitz.open(input_path)
    output = fitz.open()

    total = len(src)

    for page_num, page in enumerate(src):

        print(f"Processing {page_num + 1}/{total}")

        # Higher resolution helps detection
        matrix = fitz.Matrix(3, 3)

        pix = page.get_pixmap(
            matrix=matrix,
            alpha=False
        )

        bbox = find_content_bbox_projection(
            pix,
            threshold=245,
            min_dark_pixels=12
        )

        if bbox is None:

            print("  No content found.")

            new_page = output.new_page(
                width=page.rect.width,
                height=page.rect.height
            )

            new_page.show_pdf_page(
                new_page.rect,
                src,
                page.number
            )

            continue

        left, top, right, bottom = bbox

        # Convert image coords -> PDF coords
        scale_x = page.rect.width / pix.width
        scale_y = page.rect.height / pix.height

        crop_rect = fitz.Rect(
            max(0, left * scale_x - padding),
            max(0, top * scale_y - padding),
            min(page.rect.width, right * scale_x + padding),
            min(page.rect.height, bottom * scale_y + padding)
        )

        new_page = output.new_page(
            width=crop_rect.width,
            height=crop_rect.height
        )

        new_page.show_pdf_page(
            new_page.rect,
            src,
            page.number,
            clip=crop_rect
        )

    output_path = input_path.replace(
        ".pdf",
        "_projection_cropped.pdf"
    )

    output.save(
        output_path,
        garbage=4,
        deflate=True
    )

    output.close()
    src.close()

    print(f"\nSaved: {output_path}")


if __name__ == "__main__":

    autocrop_pdf(
        "siddur.pdf",
        padding=0
    )