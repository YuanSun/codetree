import struct, zlib, sys, json
def u32(b,o): return struct.unpack_from('<I',b,o)[0]
def read(path):
    raw=open(path,'rb').read()
    od=u32(raw,0x5C)+0x60
    t=u32(raw,od)
    if t!=3: od=u32(raw,od+4)+od+12
    limit=u32(raw,od+4)+od+8
    oi=od+0x1C
    och=u32(raw,od+8)+oi
    wil=u32(raw,od+12); wl=u32(raw,od+16); xl=u32(raw,od+20)
    pos=och+8
    off=u32(raw,pos); pos+=4
    streams=[]
    while off+pos<limit:
        off=u32(raw,pos); pos+=4; streams.append(off)
    start=pos; last=start; buf=bytearray()
    for rel in streams:
        o=start+rel
        buf+=zlib.decompress(raw[last:o]); last=o
    return bytes(buf), wil, wl, xl
def entries(path, enc_w='utf-8', enc_x='utf-8'):
    b,wil,wl,xl=read(path)
    ow=wil; ox=wil+wl
    n=wil//10-1
    def idx(i):
        p=10*i
        return struct.unpack_from('<IIBBII',b,p) if False else (u32(b,p),u32(b,p+4),b[p+8],b[p+9],u32(b,p+10),u32(b,p+14))
    for i in range(n):
        lw,lx,_,refs,cw,cx=idx(i)
        xml=b[ox+lx:ox+cx].decode(enc_x,'replace')
        while refs>0:
            ref=u32(b,ow+lw)
            _,lx2,_,_,_,cx2=idx(ref)
            x2=b[ox+lx2:ox+cx2].decode(enc_x,'replace')
            xml = x2 if not xml else x2+', '+xml
            lw+=4; refs-=1
        word=b[ow+lw:ow+cw].decode(enc_w,'replace')
        yield word, xml
if __name__=='__main__':
    b,wil,wl,xl=read(sys.argv[1])
    print('inflated',len(b),wil,wl,xl, wil+wl+xl)
