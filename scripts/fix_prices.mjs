#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

/* =========================
   🔐 ENV
========================= */
const SUPABASE_URL="https://idkznzsdqkqlopnltmac.supabase.co"
const SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlka3puenNkcWtxbG9wbmx0bWFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQyMDA3OSwiZXhwIjoyMDg3OTk2MDc5fQ.aWgTOr6iN2x843FlVJP3y7en7Rq1wHvyEvObwzdCzAQ"

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/* =========================
   🌱 RAW INPUT (PASTE FULL LIST HERE)
========================= */
const RAW_TEXT = `
1		Alat  bantu	set	 Rp 50,000.00 
2		Asphalt Distributor	jam	 Rp 307,300.00 
3		Asphalt  finisher	jam	 Rp 602,500.00 
4		Asphalt  liquid mixer 1000 ℓ	jam	 Rp 61,100.00 
5		Asphalt  mixing plant	jam	 Rp 6,253,800.00 
6		Asphalt  sprayer 850 ℓ	jam	 Rp 74,900.00 
7		Bender baja beton	hari	 Rp 850,000.00 
8		Blending equipment	jam	 Rp 235,000.00 
9		Bore pile machine	jam	 Rp 476,900.00 
10		Bulldozer 100-150 HP	jam	 Rp 912,500.00 
11		Chain saw	jam	 Rp 60,200.00 
12		Chainsaw 20”; 5,5HP	hari	 Rp 300,000.00 
13		Chainsaw 30”; 7,5HP	hari	 Rp 300,000.00 
14		Cold milling machine	jam	 Rp 648,500.00 
15		Colt T-120 (D); R-Blk. 4; 12 m3	jam	#REF!
16		Compressor 4000-6500 ℓ\m	jam	 Rp 185,500.00 
17		Compressor bor	unit	 Rp 700,000.00 
18		Concrete mixer 350 ℓ	jam	 Rp 94,600.00 
19		Concrete mixer 500 ℓ	jam	 Rp 103,400.00 
20		Concrete mixer truck 5 m³	jam	 Rp 576,100.00 
21		Concrete pan mixer	jam	 Rp 800,700.00 
22		Concrete pump	jam	 Rp 296,800.00 
23		Concrete slip form paver	jam	 Rp 582,400.00 
24		Concrete vibrator	hari	 Rp 800,000.00 
25		Crane on track 35 ton	jam	 Rp 440,800.00 
26		Crane Truck 3 ton; Winch 5 Ton	jam	#REF!
27		Crane on wheel 10-15 ton	jam	 Rp 359,800.00 
28		Cutter baja beton	hari	 Rp 800,000.00 
29		Cutting machine	jam	 Rp 55,100.00 
30		Depresiasi alat  compressor	hari	 Rp 425,000.00 
31		Depresiasi mesin pompa uji	hari	 Rp 42,000.00 
32		Depresiasi peralatan pemboran	hari	 Rp 265,000.00 
33		Dump truck 1	jam	 Rp 556,100.00 
34		Dump truck 2	jam	 Rp 556,100.00 
35		Dump truck 3	jam	 Rp 556,100.00 
36		Dump truck 20 ton	jam	 Rp 556,100.00 
37		Dump truck 3,5 ton	jam	 Rp 304,800.00 
38		Dump truck 40 ton	jam	 Rp 676,500.00 
39		Dump truck 7,5 ton	jam	 Rp 344,400.00 
40		Pick up L300	jam	#REF!
41		Fuso (D); R-Blk. 8; 35 m3	jam	 Rp 418,543.76 
42		Flat deck truck 7 ton	hari 	 Rp 2,700,000.00 
43		Hoist 1 ton 	hari 	 Rp 180,000.00 
44		Excavator 95 HP	jam	 Rp 480,000.00 
45		Excavator 	Hari 	 Rp 5,150,000.00 
46		Excavator 80-140 HP	jam	 Rp 668,200.00 
47		Flat  bed truck 3-4 m³	jam	 Rp 465,100.00 
48		Generator set  135 KVA	jam	 Rp 410,200.00 
49		Jack hammer	hari	 Rp 350,000.00 
50		Jack hammer + genset	hari	 Rp 2,300,000.00 
51		Sewa Genset 	hari 	 Rp 150,000.00 
52		Logging	unit	 Rp 280,000.00 
53		Mata bor auger 20 cm	hari	 Rp 100,000.00 
54		Mata bor auger 30 cm	hari	 Rp 170,000.00 
55		Mata bor auger 40 cm	hari	 Rp 250,000.00 
56		Mata bor auger 50 cm	hari	 Rp 340,000.00 
57		Mesin bor	unit	 Rp 450,000.00 
58		Mesin gilas  2 roda 6 - 10 ton	jam	 Rp 325,000.00 
59		Mesin gilas  3 roda 6 - 10 ton	jam	 Rp 350,000.00 
60		Mesin gilas  roda karet  8 - 10 ton	jam	 Rp 415,000.00 
61		Mesin kerek	unit	 Rp 50,000.00 
62		Mesin poles	hari	 Rp 150,000.00 
63		Mesin trowel	jam	 Rp 45,000.00 
64		Mesin Gendong	Jam 	 Rp 150,000.00 
65		Motor grader >100 HP	jam	 Rp 548,600.00 
66		Pedestrian Roller	jam	 Rp 99,800.00 
67		Pile driver +  hammer 2,5 ton	jam	 Rp 153,400.00 
68		Pneumatic  tire roller 8-10 ton	jam	 Rp 491,000.00 
69		Pompa beton ∅ 2,5", 75KW; 120 bar, T= 50 m'/H=80 m’	hari	 Rp 6,600,000.00 
70		Pompa beton ∅ 2,5",20 KW; 20 bar, T = 18 m'	hari	 Rp 6,300,000.00 
71		Pompa beton ∅ 3",140KW; 180 bar, T = 75 m' / H=150 m'	hari	 Rp 8,000,000.00 
72		Pompa beton φ 1,5";5 KW; 8 bar; T = 5 m'	hari	 Rp 6,000,000.00 
73		Pompa injeksi	unit	 Rp 300,000.00 
74		Pompa tangan	unit	 Rp 160,000.00 
75		Road Marking Machine	jam	 Rp 491,000.00 
76		Sewa alat cutting machine	hari	 Rp 25,000.00 
77		Sewa alat las	hari	 Rp 25,000.00 
78		Alat las listrik 	jam 	 Rp 3,125.00 
79		Alat las listrik 150 A	jam 	 Rp 3,125.00 
80		Alat las listrik 250 A	jam 	 Rp 3,125.00 
81		Alat las listrik 350 A	jam 	 Rp 3,125.00 
82		Alat las listrik 500 A	jam 	 Rp 3,125.00 
83		Mesin Las Gotextile	hari 	 Rp 25,000.00 
84		Kunci Momen 	hari	 Rp 20,000.00 
85		Sewa bor horisontal	hari	 Rp 150,000.00 
86		Sewa Scaffolding :		
87		- ScaffoldingPipe brancing 3 m	bulan	 Rp 8,800.00 
88		- Scaffolding Pipe brancing 6 m	bulan	 Rp 17,600.00 
89		Sewa Scaffolding	hari	 Rp 586.67 
90		Sewa Gondola 	hari	 Rp 322,000.00 
91		Sewa Pipe Support	hari 	 Rp 850.00 
92		Stamper	jam	 Rp 35,000.00 
93		Sprayer Gendong 	Hari 	 Rp 350,000.00 
94		Stamper Kodok 150 kg 	Hari 	 Rp 350,000.00 
95		Stamper Kuda 	hari 	 Rp 290,000.00 
96		Stamper D-Drum 	hari 	 Rp 310,000.00 
97		Stamper Smooth_Drum	hari 	 Rp 350,000.00 
98		Stang bor, batang bor dia. 1-1/4"	hari	 Rp 95,000.00 
99		Stone crusher	jam	 Rp 799,500.00 
100		Tandem roller 6-8 ton	jam	 Rp 469,500.00 
101		Theodolit	hari	 Rp 150,000.00 
102		Three wheel roller	jam	 Rp 262,300.00 
103		P. Tyre Roller 	jam 	 Rp 275,000.00 
104		Tower crane arm 30 m	hari	 Rp 3,442,900.00 
105		Crane 	hari 	 Rp 3,442,900.00 
106		Crane 	jam 	 Rp 430,000.00 
107		Sewa Crane kapasitas 1 ton 	jam 	 Rp 430,000.00 
108		Transportasi peralatan drailler	unit	 Rp 500,000.00 
109		Vibratory plate tamper	jam	 Rp 58,800.00 
110		Vibratory roller 1 ton	jam	 Rp 95,000.00 
111		Vibratory roller 5-8 ton	jam	 Rp 392,200.00 
112		Water pump 70-100 mm	jam	 Rp 71,700.00 
113		Water tanker truck 3000-4000 ℓ	jam	 Rp 255,200.00 
114		Water Truck 	hari 	 Rp 1,550,000.00 
115		Waterpass	hari	 Rp 75,000.00 
116		Wheel loader	jam	 Rp 472,400.00 
117		AMP 	Jam 	 Rp 3,981,125.00 
118		Asphalt Finisher 	Jam 	 Rp 450,000.00 
119		Wheel loader 1,0-1,6 m³	jam	 Rp 472,400.00 
120		Alat  pancang Hammer 0.5 ton	hari	 Rp 350,000.00 
121		Alat Pancang Mini Pile	hari 	 Rp 250,000.00 
122		Alat pancang Hidraulik Pile Driver	hari 	 Rp 487,000.00 
123		Alat  penyambung tiang pancang dolken	hari	 Rp 350,000.00 
124		Alat Penyambung Balok	buah 	 Rp 200,000.00 
125		Alat Penyambung Beton 	buah 	 Rp 250,000.00 
126		Alat Penyambung Beton dia. 30 cm	buah 	 Rp 250,000.00 
127		Alat Penyambung Beton dia. 35 cm	buah 	 Rp 255,000.00 
128		Alat sambung kayu terbuat dari baja	buah 	 Rp 250,000.00 
129		Sepatu pancang	buah 	 Rp 124,500.00 
130		Sepatu pancang beton	buah 	 Rp 124,500.00 
131		Sepatu Pancang dia. 30 cm	buah 	 Rp 135,000.00 
132		Sepatu Pancang dia. 35 cm	buah 	 Rp 140,000.00 
133		Crawler Crane 10 Ton + Ladder 14 ton	jam 	 Rp 500,000.00 
134		Crawler Crane 20 Ton + Ladder 14 ton	jam 	 Rp 550,000.00 
135		Driver Hammer	jam 	 Rp 50,000.00 
136		Driver Hammer 2 ton	jam 	 Rp 50,000.00 
137		Sewa Mesin Hydroseeding 2000L 	liter 	 Rp 350,000.00 
138		Angkur/mur/baut	set	 Rp 45,000.00 
139		Angkur M16 	buah 	 Rp 18,500.00 
140		Beton Neser	batang	 Rp 52,000.00 
141		BP (Biaya Penyambungan)	VA	 Rp 969.00 
142		Cutting stiker +  pasang	buah	 Rp 15,000.00 
143		Gergaji besi	buah	 Rp 3,500.00 
144		GIL  (Gambar Instalasi Langganan), administrasi pemasangan	VA	 Rp 850.00 
145		Linggis (baja keras)	buah	 Rp 30,000.00 
146		Mesin bor (jam)	jam	 Rp 85,000.00 
147		Molen beton mixer 350 liter	hari	 Rp 300,000.00 
148		Mesin Molen 1m3	hari 	 Rp 300,000.00 
149		Pahat beton (baja keras)	buah	 Rp 15,000.00 
150		Palu/godam (baja keras)	buah	 Rp 25,000.00 
151		Perapian lokasi kerja	ls	 Rp 20,000.00 
152		Pisau Gerinda	buah	 Rp 52,000.00 
153		Pompa Air,   diesel 10 KW	hari	 Rp 500,000.00 
154		Pompa Air,   diesel 20 KW	hari	 Rp 1,000,000.00 
155		Pompa Air,   diesel 5 KW	hari	 Rp 250,000.00 
156		Pompa Sedot	hari	 Rp 280,000.00 
157		Pompa Sedot Pasir 	hari 	 Rp 280,000.00 
158		Pompa Lumpur 	hari 	 Rp 260,000.00 
159		Mobil Sedot Lumpur 	Jam	 Rp 67,500.00 
160		Boom Lift 	hari	 Rp 3,300,000.00 
161		Pompa submesible	unit	 Rp 1,920,000.00 
162		Pressure grout machine 30 KW; 60 -75 bar (D)	jam	 Rp 42,000.00 
163		Sewa alat  cutting machine	hari	 Rp 44,000.00 
164		Sewa bekisting	hari	 Rp 7,500.00 
165		Sewa bekisting rigid	hari	 Rp 7,500.00 
166		Sewa bor horisontal	hari	 Rp 150,000.00 
167		Sewa mobil crane	hari	 Rp 1,450,000.00 
168		Sewa mobil crane kapasitas  15 Ton	hari	 Rp 3,400,000.00 
169		Sewa mobil crane kapasitas  25 Ton	hari	 Rp 6,250,000.00 
170		Sewa mobil crane kapasitas  5 Ton	hari	 Rp 1,450,000.00 
171		Sewa tangga 7 meter	buah	 Rp 50,000.00 
172		Sewa tangga 7 meter	hari	 Rp 50,000.00 
173		Tandon Air kap. 2 m3 	hari 	 Rp 25,000.00 
174		Tangga Service 	buah 	 Rp 1,144,000.00 
175		SLO (Sertifikat  Laik Operasi)	VA	 Rp 30.00 
176		Tripod tinggi 5 m	hari	 Rp 250,000.00 
177		Truck Crane 5 ton	jam	 Rp 525,000.00 
178		UJL  (Uang Jaminan Langganan)	VA	 Rp 165.00 
179		Sewa casing PVC dia. 20 cm	m	 Rp 25,000.00 
180		Sewa casing pipa baja dia. 30 cm	m	 Rp 30,700.00 
181		Sewa casing pipa baja dia. 40 cm	m	 Rp 43,500.00 
182		Sewa casing pipa baja dia. 50 cm	m	 Rp 55,800.00 
183		Pengelasan	cm	 Rp 332.00 
184		Baja Strip 	kg 	 Rp 28,000.00 
`

