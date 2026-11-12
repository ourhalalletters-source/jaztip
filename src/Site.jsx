import { useEffect, useState } from 'react'
import { MessageCircle, Instagram, MapPin, Star, Smile, Menu, X, ShoppingBag, Minus, Plus } from 'lucide-react'
import { loadData, configured, DEFAULT_SETTINGS, DEFAULT_PRODUCTS } from './supabase'
import { isOpenStatus, parsePriceIdr, formatIdr, normalizeWa, loadCart, saveCart } from './lib'
import CartSheet from './Cart'

// Selama data asli dimuat, jangan tampilkan produk/jadwal contoh (menghindari "berkedip" dan order salah).
const LOADING={settings:{...DEFAULT_SETTINGS,status:'',open_date:'…',deadline:'…',eta:'…'},products:[],live:false,failed:false}

export default function Site(){
  const [d,setD]=useState(configured?null:{settings:DEFAULT_SETTINGS,products:DEFAULT_PRODUCTS,live:false,failed:false})
  const [open,setOpen]=useState(false)
  const [cart,setCart]=useState(loadCart),[cartOpen,setCartOpen]=useState(false)
  useEffect(()=>{loadData().then(setD).catch(()=>{})},[])
  const loading=!d, data=d||LOADING
  const s=data.settings, products=data.products
  const waNum=normalizeWa(s.whatsapp)||s.whatsapp
  const wa=(t)=>`https://wa.me/${waNum}?text=${encodeURIComponent(t)}`
  const isOpen=isOpenStatus(s.status)
  // Order hanya bila toko OPEN dan datanya asli (atau mode contoh tanpa Supabase). Data gagal dimuat = jangan terima order.
  const canOrder=isOpen&&!loading&&!data.failed

  useEffect(()=>{ if(!data.live) return                       // buang isi keranjang yang produknya sudah tidak ada
    const ids=new Set(products.map(p=>p.id)); setCart(c=>Object.fromEntries(Object.entries(c).filter(([id])=>ids.has(id)))) },[d])
  useEffect(()=>{saveCart(cart)},[cart])
  const qtyOf=id=>cart[id]||0
  const setQty=(id,q)=>setCart(c=>{const n={...c};if(q<=0)delete n[id];else n[id]=Math.min(q,99);return n})
  const lines=products.filter(p=>qtyOf(p.id)>0&&parsePriceIdr(p.price)).map(p=>({id:p.id,name:p.name,price:parsePriceIdr(p.price),qty:qtyOf(p.id)}))
  const count=lines.reduce((n,l)=>n+l.qty,0), total=lines.reduce((n,l)=>n+l.price*l.qty,0)

  const nav=[['Home','#home'],['Katalog','#katalog'],['Cara Order','#cara'],['Jadwal','#jadwal'],['Kontak','#kontak']]
  const hide=e=>{e.currentTarget.style.display='none'}
  return <div>
    <header className="sticky top-0 z-30 bg-cream/95 backdrop-blur border-b-[3px] border-plum">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        <a href="#home" className="flex items-center gap-2"><img src="/logo.png" alt="" className="h-9 w-9 rounded-full" onError={hide}/><span className="font-head font-bold text-xl text-pink">JAZZZTIP<span className="text-plum"> KEDIRI</span></span></a>
        <nav className="hidden md:flex gap-6 font-semibold">{nav.map(([n,h])=><a key={n} href={h} className="hover:text-pink">{n}</a>)}</nav>
        <a href={wa('Halo admin JAZZZTIP, aku mau titip.')} className="btn bg-lime hidden md:inline-flex text-sm"><MessageCircle size={16}/>ORDER VIA WHATSAPP</a>
        <button className="md:hidden" aria-label="Menu" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
      </div>
      {open&&<div className="md:hidden px-4 pb-4 flex flex-col gap-3 font-semibold">{nav.map(([n,h])=><a key={n} href={h} onClick={()=>setOpen(false)}>{n}</a>)}
        <a href={wa('Halo admin JAZZZTIP, aku mau titip.')} className="btn bg-lime text-sm">ORDER VIA WHATSAPP</a></div>}
    </header>

    <section id="home" className="relative overflow-hidden bg-pink text-white">
      <Star className="absolute top-8 right-6 text-sun fill-sun wob" size={40}/><Smile className="absolute bottom-10 left-4 text-sun wob" size={44}/>
      <div className="max-w-6xl mx-auto px-4 py-14 grid md:grid-cols-2 gap-8 items-center">
        <div>
          {!loading&&<span className={`inline-block -rotate-3 px-4 py-1 rounded-full border-[3px] border-plum font-head font-bold text-plum ${isOpen?'bg-lime':'bg-sun'}`}>{isOpen?'OPEN JASTIP!':'CLOSED'}</span>}
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] mt-4 drop-shadow-[3px_3px_0_#532A72]">MAU JAJAN VIRAL? TITIP AJA!</h1>
          <p className="mt-4 max-w-md">Jastip makanan viral, jajanan hits, skincare, dan produk incaranmu. Praktis, mudah, dan tinggal titip!</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#katalog" className="btn bg-sun text-plum">LIHAT KATALOG</a>
            <a href={wa('Halo admin JAZZZTIP, aku mau tanya.')} className="btn bg-white text-plum"><MessageCircle size={18}/>CHAT ADMIN</a>
          </div>
          <p className="mt-6 flex items-center gap-2 text-sm font-semibold"><MapPin size={16}/>{s.route}</p>
        </div>
        <div className="pop bg-sun p-4 rotate-2 text-plum text-center">
          {products[0]?.image_url?<img src={products[0].image_url} alt={products[0].name} className="rounded-2xl aspect-square object-cover w-full"/>:
          <div className="aspect-square rounded-2xl bg-lime grid place-items-center"><img src="/logo.png" alt="" className="w-1/2" onError={hide}/><span className="font-head text-3xl font-bold">JAZZZTIP</span></div>}
          <p className="font-head font-bold mt-2">{products[0]?.name}</p>
        </div>
      </div>
    </section>

    <section id="katalog" className="max-w-6xl mx-auto px-4 py-14">
      <h2 className="text-4xl font-bold">Katalog Jastip</h2>
      <p className="mt-1">Pilih produk, isi keranjang, lalu kirim pesanan. Konfirmasi akhir lewat WhatsApp admin.</p>
      {data.failed&&<p role="status" className="pop bg-sun p-3 mt-4 text-sm font-semibold">Data terbaru belum bisa dimuat, jadi harga di bawah hanya contoh dan pemesanan dimatikan. Muat ulang halaman atau chat admin.</p>}
      {!loading&&!data.failed&&!isOpen&&<p role="status" className="pop bg-sun p-3 mt-4 text-sm font-semibold">Order sedang ditutup. Jadwal open berikutnya: {s.open_date}. Kamu tetap bisa tanya admin lewat WhatsApp.</p>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6" aria-busy={loading}>
        {loading&&[0,1,2,3].map(i=><div key={i} className="pop bg-white/60 aspect-[3/4] animate-pulse" aria-hidden="true"/>)}
        {products.map((p,i)=>{const price=parsePriceIdr(p.price),q=qtyOf(p.id);return <article key={p.id} className={`pop overflow-hidden flex flex-col ${['bg-white','bg-sun/60','bg-lime/60','bg-white'][i%4]}`}>
          {p.image_url?<img src={p.image_url} alt={p.name} loading="lazy" className="aspect-square object-cover"/>:<div className="aspect-square bg-tang/30 grid place-items-center"><Star className="text-tang fill-sun" size={40}/></div>}
          <div className="p-3 flex flex-col flex-1">
            <h3 className="font-bold text-base leading-tight">{p.name}</h3>
            <p className="font-head font-bold text-pink text-lg">{p.price}</p>
            <p className="text-xs flex-1">{p.description}</p>
            {canOrder&&price
              ? q>0
                ? <div className="mt-3 flex items-center justify-between">
                    <button aria-label={`Kurangi ${p.name}`} onClick={()=>setQty(p.id,q-1)} className="btn !px-2 !py-1"><Minus size={14}/></button>
                    <span className="font-head font-bold text-lg" aria-live="polite">{q}</span>
                    <button aria-label={`Tambah ${p.name}`} disabled={q>=99} onClick={()=>setQty(p.id,q+1)} className="btn !px-2 !py-1"><Plus size={14}/></button></div>
                : <button onClick={()=>setQty(p.id,1)} className="btn bg-pink text-white text-sm mt-3 !px-3">TITIP SEKARANG</button>
              : <a href={wa(`Halo admin JAZZZTIP, aku mau tanya: ${p.name} (${p.price})`)} className="btn bg-white text-plum text-sm mt-3 !px-3">TANYA ADMIN</a>}
          </div></article>})}
      </div>
    </section>

    <section id="cara" className="bg-lime border-y-[3px] border-plum">
      <div className="max-w-6xl mx-auto px-4 py-14">
        <h2 className="text-4xl font-bold">Cara Order</h2>
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {[['ISI KERANJANG','Klik "Titip sekarang" pada produk yang kamu mau.'],['KIRIM PESANAN','Isi nama, nomor WhatsApp, dan area, lalu kirim.'],['KONFIRMASI & TERIMA','Konfirmasi lewat WhatsApp. Admin mengonfirmasi pesanan dan pengambilan atau pengantaran.']].map(([t,x],i)=>
            <div key={t} className="pop bg-white p-5"><span className="grid place-items-center w-10 h-10 rounded-full bg-sun border-[3px] border-plum font-head font-bold">{i+1}</span><h3 className="font-bold text-xl mt-3">{t}</h3><p className="text-sm">{x}</p></div>)}
        </div>
      </div>
    </section>

    <section id="jadwal" className="max-w-6xl mx-auto px-4 py-14">
      <h2 className="text-4xl font-bold">Jadwal & Rute</h2>
      <div className="pop bg-sun p-5 mt-6 grid sm:grid-cols-2 gap-3">
        <p><b>Status:</b> <span className={`px-3 rounded-full border-2 border-plum font-bold ${isOpen?'bg-lime':'bg-white'}`}>{s.status}</span></p>
        <p><b>Tanggal open:</b> {s.open_date}</p><p><b>Deadline order:</b> {s.deadline}</p><p><b>Estimasi kirim:</b> {s.eta}</p>
        <p className="sm:col-span-2"><b>Area layanan:</b> {s.area}</p><p className="sm:col-span-2 font-head font-bold text-lg">{s.route}</p>
      </div>
    </section>

    <section className="bg-plum text-cream"><div className="max-w-3xl mx-auto px-4 py-14 text-center">
      <h2 className="text-4xl font-bold text-sun">Tentang Kami</h2>
      <p className="mt-3">JAZZZTIP KEDIRI hadir buat kamu yang pengen jajan makanan viral dan produk incaran tanpa harus pergi jauh. Tinggal pilih, chat, dan titip ke kami!</p></div></section>

    <section id="kontak" className="max-w-6xl mx-auto px-4 py-14 text-center">
      <h2 className="text-4xl font-bold">Kontak</h2>
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <a href={wa('Halo admin JAZZZTIP!')} className="btn bg-lime"><MessageCircle size={18}/>WhatsApp</a>
        <a href={`https://instagram.com/${s.instagram}`} className="btn bg-pink text-white"><Instagram size={18}/>@{s.instagram}</a></div>
      <p className="mt-4 text-sm">Area layanan: {s.area}</p>
    </section>

    <footer className="bg-plum text-cream text-center py-8 px-4 text-sm">
      <p className="font-head font-bold text-xl text-sun">JAZZZTIP KEDIRI</p>
      <p>Instagram @{s.instagram} · WhatsApp {s.whatsapp}</p>
      <p className="mt-2 opacity-70">© {new Date().getFullYear()} JAZZZTIP KEDIRI</p>
    </footer>
    <a href={wa('Halo admin JAZZZTIP!')} aria-label="WhatsApp" className="fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full bg-lime border-[3px] border-plum shadow-[3px_3px_0_#532A72] grid place-items-center"><MessageCircle/></a>
    {canOrder&&count>0&&<button onClick={()=>setCartOpen(true)} className="btn bg-pink text-white fixed bottom-4 left-4 z-40 max-w-[calc(100vw-6.5rem)] text-sm"><ShoppingBag size={18}/>Keranjang ({count}) · {formatIdr(total)}</button>}
    <CartSheet open={cartOpen} onClose={()=>setCartOpen(false)} lines={lines} setQty={setQty} clear={()=>setCart({})} settings={{...s,whatsapp:waNum}} mode={data.live?'live':'demo'}/>
  </div>
}
