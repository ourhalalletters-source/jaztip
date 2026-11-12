import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const configured = Boolean(url && key)
export const supabase = configured ? createClient(url, key) : null
export const DEFAULT_SETTINGS = { whatsapp:'6281234567890', status:'OPEN', open_date:'1 – 7 Desember 2026', deadline:'7 Desember 2026, 20.00 WIB', eta:'2 – 3 hari setelah deadline', area:'Kediri Kota, Mrican, Prambon, Warujayeng', route:'KEDIRI KOTA – MRICAN – PRAMBON – WARUJAYENG', instagram:'jazzztipkediri_' }
export const DEFAULT_PRODUCTS = [
 {id:'d1',name:'Tiramisu Dubai Pistachio Kunafa',price:'Rp 35.000',description:'Tiramisu creamy dengan pistachio dan kunafa renyah.'},
 {id:'d2',name:'Tiramisu Chocomory',price:'Rp 28.000',description:'Tiramisu cokelat lembut, favorit anak kos.'},
 {id:'d3',name:'Soft Cookies',price:'Rp 15.000',description:'Cookies tebal, lumer di tengah.'},
 {id:'d4',name:'Bagel',price:'Rp 20.000',description:'Bagel isi cream cheese, cocok buat sarapan.'},
 {id:'d5',name:'Jajanan Viral Lainnya',price:'Rp 10.000',description:'Tanya admin, menu berubah tiap open jastip.'}]
// live: data asli dari Supabase. failed: Supabase terkonfigurasi tapi gagal dimuat (data contoh TIDAK boleh dipakai untuk order/simpan).
export async function loadData(){
  if(!configured) return { settings:DEFAULT_SETTINGS, products:DEFAULT_PRODUCTS, live:false, failed:false }
  try{
    const [s,p] = await Promise.all([supabase.from('settings').select('*').eq('id',1).maybeSingle(), supabase.from('products').select('*').order('created_at')])
    if(s.error||p.error) throw (s.error||p.error)
    return { settings:{...DEFAULT_SETTINGS,...(s.data||{})}, products:p.data||[], live:true, failed:false }
  }catch(e){
    return { settings:DEFAULT_SETTINGS, products:DEFAULT_PRODUCTS, live:false, failed:true }
  }
}

// Checkout: harga dihitung di database (create_order), bukan dari browser.
export const createOrder = o => supabase.rpc('create_order', { p_name:o.name, p_wa:o.wa, p_area:o.area, p_note:o.note||'', p_items:o.items })