/* =========================
   🧠 HELPERS
========================= */
function normalizeName(name) {
  return String(name).toLowerCase().replace(/\s+/g, ' ').trim()
}

/* 🔥 PRICE PARSER BASED ON "Rp" */
function parsePriceFromRp(line) {
  if (!line || line.includes('#REF')) return null

  const match = String(line).match(/Rp\s*([0-9.,]+)/i)
  if (!match) return null

  let s = match[1]

  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf('.') > s.lastIndexOf(',')) {
      s = s.replace(/,/g, '')
    } else {
      s = s.replace(/\./g, '').replace(',', '.')
    }
  } else {
    s = s.replace(/,/g, '')
  }

  const num = Number(s)
  return isNaN(num) ? null : Math.round(num)
}

/* =========================
   🌊 PARSER
========================= */
function parseRawText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const results = []

  for (const line of lines) {
    if (!/^\d+/.test(line)) continue
    if (!line.includes('Rp')) continue // only trust Rp lines

    const parts = line.split(/\t+/).map(p => p.trim()).filter(Boolean)

    if (parts.length < 2) continue

    const name = parts[1]
    const unit = parts[2] || ''

    const price = parsePriceFromRp(line)

    if (!name || price === null) continue

    results.push({ name, unit, price })
  }

  return results
}

/* =========================
   🚀 MAIN
========================= */
async function main() {
  console.log("🌱 Parsing raw alat...")

  const parsed = parseRawText(RAW_TEXT)

  console.log(`Parsed: ${parsed.length} valid rows`)

  console.log("🌿 Fetching existing work_items...")

  const { data: existing = [], error } = await supabase
    .from('work_items')
    .select('name')

  if (error) {
    console.error("❌ Fetch error:", error.message)
    return
  }

  const existingSet = new Set(existing.map(e => normalizeName(e.name)))

  const toInsert = parsed.filter(r => !existingSet.has(normalizeName(r.name)))

  console.log(`New rows to insert: ${toInsert.length}`)

  if (!toInsert.length) {
    console.log("✨ Nothing new to insert.")
    return
  }

  const { error: insertErr } = await supabase
    .from('work_items')
    .insert(
      toInsert.map(r => ({
        name: r.name,
        unit: r.unit,
        price: r.price
      }))
    )

  if (insertErr) {
    console.error("❌ Insert failed:", insertErr.message)
  } else {
    console.log("✨ Done. Clean alat inserted into work_items.")
  }
}

main().catch(err => {
  console.error("❌ Fatal error:", err)
})