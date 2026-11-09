import sys,glob
from PIL import Image
d='/home/user/Kids-Rhyms/babar-vs-kohli/output'
ts=sys.argv[2].split(',')
ims=[Image.open(f'{d}/stills/t{str(t).zfill(5)}.jpg').resize((432,432)) for t in ts]
W=Image.new('RGB',(432*len(ims),432))
for i,im in enumerate(ims): W.paste(im,(i*432,0))
W.save(f'{d}/{sys.argv[1]}.jpg')
