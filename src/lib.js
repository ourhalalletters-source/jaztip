// Fungsi murni (tanpa React) supaya mudah diuji. Aturannya HARUS sama dengan supabase/orders.sql.

// Status toko: sama dengan create_order() di SQL (abaikan huruf besar/kecil dan spasi).
export const isOpenStatus = s => String(s || '').trim().toUpperCase() === 'OPEN'

// "Rp 35.000" -> 35000. Teks tanpa angka, atau lebih dari 9 digit, dianggap belum ada harga.
export function parsePriceIdr(text) {
  const d = String(text || '').replace(/\D/g, '')
  if (d.length < 1 || d.length > 9) return null
  const n = parseInt(d, 10)
  return n >= 1 && n <= 50000000 ? n : null
}

export const formatIdr = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

// 0812-xxxx / 812xxxx / +62 812 xxxx -> 62812xxxx. Mengembalikan '' kalau bukan nomor Indonesia yang masuk akal.
export function normalizeWa(input) {
  let d = String(input || '').replace(/\D/g, '')
  if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (d.startsWith('8')) d = '62' + d
  return /^62\d{8,12}$/.test(d) ? d : ''
}

export const areaList = text => String(text || '').split(',').map(x => x.trim()).filter(Boolean)

export const waLink = (number, text) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`

// items: [{name, qty, price}]
export function buildOrderMessage({ orderNo, name, area, note, items, total }) {
  const lines = ['Halo admin JAZZZTIP, aku mau konfirmasi pesanan.']
  if (orderNo) lines.push('No. pesanan: ' + orderNo)
  lines.push('', ...items.map(i => `- ${i.name} x${i.qty} = ${formatIdr(i.price * i.qty)}`))
  lines.push('', 'Total: ' + formatIdr(total), '', 'Nama: ' + name, 'Area: ' + area)
  if (note) lines.push('Catatan: ' + note)
  return lines.join('\n')
}

// Pesan galat dari create_order() (RAISE EXCEPTION '<KODE>') -> kalimat untuk pelanggan.
const ORDER_ERRORS = {
  ORDER_CLOSED: 'Maaf, order sedang ditutup. Cek jadwal open berikutnya atau tanya admin.',
  INVALID_NAME: 'Nama belum benar. Pakai huruf atau angka, minimal 2 karakter.',
  INVALID_WA: 'Nomor WhatsApp belum benar. Contoh: 0812xxxxxxxx',
  INVALID_AREA: 'Area belum dipilih atau di luar area layanan.',
  INVALID_ITEMS: 'Isi keranjang tidak valid. Muat ulang halaman lalu coba lagi.',
  UNKNOWN_PRODUCT: 'Ada produk yang sudah tidak tersedia. Muat ulang halaman lalu cek keranjang.',
  PRICE_UNSET: 'Ada produk yang harganya belum diatur. Tanya admin dulu ya.',
  TOO_MANY_ORDERS: 'Terlalu banyak pesanan dari nomor ini dalam 1 jam. Coba lagi nanti atau chat admin.',
}
export function orderErrorMessage(raw) {
  const m = String(raw || '')
  const code = Object.keys(ORDER_ERRORS).find(k => m.includes(k))
  return code ? ORDER_ERRORS[code] : 'Pesanan belum terkirim. Cek koneksi lalu coba lagi, atau chat admin.'
}

// Keranjang disimpan di browser (opsional, gagal pun tidak masalah).
const KEY = 'jazzztip-cart'
export function loadCart() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}')
    const out = {}
    for (const [id, q] of Object.entries(o)) if (Number.isInteger(q) && q >= 1 && q <= 99) out[id] = q
    return out
  } catch { return {} }
}
export function saveCart(cart) {
  try { localStorage.setItem(KEY, JSON.stringify(cart)) } catch { /* abaikan */ }
}
