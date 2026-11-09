import sys,glob
from PIL import Image
d='/home/user/Kids-Rhyms/gym-story/output'
ts=sys.argv[2].split(',')
ims=[Image.open(f'{d}/stills/t{str(t).zfill(5)}.jpg').resize((360,640)) for t in ts]
W=Image.new('RGB',(360*len(ims),640))
for i,im in enumerate(ims): W.paste(im,(i*360,0))
W.save(f'{d}/{sys.argv[1]}.jpg')
