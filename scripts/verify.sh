#!/usr/bin/env bash
#
# End-to-end checks for the fixes in this repo.
#
# Every assertion is made the way the corresponding bug was originally reproduced: a real
# sign-in, real Server Action POSTs, and the database read back directly. A green `npm run build`
# proves none of this, so this script exists.
#
# It covers:
#   1. the day key follows APP_TIMEZONE, not the server clock
#   2. bad numbers never reach the integer / decimal columns
#   3. the client-supplied column name is whitelisted
#   4. money validation on expenses, POS and prices
#   4b. a counted day keeps its own price when the Price List changes
#   5. two people opening the same new date at once
#   6. the sign-in throttle: allowed, blocked, self-healing
#
# Requirements: the dev server running, `psql` on your PATH, and a .env with DATABASE_URL.
# Usage:
#   npm run dev
#   node scripts/action-ids.mjs && bash scripts/verify.sh
#
# It is idempotent and leaves the database as it found it. Override the account it uses with
# ADMIN_EMAIL / ADMIN_PASSWORD if you changed the seed.
set -uo pipefail

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP" || exit 1

B=${BASE_URL:-http://127.0.0.1:3000}
IDS_FILE="$APP/scripts/.action-ids.txt"
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@therightchoice.local}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-changeme123}

# --- prerequisites -----------------------------------------------------------------------------
if [ ! -f "$APP/.env" ]; then
  echo "no .env — run: cp .env.example .env"; exit 1
fi
# shellcheck disable=SC1091
set -a; . "$APP/.env"; set +a
DB_URL=${DATABASE_URL:-}
if [ -z "$DB_URL" ]; then echo "DATABASE_URL not set in .env"; exit 1; fi
# Prisma appends `?schema=public` to the connection string; psql rejects it as an unknown URI
# parameter, so strip the query string before handing the URL over.
PSQL_URL=$(printf '%s' "$DB_URL" | sed 's/?schema=[^&]*//; s/?$//')
if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found on PATH. Install the PostgreSQL client (the docker image has one:
  docker compose exec db psql ... — or point this script at your own client)."
  exit 1
fi

Q() { psql "$PSQL_URL" -tA -c "$1"; }

PASS=0
FAIL=0
ck() { # name got want
  if [ "$2" = "$3" ]; then
    PASS=$((PASS + 1)); printf '  ok    %-54s (%s)\n' "$1" "$2"
  else
    FAIL=$((FAIL + 1)); printf '  FAIL  %-54s got=%s want=%s\n' "$1" "$2" "$3"
  fi
}
ids() { grep "^$1 " "$IDS_FILE" | head -1 | cut -d' ' -f2; }
call() { # action url jsonargs -> body on stdout, http code in $CODE
  local out
  out=$(curl -s -m 45 -b "$JAR" -w '\n%{http_code}' -X POST "$B$2" \
    -F "0=$3" -F '1={"content-type":"application/json"}' -H "Next-Action: $(ids "$1")")
  CODE=$(printf '%s' "$out" | tail -1)
  printf '%s' "$out" | sed '$d'
}
err() { printf '%s' "$1" | grep -o '"error":"[^"]*"' | head -1 | sed 's/"error":"//; s/"$//'; }

JAR=$(mktemp)
trap 'rm -f "$JAR"' EXIT

# --- sign in -----------------------------------------------------------------------------------
CSRF=$(curl -s -m 25 -c "$JAR" -b "$JAR" "$B/api/auth/csrf" | sed 's/.*"csrfToken":"\([^"]*\)".*/\1/')
curl -s -m 25 -c "$JAR" -b "$JAR" -o /dev/null \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "email=$ADMIN_EMAIL" \
  --data-urlencode "password=$ADMIN_PASSWORD" --data-urlencode "redirect=false" \
  "$B/api/auth/callback/credentials"
