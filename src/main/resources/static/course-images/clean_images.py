import glob, os
from PIL import Image, ImageDraw

for path in glob.glob("*.jpg"):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(im, corner, (255, 255, 255, 0), thresh=40)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(path[:-4] + ".png")
    print("saved", path[:-4] + ".png")
