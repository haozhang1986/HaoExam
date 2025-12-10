from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

def test_simple_pdf():
    print("Testing ReportLab...")
    try:
        c = canvas.Canvas("simple_test.pdf", pagesize=A4)
        c.drawString(100, 750, "Hello World")
        c.save()
        print("Successfully generated simple_test.pdf")
    except Exception as e:
        print(f"ReportLab failed: {e}")

if __name__ == "__main__":
    test_simple_pdf()
