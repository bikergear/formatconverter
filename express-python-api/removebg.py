import os
import sys
from rembg import remove

def remove_background(input_image_path, output_image_path):
    output_dir = os.path.dirname(output_image_path)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    with open(input_image_path, 'rb') as i:
        input_image = i.read()
    output_image = remove(input_image)
    with open(output_image_path, 'wb') as o:
        o.write(output_image)

if __name__ == "__main__":
    input_image_path = sys.argv[1]
    output_image_path = sys.argv[2]
    remove_background(input_image_path, output_image_path)
