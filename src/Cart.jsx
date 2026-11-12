import { useEffect, useRef, useState } from 'react'
import { X, Minus, Plus, MessageCircle, Check } from 'lucide-react'
import { createOrder } from './supabase'
import { areaList, buildOrderMessage, formatIdr, normalizeWa, orderErrorMessage, waLink } from './lib'

// Lembar keranjang + form checkout.
// mode 'live'  : pesanan disimpan ke Supabase lewat create_order(), lalu pelanggan konfirmasi via WA.
// mode 'demo'  : Supabase belum dikonfigurasi, pesanan hanya disusun menjadi pesan WhatsApp.
export default function CartSheet({ open, onClose, lines, setQty, clear, settings, mode }) {
  const areas = areaList(settings.area)
  const [f, setF] = useState({ name: '', wa: '', area: '', note: '', hp: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)
  const first = useRef(null)
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const set = k => e => setF({ ...f, [k]: e.target.value })

  const close = () => { setErr(''); setDone(null); onClose() }

  // Esc menutup lembar; fokus pindah ke kolom pertama hanya saat lembar dibuka.
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  useEffect(() => { if (open) first.current?.focus() }, [open])
  useEffect(() => { if (areas.length && !areas.includes(f.area)) setF(x => ({ ...x, area: areas[0] })) }, [settings.area])

  if (!open) return null

  const submit = async e => {
    e.preventDefault(); setErr('')
    const wa = normalizeWa(f.wa)
    if (f.name.trim().length < 2) return setErr('Nama minimal 2 karakter.')
    if (!wa) return setErr('Nomor WhatsApp belum benar. Contoh: 0812xxxxxxxx')
    if (areas.length && !areas.includes(f.area)) return setErr('Pilih area pengantaran.')
    const view = lines.map(l => ({ name: l.name, qty: l.qty, price: l.price }))
    const ctx = { name: f.name.trim(), area: f.area, note: f.note.trim() }

    // Kolom jebakan untuk bot: manusia tidak melihatnya, jadi kalau terisi berarti bot.
    if (f.hp) { setDone({ ...ctx, orderNo: null, total, items: view }); clear(); return }

    if (mode !== 'live') { setDone({ ...ctx, orderNo: null, total, items: view, demo: true }); clear(); return }

    setBusy(true)
    const { data, error } = await createOrder({
      name: f.name, wa, area: f.area, note: f.note,
      items: lines.map(l => ({ product_id: l.id, qty: l.qty })),
    })
    setBusy(false)
    if (error) return setErr(orderErrorMessage(error.message))
    setDone({ ...ctx, orderNo: data.order_no, total: data.total_idr,
      items: data.items.map(i => ({ name: i.name, qty: i.qty, price: i.price_idr })) })
    clear()
  }

  const confirmLink = done && waLink(settings.whatsapp, buildOrderMessage(done))

  return <div className="fixed inset-0 z-50 bg-plum/60 flex items-center justify-center p-3" onClick={close}>
    <div role="dialog" aria-modal="true" aria-label="Keranjang" className="pop bg-cream w-full max-w-lg max-h-[92vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{done ? 'Pesanan tercatat!' : 'Keranjang'}</h2>
        <button aria-label="Tutup" onClick={close} className="p-1"><X /></button>
      </div>

      {done ? <div className="mt-3 space-y-3">
        <div className="pop bg-lime p-3 text-center">
          <Check className="mx-auto" aria-hidden="true" />
          {done.orderNo && <p className="font-head font-bold text-2xl">{done.orderNo}</p>}
          <p className="font-semibold">Total {formatIdr(done.total)}</p>
        </div>
        <p className="text-sm">{done.demo
          ? 'Mode contoh: pesanan belum tersimpan di sistem. Kirim lewat WhatsApp supaya admin menerimanya.'
          : 'Langkah terakhir: kirim konfirmasi ke admin lewat WhatsApp supaya pesananmu diproses.'}</p>
        <a href={confirmLink} className="btn bg-lime w-full"><MessageCircle size={18} />KONFIRMASI VIA WHATSAPP</a>
        <button className="btn bg-white w-full" onClick={close}>Tutup</button>
      </div>

      : lines.length === 0 ? <p className="mt-4">Keranjang masih kosong. Pilih produk di katalog dulu ya.</p>

      : <form onSubmit={submit} className="relative mt-3 space-y-3">
        <ul className="space-y-2">
          {lines.map(l => <li key={l.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0"><p className="font-bold leading-tight">{l.name}</p><p className="text-sm">{formatIdr(l.price)}</p></div>
            <button type="button" aria-label={`Kurangi ${l.name}`} onClick={() => setQty(l.id, l.qty - 1)} className="btn !px-2 !py-1"><Minus size={14} /></button>
            <span className="w-6 text-center font-bold" aria-live="polite">{l.qty}</span>
            <button type="button" aria-label={`Tambah ${l.name}`} disabled={l.qty >= 99} onClick={() => setQty(l.id, l.qty + 1)} className="btn !px-2 !py-1"><Plus size={14} /></button>
          </li>)}
        </ul>
        <p className="flex justify-between font-head font-bold text-xl border-t-[3px] border-plum pt-2"><span>Total</span><span>{formatIdr(total)}</span></p>

        <label className="block text-sm font-semibold">Nama
          <input ref={first} className="inp mt-1 font-normal" value={f.name} onChange={set('name')} maxLength={60} autoComplete="name" required /></label>
        <label className="block text-sm font-semibold">Nomor WhatsApp
          <input className="inp mt-1 font-normal" value={f.wa} onChange={set('wa')} inputMode="tel" placeholder="0812xxxxxxxx" autoComplete="tel" required /></label>
        <label className="block text-sm font-semibold">Area
          {areas.length
            ? <select className="inp mt-1 font-normal" value={f.area} onChange={set('area')}>{areas.map(a => <option key={a}>{a}</option>)}</select>
            : <input className="inp mt-1 font-normal" value={f.area} onChange={set('area')} maxLength={60} />}</label>
        <label className="block text-sm font-semibold">Catatan (opsional)
          <textarea className="inp mt-1 font-normal" rows={2} maxLength={300} value={f.note} onChange={set('note')} /></label>
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.hp} onChange={set('hp')} className="absolute -left-[9999px] w-px h-px opacity-0" />

        {mode !== 'live' && <p className="text-xs">Mode contoh: pesanan hanya disusun menjadi pesan WhatsApp.</p>}
        {err && <p role="alert" className="text-pink font-semibold">{err}</p>}
        <button className="btn bg-pink text-white w-full" disabled={busy}>{busy ? 'Mengirim…' : 'KIRIM PESANAN'}</button>
        <p className="text-xs text-center">Harga final dihitung sistem. Admin akan mengonfirmasi ketersediaan dan ongkos kirim.</p>
      </form>}
    </div>
  </div>
}
