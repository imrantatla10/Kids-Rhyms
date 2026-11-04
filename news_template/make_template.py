import numpy as np, subprocess, sys
W,H,FPS,DUR=1920,1080,30,10
N=FPS*DUR
out=sys.argv[1]
y,x=np.mgrid[0:H,0:W].astype(np.float32)
xn,yn=x/W,y/H
# base gradient: deep navy edges, brighter blue centre
d=np.sqrt(((xn-0.5)*1.6)**2+((yn-0.5)*1.2)**2)
base=np.clip(1-d,0,1)
bg=np.stack([0.02+0.10*base,0.08+0.35*base,0.30+0.55*base],-1)
def glow(dist,width):
    return np.exp(-(dist/width)**2)
p=subprocess.Popen(['ffmpeg','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
  '-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-an','-movflags','+faststart',out],stdin=subprocess.PIPE)
# green screen box
bw,bh=1440,810; cx,cy=960,535; bd=12
x0,y0=cx-bw//2,cy-bh//2
for i in range(N):
    t=i/FPS; ph=2*np.pi*t/DUR  # loopable phase
    img=bg.copy()
    L=np.zeros((H,W),np.float32)
    # flowing sweeping light waves
    waves=[(0.30,0.10,1.3,1,0.012,0.9),(0.38,0.07,2.1,2,0.006,1.0),(0.72,0.09,1.6,-1,0.010,0.8),
           (0.66,0.06,2.6,-2,0.005,1.0),(0.50,0.14,0.9,1,0.020,0.5),(0.85,0.05,3.0,3,0.004,0.9),(0.15,0.05,2.4,-3,0.004,0.9)]
    for cy0,amp,freq,sp,wd,inten in waves:
        curve=cy0+amp*np.sin(2*np.pi*freq*xn+sp*ph)+0.02*np.sin(6*np.pi*xn-2*sp*ph)
        L+=inten*glow(yn-curve,wd)+0.25*inten*glow(yn-curve,wd*6)
    # moving horizontal light streaks
    for k,(row,sp,ln) in enumerate([(0.12,1,0.35),(0.92,-1,0.4),(0.25,2,0.25),(0.78,-2,0.3)]):
        pos=((sp*t/DUR*1.0+k*0.27)%1.0)*1.6-0.3
        L+=0.8*glow(yn-row,0.003)*glow(xn-pos,ln/2)
    # pulsing radial flare
    L+=0.25*(0.6+0.4*np.sin(ph*2))*glow(np.sqrt((xn-0.5)**2+(yn-0.5)**2),0.35)
    img+=L[...,None]*np.array([0.45,0.75,1.0],np.float32)
    # subtle scanlines
    img*=(0.94+0.06*np.sin(y*np.pi/2))[...,None]
    img=np.clip(img,0,1)
    f=(img*255).astype(np.uint8)
    # soft shadow behind box
    f[y0+14:y0+bh+bd+14, x0+14:x0+bw+bd+14]=(f[y0+14:y0+bh+bd+14, x0+14:x0+bw+bd+14]*0.5).astype(np.uint8)
    f[y0-bd:y0+bh+bd, x0-bd:x0+bw+bd]=255
    f[y0:y0+bh, x0:x0+bw]=(0,255,0)
    p.stdin.write(f.tobytes())
p.stdin.close(); p.wait()
