from PIL import Image
import sys

image_path = sys.argv[1]
output_path = sys.argv[2]
scale_factor = int(sys.argv[3])  # Read scale factor from argument

img = Image.open(image_path)
width, height = img.size

new_width = int(width * scale_factor)
new_height = int(height * scale_factor)

upscaled_img = img.resize((new_width, new_height), Image.LANCZOS)
upscaled_img.save(output_path)
