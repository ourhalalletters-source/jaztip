import { useEffect, useState } from 'react'
import { supabase, configured, loadData, DEFAULT_SETTINGS } from './supabase'
import { normalizeWa, parsePriceIdr, formatIdr } from './lib'

const STATUS=['baru','dikonfirmasi','dibayar','dibeli','dikirim','selesai','batal']
const wibToday=()=>new Date(Date.now()+7*36e5).toISOString().slice(0,10)   // tanggal hari ini di WIB (UTC+7)

const F=[['whatsapp','Nomor WhatsApp (format 628xxx)'],['status','Status (OPEN / CLOSED)'],['open_date','Tanggal open order'],['deadline','Deadline order'],['eta','Estimasi pengiriman'],['area','Area layanan'],['route','Informasi rute']]
const EMPTY={id:null,name:'',price:'',description:'',image_url:''}

export default function Admin(){
  const [session,setSession]=useState(null),[ready,setReady]=useState(false)
  useEffect(()=>{ if(!configured){setReady(true);return}
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true)})
    const {data:l}=supabase.auth.onAuthStateChange((_,s)=>setSession(s)); return ()=>l.subscription.unsubscribe()},[])
  if(!ready) return null
  return <div className="max-w-2xl mx-auto p-4">
    <h1 className="text-3xl font-bold">Admin JAZZZTIP</h1>
    {!configured?<p className="pop bg-sun p-4 mt-4">Supabase belum dikonfigurasi. Ikuti README (isi file .env atau Environment Variables di Netlify), lalu deploy ulang.</p>
    :!session?<Login/>:<Panel/>}
  </div>
}

function Login(){
  const [email,setE]=useState(''),[pw,setP]=useState(''),[err,setErr]=useState('')
  const go=async e=>{e.preventDefault();const {error}=await supabase.auth.signInWithPassword({email,password:pw});if(error)setErr('Email atau password salah.')}
  return <form onSubmit={go} className="pop bg-white p-4 mt-4 space-y-3">
    <input className="inp" type="email" placeholder="Email" value={email} onChange={e=>setE(e.target.value)} required/>
    <input className="inp" type="password" placeholder="Password" value={pw} onChange={e=>setP(e.target.value)} required/>
    {err&&<p className="text-pink font-semibold">{err}</p>}<button className="btn bg-pink text-white w-full">Masuk</button></form>
}

function Panel(){
  const [s,setS]=useState(DEFAULT_SETTINGS),[prods,setProds]=useState([]),[msg,setMsg]=useState('')
  const [form,setForm]=useState(EMPTY),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false)
  // Jika gagal memuat, JANGAN pakai data contoh: menyimpannya akan menimpa pengaturan asli.
  const reload=()=>loadData().then(d=>{if(d.failed)return flash('Gagal memuat data. Muat ulang halaman sebelum menyimpan.');setS(d.settings);setProds(d.products);setLoaded(true)})
  useEffect(()=>{reload()},[])
  const flash=t=>{setMsg(t);setTimeout(()=>setMsg(''),4000)}
  const saveSettings=async()=>{
    if(!loaded)return flash('Data belum dimuat. Tunggu sebentar atau muat ulang halaman.')
    const {instagram,...row}=s,wa=normalizeWa(row.whatsapp),status=String(row.status||'').trim().toUpperCase()
    if(!wa)return flash('Nomor WhatsApp tidak valid. Contoh: 0812xxxxxxxx atau 62812xxxxxxxx')
    if(status!=='OPEN'&&status!=='CLOSED')return flash('Status harus OPEN atau CLOSED.')
    const {error}=await supabase.from('settings').upsert({...row,whatsapp:wa,status,id:1})
    if(!error)setS(x=>({...x,whatsapp:wa,status}))
    flash(error?'Gagal menyimpan: '+error.message:'Pengaturan tersimpan.')}
  const upload=async f=>{if(!f)return;setBusy(true);const path=`${Date.now()}-${f.name.replace(/[^\w.]/g,'_')}`
    const {error}=await supabase.storage.from('product-images').upload(path,f);setBusy(false)
    if(error)return flash('Upload gagal: '+error.message)
    setForm(x=>({...x,image_url:supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl}))}
  const saveProduct=async e=>{e.preventDefault();const {id,created_at,...row}=form
    const {error}=id?await supabase.from('products').update(row).eq('id',id):await supabase.from('products').insert(row)
    if(error)return flash('Gagal: '+error.message);setForm(EMPTY)
    flash(parsePriceIdr(row.price)?'Produk tersimpan.':'Produk tersimpan, tapi harganya bukan satu angka: produk ini tidak bisa masuk keranjang (pelanggan diarahkan tanya admin).');reload()}
  const del=async p=>{if(!confirm(`Hapus ${p.name}?`))return;await supabase.from('products').delete().eq('id',p.id);reload()}
  return <div className="space-y-6 mt-4">
    {msg&&<p role="status" className="pop bg-lime p-2 text-center font-semibold">{msg}</p>}
    <OrdersPanel/>
    <section className="pop bg-white p-4 space-y-2"><h2 className="text-xl font-bold">Jadwal, Rute & WhatsApp</h2>
      {F.map(([k,l])=><label key={k} className="block text-sm font-semibold">{l}<input className="inp mt-1 font-normal" value={s[k]||''} onChange={e=>setS({...s,[k]:e.target.value})}/></label>)}
      <button onClick={saveSettings} disabled={!loaded} className="btn bg-lime">Simpan pengaturan</button></section>
    <form onSubmit={saveProduct} className="pop bg-sun p-4 space-y-2"><h2 className="text-xl font-bold">{form.id?'Edit produk':'Tambah produk'}</h2>
      <input className="inp" placeholder="Nama produk" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/>
      <input className="inp" placeholder="Harga satu angka, contoh: Rp 25.000" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} required/>
      <textarea className="inp" placeholder="Deskripsi singkat" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/>
      <input type="file" accept="image/*" onChange={e=>upload(e.target.files[0])}/>
      {busy&&<p>Mengunggah foto…</p>}{form.image_url&&<img src={form.image_url} alt="" className="h-24 rounded-xl"/>}
      <div className="flex gap-2"><button className="btn bg-pink text-white" disabled={busy}>Simpan produk</button>
      {form.id&&<button type="button" className="btn bg-white" onClick={()=>setForm(EMPTY)}>Batal</button>}</div></form>
    <section className="space-y-2"><h2 className="text-xl font-bold">Daftar produk</h2>
      {prods.length===0&&<p>Belum ada produk. Tambahkan lewat form di atas.</p>}
      {prods.map(p=><div key={p.id} className="pop bg-white p-3 flex items-center gap-3">
        {p.image_url&&<img src={p.image_url} alt="" className="h-14 w-14 rounded-xl object-cover"/>}
        <div className="flex-1"><b>{p.name}</b><br/><span className="text-sm">{p.price}</span></div>
        <button className="btn bg-lime !px-3 !py-1 text-sm" onClick={()=>{setForm(p);window.scrollTo(0,0)}}>Edit</button>
        <button className="btn bg-pink text-white !px-3 !py-1 text-sm" onClick={()=>del(p)}>Hapus</button></div>)}</section>
    <button className="btn bg-white" onClick={()=>supabase.auth.signOut()}>Keluar</button>
  </div>
}

