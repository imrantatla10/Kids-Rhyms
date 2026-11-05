# Original synthesized bed (dark cinematic pulse) + whooshes/impacts at scene cuts, voice on top.
import numpy as np, subprocess, wave
SR=44100; DUR=39.6; N=int(SR*DUR); t=np.arange(N)/SR
rng=np.random.default_rng(3)
voice=subprocess.run(['ffmpeg','-loglevel','error','-i','audio/voiceover.mp3','-f','s16le','-ac','1','-ar',str(SR),'-'],capture_output=True).stdout
v=np.frombuffer(voice,np.int16).astype(np.float32)/32768; vo=np.zeros(N); vo[:min(N,len(v))]=v[:N]
def env(a,d,length):
    e=np.ones(length); a=int(a*SR); d=int(d*SR); e[:a]=np.linspace(0,1,a); e[-d:]*=np.linspace(1,0,d); return e
# drone: D minor
bed=np.zeros(N)
for f,amp in [(36.7,.30),(73.4,.18),(110,.08),(146.8,.05),(174.6,.04)]:
    bed+=amp*np.sin(2*np.pi*f*t+np.sin(2*np.pi*.1*t)*.6)
# pulse 100bpm kick-like
beat=60/100
for k in np.arange(0,DUR,beat):
    i=int(k*SR); L=int(.35*SR)
    if i+L>N: break
    tt=np.arange(L)/SR; bed[i:i+L]+=.55*np.sin(2*np.pi*(48+80*np.exp(-tt*25))*tt)*np.exp(-tt*9)
    if int(k/beat)%2==1:
        L2=int(.12*SR); bed[i:i+L2]+=.06*rng.standard_normal(L2)*np.exp(-np.arange(L2)/SR*40)
fx=np.zeros(N)
def whoosh(at,length=.9,amp=.35):
    i=int((at-length*.7)*SR); L=int(length*SR); i=max(i,0)
    n=rng.standard_normal(L); n=np.convolve(n,np.ones(18)/18,'same')
    e=np.sin(np.linspace(0,np.pi,L))**2; fx[i:i+L]+=amp*n*e*3
def impact(at,amp=.6):
    i=int(at*SR); L=int(1.2*SR); tt=np.arange(L)/SR
    fx[i:i+L]+=amp*(np.sin(2*np.pi*(40+60*np.exp(-tt*12))*tt)*np.exp(-tt*3.5)+.3*rng.standard_normal(L)*np.exp(-tt*30))
for c in [3.05,8.0,13.0,18.55,22.05,25.35,30.75]: whoosh(c); impact(c,.35)
impact(.05,.7)
# jet engine swell during flight (3.9–7.7)
i0,i1=int(3.9*SR),int(7.7*SR); L=i1-i0; n=np.convolve(rng.standard_normal(L),np.ones(40)/40,'same')
fx[i0:i1]+=.5*n*np.sin(np.linspace(0,np.pi,L))*3
# rumble during mosques rising
i0,i1=int(25.6*SR),int(29.5*SR); L=i1-i0; n=np.convolve(rng.standard_normal(L),np.ones(200)/200,'same'); fx[i0:i1]+=1.2*n*np.sin(np.linspace(0,np.pi,L))*6
# ducking
ve=np.convolve(np.abs(vo),np.ones(int(.08*SR))/int(.08*SR),'same'); duck=1-.55*np.clip(ve*12,0,1)
mix=vo*1.0+ (bed*.16+fx*.22)*duck
mix*=env(.02,1.0,N)
mix/=max(1,np.abs(mix).max()/.97)
with wave.open('audio/final_mix.wav','wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype(np.int16).tobytes())
print('ok', DUR)