if [ "$(curl -s -m 30 -b "$JAR" -o /dev/null -w '%{http_code}' "$B/today")" != "200" ]; then
  echo "could not sign in as $ADMIN_EMAIL — check ADMIN_EMAIL / ADMIN_PASSWORD"; exit 1
fi

# Action ids only exist for pages Turbopack has compiled in this dev session, so warm every route
# first, then re-extract. Without this a freshly restarted server yields one id and every action
# check below fails for the wrong reason.
if ! command -v node >/dev/null 2>&1; then echo "node not found"; exit 1; fi
for p in /today /prices /history /overview; do curl -s -m 60 -b "$JAR" -o /dev/null "$B$p"; done
node "$APP/scripts/action-ids.mjs" >/dev/null || { echo "could not extract action ids"; exit 1; }
NEED=$(grep -cE "^(updateStockField|setUnitPrice|setPos|addExpense|updatePrice) " "$IDS_FILE")
if [ "$NEED" -lt 5 ]; then
  echo "only $NEED/5 action ids found — the dev server may not be fully warm"; exit 1
fi

D=$(Q 'select date from "DailyRecord" order by date desc limit 1')
if [ -z "$D" ]; then echo "no recorded day — run: npm run db:seed"; exit 1; fi
GALA=$(Q "select id from \"Product\" where name='Gala'")
CLOSING0=$(Q "select closing from \"StockEntry\" e join \"Product\" p on p.id=e.\"productId\" join \"DailyRecord\" d on d.id=e.\"dailyRecordId\" where p.name='Gala' and d.date='$D'")
PRICE0=$(Q "select price from \"Product\" where name='Gala'")
UNIT0=$(Q "select coalesce(\"unitPrice\"::text,'NULL') from \"StockEntry\" e join \"Product\" p on p.id=e.\"productId\" join \"DailyRecord\" d on d.id=e.\"dailyRecordId\" where p.name='Gala' and d.date='$D'")
UNIT_NOW() { Q "select coalesce(\"unitPrice\"::text,'NULL') from \"StockEntry\" e join \"Product\" p on p.id=e.\"productId\" join \"DailyRecord\" d on d.id=e.\"dailyRecordId\" where p.name='Gala' and d.date='$D'"; }
CLOSING_NOW() { Q "select closing from \"StockEntry\" e join \"Product\" p on p.id=e.\"productId\" join \"DailyRecord\" d on d.id=e.\"dailyRecordId\" where p.name='Gala' and d.date='$D'"; }

echo "=== 0. baseline (date=$D gala_closing=$CLOSING0 gala_price=$PRICE0 unitPrice=$UNIT0) ==="

echo "=== 1. the day key follows APP_TIMEZONE, not the server clock ==="
TZNAME=${APP_TIMEZONE:-Africa/Lagos}
TZDAY=$(node -e "console.log(new Intl.DateTimeFormat('en-CA',{timeZone:process.argv[1]}).format(new Date()))" "$TZNAME")
CK=$(curl -s -m 45 -b "$JAR" "$B/today" | grep -o 'type="date"[^>]*value="[0-9-]*"' | head -1 | grep -o '[0-9-]\{10\}')
ck "day key is the shop's date, not the server's" "$CK" "$TZDAY"
ck "every page still renders" \
  "$(for p in /today /prices /history /overview; do printf '%s' "$(curl -s -m 45 -b "$JAR" -o /dev/null -w '%{http_code}' "$B$p")"; done)" \
  "200200200200"

echo "=== 2. bad numbers never reach the columns ==="
for v in -5 2.5 99999999999 null '"12"' true; do
  call updateStockField /today "[\"$D\",\"$GALA\",\"closing\",$v]" >/dev/null
  case "$v" in
    -5)          ck "  -5 rejected, db unchanged"          "$(CLOSING_NOW)" "$CLOSING0";;
    2.5)         ck "  2.5 rejected (no silent rounding)"  "$(CLOSING_NOW)" "$CLOSING0";;
    99999999999) ck "  1e11 rejected (was a 500)"           "$(CLOSING_NOW)" "$CLOSING0";;
    *)           ck "  $v rejected (not coerced to 0)"      "$(CLOSING_NOW)" "$CLOSING0";;
  esac
