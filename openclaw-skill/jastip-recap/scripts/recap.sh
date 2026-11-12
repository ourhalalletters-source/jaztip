#!/usr/bin/env bash
# Rekap pesanan JAZZZTIP KEDIRI (read-only) lewat fungsi bot_recap() di Supabase.
# Pemakaian:  recap.sh [YYYY-MM-DD] [jumlah_hari] [--names]
#   tanpa argumen      -> hari ini (WIB)
#   YYYY-MM-DD         -> tanggal akhir periode
#   angka 1..31        -> mundur sekian hari (termasuk tanggal akhir)
#   --names            -> sertakan nama pelanggan (hanya bila admin memintanya)
# Variabel lingkungan yang wajib: JASTIP_SUPABASE_URL, JASTIP_SUPABASE_ANON_KEY, JASTIP_BOT_TOKEN
set -euo pipefail

: "${JASTIP_SUPABASE_URL:?JASTIP_SUPABASE_URL belum diisi}"
: "${JASTIP_SUPABASE_ANON_KEY:?JASTIP_SUPABASE_ANON_KEY belum diisi}"
: "${JASTIP_BOT_TOKEN:?JASTIP_BOT_TOKEN belum diisi}"

DATE=""; DAYS=1; NAMES=false
for a in "$@"; do
  case "$a" in
    --names) NAMES=true ;;
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) DATE="$a" ;;
    [0-9]|[0-9][0-9]) DAYS="$a" ;;
    *) echo "Argumen tidak dikenal: $a (pakai YYYY-MM-DD, angka hari, atau --names)" >&2; exit 2 ;;
  esac
done
[[ "$JASTIP_BOT_TOKEN" =~ ^[0-9a-f]{32,128}$ ]] || { echo "Format JASTIP_BOT_TOKEN tidak benar (harus hex)." >&2; exit 2; }

if [[ -n "$DATE" ]]; then DATE_JSON="\"$DATE\""; else DATE_JSON="null"; fi
BODY=$(printf '{"p_token":"%s","p_date":%s,"p_days":%s,"p_with_names":%s}' "$JASTIP_BOT_TOKEN" "$DATE_JSON" "$DAYS" "$NAMES")

RESP=$(curl -sS --max-time 20 -X POST "${JASTIP_SUPABASE_URL%/}/rest/v1/rpc/bot_recap" \
  -H "apikey: $JASTIP_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JASTIP_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY" -w $'\n%{http_code}')
CODE="${RESP##*$'\n'}"; OUT="${RESP%$'\n'*}"

if [[ "$CODE" != "200" ]]; then
  if grep -q UNAUTHORIZED <<<"$OUT"; then
    echo "UNAUTHORIZED: token bot salah atau sudah dicabut. Admin perlu membuat token baru." >&2
  else
    echo "Gagal mengambil rekap (HTTP $CODE): $OUT" >&2
  fi
  exit 1
fi
printf '%s\n' "$OUT"