// Pesanan per tanggal (WIB): ringkasan, daftar belanja, dan ubah status.
function OrdersPanel(){
  const [date,setDate]=useState(wibToday),[rows,setRows]=useState(null),[err,setErr]=useState('')
  const load=async()=>{
    if(!date)return
    setRows(null);setErr('')
    const start=new Date(`${date}T00:00:00+07:00`)
    const {data,error}=await supabase.from('orders').select('*').gte('created_at',start.toISOString()).lt('created_at',new Date(start.getTime()+864e5).toISOString()).order('created_at',{ascending:false})
    if(error)return setErr('Gagal memuat pesanan: '+error.message+'. Sudah menjalankan supabase/orders.sql?')
    setRows(data)}
  useEffect(()=>{load()},[date])
  const setStatus=async(o,status)=>{
    const {error}=await supabase.from('orders').update({status}).eq('id',o.id)
    if(error)return setErr('Gagal mengubah status: '+error.message)
    setRows(r=>r.map(x=>x.id===o.id?{...x,status}:x))}
  const active=(rows||[]).filter(o=>o.status!=='batal')
  const buy={};active.forEach(o=>o.items.forEach(i=>{buy[i.name]=(buy[i.name]||0)+i.qty}))
  const revenue=active.reduce((n,o)=>n+Number(o.total_idr),0)
  const time=o=>new Date(o.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'})
  return <section className="pop bg-white p-4 space-y-3">
    <div className="flex items-center justify-between gap-2 flex-wrap"><h2 className="text-xl font-bold">Pesanan</h2>
      <div className="flex gap-2"><input type="date" aria-label="Tanggal" className="inp !w-auto" value={date} onChange={e=>setDate(e.target.value)}/>
        <button className="btn bg-lime !px-3 !py-1 text-sm" onClick={load}>Muat ulang</button></div></div>
    {err&&<p role="alert" className="text-pink font-semibold">{err}</p>}
    {rows===null&&!err&&<p>Memuat…</p>}
    {rows&&<>
      <p className="text-sm"><b>{active.length}</b> pesanan aktif · omzet <b>{formatIdr(revenue)}</b>{rows.length>active.length&&` · ${rows.length-active.length} batal`}</p>
      {Object.keys(buy).length>0&&<p className="text-sm"><b>Yang perlu dibeli:</b> {Object.entries(buy).map(([n,q])=>`${n} ×${q}`).join(', ')}</p>}
      {rows.length===0&&<p>Belum ada pesanan di tanggal ini.</p>}
      {rows.map(o=><div key={o.id} className={`pop p-3 text-sm space-y-1 ${o.status==='batal'?'bg-pink/20':'bg-cream'}`}>
        <div className="flex items-center justify-between gap-2"><b>{o.order_no} · {time(o)}</b>
          <select aria-label={`Status ${o.order_no}`} className="inp !w-auto !py-1" value={o.status} onChange={e=>setStatus(o,e.target.value)}>{STATUS.map(s=><option key={s}>{s}</option>)}</select></div>
        <p>{o.customer_name} · {o.area} · <a className="underline font-semibold" href={`https://wa.me/${o.customer_wa}`} target="_blank" rel="noreferrer">chat {o.customer_wa}</a></p>
        <ul className="list-disc ml-5">{o.items.map(i=><li key={i.product_id}>{i.name} ×{i.qty} ({formatIdr(i.price_idr*i.qty)})</li>)}</ul>
        {o.note&&<p className="italic">Catatan: {o.note}</p>}
        <p className="font-bold">Total {formatIdr(o.total_idr)}</p></div>)}
    </>}
  </section>
}