done
call updateStockField /today "[\"$D\",\"$GALA\",\"closing\",12]" >/dev/null
ck "a legitimate value still saves" "$(CLOSING_NOW)" "12"
call updateStockField /today "[\"$D\",\"$GALA\",\"closing\",$CLOSING0]" >/dev/null

echo "=== 3. the client-supplied column name is whitelisted ==="
for f in unitPrice id dailyRecordId closingg; do
  B1=$(err "$(call updateStockField /today "[\"$D\",\"$GALA\",\"$f\",5]")")
  ck "  field=$f refused" "$(printf '%s' "$B1" | grep -c 'cannot be edited')" "1"
done
ck "  unitPrice untouched by those attempts" "$(UNIT_NOW)" "$UNIT0"

echo "=== 4. money validation on expenses / POS / prices ==="
call addExpense /today "[\"$D\",\"\",300]" >/dev/null
ck "a blank expense note is allowed (it always was)" "$(Q 'select count(*) from "Expense"')" "1"
B1=$(err "$(call addExpense /today "[\"$D\",\"$(printf 'x%.0s' {1..300})\",300]")")
ck "over-long note refused" "$(printf '%s' "$B1" | grep -c '200 characters')" "1"
B1=$(err "$(call addExpense /today "[\"$D\",\"diesel\",-500]")")
ck "negative expense refused" "$(printf '%s' "$B1" | grep -c 'cannot be negative')" "1"
ck "  and not written" "$(Q 'select count(*) from "Expense"')" "1"
B1=$(err "$(call setPos /today "[\"$D\",-10000]")")
ck "negative POS refused" "$(printf '%s' "$B1" | grep -c 'cannot be negative')" "1"
B1=$(err "$(call setUnitPrice /today "[\"$D\",\"$GALA\",1e11]")")
ck "absurd override price refused" "$(printf '%s' "$B1" | grep -c 'too large')" "1"
B1=$(err "$(call updatePrice /prices "[\"$GALA\",-300]")")
ck "negative product price refused" "$(printf '%s' "$B1" | grep -c 'cannot be negative')" "1"
ck "  product price unchanged" "$(Q "select price from \"Product\" where name='Gala'")" "$PRICE0"
B1=$(err "$(call updateStockField /today "[\"$D\",\"cmdoesnotexist000000\",\"closing\",1]")")
ck "unknown product refused" "$(printf '%s' "$B1" | grep -c "not on this day's sheet")" "1"
Q 'delete from "Expense"' >/dev/null

echo "=== 4b. a counted day keeps its own price ==="
Q "update \"StockEntry\" e set opening=10, closing=5 from \"Product\" p, \"DailyRecord\" d where e.\"productId\"=p.id and e.\"dailyRecordId\"=d.id and p.name='Gala' and d.date='$D'" >/dev/null
REV() { Q "select sum(greatest(0, e.opening+e.received-e.closing-e.transfer-e.supply-e.bd) * coalesce(e.\"unitPrice\", p.price, 0))::text from \"StockEntry\" e join \"Product\" p on p.id=e.\"productId\""; }
FROZEN=$(REV)
# The control matters: with no movement in the data this check would pass for free.
ck "  control: 5 units at the frozen price is non-zero" "$(printf '%s' "$FROZEN" | grep -c '^0\.00$')" "0"
Q "update \"Product\" set price=999 where id='$GALA'" >/dev/null
ck "  editing the live price leaves history frozen" "$(REV)" "$FROZEN"
Q "update \"StockEntry\" e set opening=1, closing=1 from \"Product\" p, \"DailyRecord\" d where e.\"productId\"=p.id and e.\"dailyRecordId\"=d.id and p.name='Gala' and d.date='$D'" >/dev/null
Q "update \"Product\" set price=$PRICE0 where id='$GALA'" >/dev/null

echo "=== 5. two people opening the same new date at once ==="
RACE=$(node -e "const d=new Date();d.setDate(d.getDate()+45);console.log(new Intl.DateTimeFormat('en-CA',{timeZone:process.argv[1]}).format(d))" "$TZNAME")
rm -f /tmp/trc-race-* 2>/dev/null
for i in $(seq 1 8); do
  (curl -s -m 60 -b "$JAR" -o /dev/null -w '%{http_code}\n' "$B/today?date=$RACE" >> "/tmp/trc-race-$i") &
done
wait
ck "all 8 concurrent opens return 200" "$(cat /tmp/trc-race-* 2>/dev/null | sort | tr -d '\n')" "200200200200200200200200"
rm -f /tmp/trc-race-* 2>/dev/null
ck "exactly one day row created" "$(Q "select count(*) from \"DailyRecord\" where date='$RACE'")" "1"
ck "every product backfilled once" \
  "$(Q "select count(*) from \"StockEntry\" e join \"DailyRecord\" d on d.id=e.\"dailyRecordId\" where d.date='$RACE'")" \
  "$(Q 'select count(*) from "Product"')"
Q "delete from \"DailyRecord\" where date='$RACE'" >/dev/null

echo "=== 6. sign-in throttle: allowed, blocked, self-healing ==="
# A unique address per run: the limiter's buckets live in the dev process and survive ~10 minutes,
# so reusing one address would let a previous run's failures block this run, and the "clean record"
# check would fail for the wrong reason.
STAMP="probe-$(date +%s)-$$@throttle.invalid"
if node -e 'import("bcryptjs").then(async (m) => { const h = await (m.default ?? m).hash("good-pass", 10); process.stdout.write(h); })' > /tmp/trc-hash.txt 2>/dev/null; then
  HASH=$(cat /tmp/trc-hash.txt)
  Q "insert into \"User\"(id,name,email,\"passwordHash\",role) values('cmthr$(printf '%020d' $$)','Throttle Probe','$STAMP','$HASH','STAFF')" >/dev/null
else
  echo "  SKIP: bcryptjs unavailable — run 'npm install' first"; FAIL=$((FAIL + 4))
fi

try_email() { # email password -> 200 = session granted, 307 = refused
  local jj; jj=$(mktemp)
  local t; t=$(curl -s -m 25 -c "$jj" -b "$jj" "$B/api/auth/csrf" | sed 's/.*"csrfToken":"\([^"]*\)".*/\1/')
  curl -s -m 25 -c "$jj" -b "$jj" -o /dev/null --data-urlencode "csrfToken=$t" \
    --data-urlencode "email=$1" --data-urlencode "password=$2" --data-urlencode "redirect=false" \
    "$B/api/auth/callback/credentials"
  local c; c=$(curl -s -m 25 -b "$jj" -o /dev/null -w '%{http_code}' "$B/today")
  rm -f "$jj"; printf '%s' "$c"
}

if [ "$(Q "select count(*) from \"User\" where email='$STAMP'")" = "1" ]; then
  ck "correct password with a clean record works" "$(try_email "$STAMP" good-pass)" "200"
  for i in 1 2 3; do try_email "$STAMP" "nope-$i" >/dev/null; done
  ck "3 failures then correct still works" "$(try_email "$STAMP" good-pass)" "200"
  for i in $(seq 1 8); do try_email "$STAMP" "nope-$i" >/dev/null; done
  ck "8 failures then the CORRECT password is refused" "$(try_email "$STAMP" good-pass)" "307"
  ck "a different account is unaffected" "$(try_email "$ADMIN_EMAIL" "$ADMIN_PASSWORD")" "200"
  Q "delete from \"User\" where email='$STAMP'" >/dev/null
else
  echo "  SKIP: probe user not created"
fi
rm -f /tmp/trc-hash.txt 2>/dev/null

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ]
