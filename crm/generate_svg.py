import cv2
import numpy as np
from PIL import Image

def generate_svg(input_img, output_svg):
    img = cv2.imread(input_img, cv2.IMREAD_GRAYSCALE)
    if img is None:
        print(f"Error reading {input_img}")
        return
        
    scaled = cv2.resize(img, (0, 0), fx=4, fy=4, interpolation=cv2.INTER_CUBIC)
    _, thresh = cv2.threshold(scaled, 200, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_TC89_L1)
    
    width = scaled.shape[1]
    height = scaled.shape[0]
    
    with open(output_svg, 'w') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">\n')
        f.write('<path fill-rule="evenodd" fill="black" d="')
        for contour in contours:
            if len(contour) < 3: continue
            f.write(f'M {contour[0][0][0]} {contour[0][0][1]} ')
            for pt in contour[1:]:
                f.write(f'L {pt[0][0]} {pt[0][1]} ')
            f.write('Z ')
        f.write('"/>\n</svg>')

def generate_highres_jpeg(input_img, output_jpeg):
    img = Image.open(input_img).convert('L')
    new_w = img.width * 8
    new_h = img.height * 8
    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    img = img.point(lambda p: 0 if p < 200 else 255)
    img.save(output_jpeg, quality=100)

generate_highres_jpeg('logo_sz_clean.jpg', 'logo_sz_highres.jpg')
generate_highres_jpeg('logo_sizaria_clean.jpg', 'logo_sizaria_highres.jpg')

generate_svg('logo_sz_clean.jpg', 'logo_sz.svg')
generate_svg('logo_sizaria_clean.jpg', 'logo_sizaria.svg')
print('Highres and SVG generated successfully.')
