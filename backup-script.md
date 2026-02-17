BIN_ID="6993496043b1c97be983d918"
MASTER_KEY="$2a$10$GeeaO.HWzOMwBMOrF3XkceZdVwaMcJgr.sqx.pCWF/sSR2VfzFZrq"   # 你 config.js 裡那串
OUT="src/backup/jsonbin-backup-$(date +%Y%m%d-%H%M%S).json"

curl -sS "https://api.jsonbin.io/v3/b/${BIN_ID}/latest?meta=false" \
  -H "X-Master-Key: ${MASTER_KEY}" \
  -o "${OUT}"

echo "Saved: ${OUT}"
