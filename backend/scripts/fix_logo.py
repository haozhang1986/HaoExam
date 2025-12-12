from PIL import Image

def remove_checkerboard(input_path, output_path):
    print(f"Processing {input_path}...")
    try:
        img = Image.open(input_path).convert("RGBA")
        datas = img.getdata()
        
        new_data = []
        for item in datas:
            r, g, b, a = item
            # Checkerboard white/light gray detection
            # White: (255, 255, 255)
            # Gray: (204, 204, 204) or similar. 
            # We'll make anything that is white or neutral gray transparent.
            # The logo is blue, so we can be aggressive with neutral colors.
            
            # Check if pixel is neutral (r, g, b are close) and light
            if r > 150 and g > 150 and b > 150 and abs(r-g) < 15 and abs(r-b) < 15 and abs(g-b) < 15:
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(item)
                
        img.putdata(new_data)
        img.save(output_path, "PNG")
        print(f"Successfully saved fixed logo to {output_path}")
    except Exception as e:
        print(f"Error processing image: {e}")

if __name__ == "__main__":
    # Use the path from the user's upload
    input_path = r"C:\Users\Administrator\.gemini\antigravity\brain\9e9b0cb6-88fc-4506-bd03-7c3f8c96943f\uploaded_image_1764815964768.png"
    output_path = r"d:\FirstWebsite\frontend\haoexam_logo_fixed.png"
    remove_checkerboard(input_path, output_path)
