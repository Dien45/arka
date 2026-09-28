# 📦 Cara Membuat Custom Skill untuk Arka

Sekarang lu bisa install skill custom dari GitHub URL dan **otomatis ke-detect sama AI**! 🚀

## 🎯 Format Repository

Bikin repo GitHub dengan struktur kayak gini:

```
my-awesome-skill/
├── skill.json          # Metadata skill (optional)
├── prompt.md           # Enhancement prompt untuk AI (optional)
└── README.md           # Dokumentasi
```

## 📄 File `skill.json` (Optional)

File ini buat define metadata skill:

```json
{
  "name": "My Awesome Skill",
  "description": "Skill keren buat bantu coding",
  "author": "username-github",
  "version": "1.0.0",
  "icon": "🎨",
  "category": "Custom",
  "enhancement": "When user asks about [topic], you MUST:\n- Do this\n- Do that\n- Be awesome"
}
```

### Field yang Bisa Dipake:
- **`name`** (required): Nama skill
- **`description`** (required): Deskripsi skill
- **`author`**: Author/creator
- **`version`**: Versi skill
- **`icon`**: Emoji icon (default: 📦)
- **`category`**: Kategori skill
- **`enhancement`**: Prompt untuk AI (bisa juga pake `prompt.md`)

## 📝 File `prompt.md` (Optional)

File ini buat define enhancement prompt yang lebih panjang:

```markdown
When user asks about Python, you MUST:
- Use Python 3.10+ features
- Follow PEP 8 style guide
- Include type hints
- Provide complete, runnable examples
- Explain complex concepts clearly
- Use async/await when appropriate
```

**Note:** Kalau ada `prompt.md`, ini yang dipake. Kalau ga ada, pake `enhancement` dari `skill.json`.

## 🚀 Cara Install

1. **Bikin repo GitHub** dengan struktur di atas
2. **Push ke GitHub**
3. **Buka Arka** → Skill Store
4. **Klik "Install dari URL"**
5. **Masukin URL repo**, contoh:
   - Full URL: `https://github.com/username/my-skill`
   - Short format: `username/my-skill`
6. **Klik Install**
7. **Done!** ✅ Skill otomatis ke-detect dan ke-pake sama AI

## 🎨 Contoh Skill

### Contoh 1: Python Expert Skill

**Repo:** `username/python-expert`

**skill.json:**
```json
{
  "name": "Python Expert",
  "description": "Python specialist dengan best practices",
  "author": "username",
  "version": "1.0.0",
  "icon": "🐍",
  "category": "Backend",
  "enhancement": "When writing Python code, you MUST:\n- Use Python 3.10+ features\n- Follow PEP 8\n- Include type hints\n- Use list comprehensions when appropriate\n- Prefer f-strings over format()"
}
```

### Contoh 2: React Testing Skill

**Repo:** `username/react-testing`

**prompt.md:**
```markdown
When testing React components, you MUST:
- Use React Testing Library
- Write tests that mimic user behavior
- Avoid testing implementation details
- Use screen queries in this order: getByRole, getByLabelText, getByText, getByTestId
- Include accessibility tests
- Mock API calls with MSW or jest.mock
- Test error states and loading states
```

### Contoh 3: Minimal Skill (Tanpa File)

Kalau lu ga mau bikin file `skill.json` atau `prompt.md`, Arka bakal pake info dari repo name:

**Repo:** `username/cool-skill`

**Auto-generated:**
- Name: `cool-skill`
- Description: `Custom skill from username/cool-skill`
- Enhancement: `Custom skill from username/cool-skill. Use this skill's capabilities when relevant.`

## 🔧 Cara Kerja

1. **Install Skill:**
   - Arka fetch `skill.json` dari repo (kalau ada)
   - Arka fetch `prompt.md` dari repo (kalau ada)
   - Simpan semua info ke localStorage

2. **Auto-Register:**
   - Custom skill otomatis ke-load setiap kali chat
   - Auto-add ke `skillDefinitions`
   - AI langsung bisa pake skill ini

3. **AI Enhancement:**
   - System prompt AI di-update dengan enhancement dari skill
   - AI otomatis pake capabilities dari skill
   - Ga perlu restart atau reload

## 💡 Tips

- **Pake `prompt.md`** buat prompt yang panjang dan detail
- **Pake `skill.json`** buat metadata yang lengkap
- **Test skill** dengan tanya AI: "apa skill [nama] udah terinstall?"
- **Update skill** dengan reinstall dari URL yang sama
- **Uninstall** dari Skill Store kalau ga dipake lagi

## 🎯 Contoh Penggunaan

**User:** "apa skill python expert udah terinstall?"

**AI:** "Iya bro! 🐍 Skill Python Expert udah aktif. Sekarang aku bakal:\n- Pake Python 3.10+ features\n- Follow PEP 8 style guide\n- Include type hints\n- Provide complete examples\n\nMau nanya tentang Python apa?"

## 🚨 Troubleshooting

**Skill ga ke-detect?**
- Cek URL repo bener
- Pastikan repo public
- Cek ada `skill.json` atau `prompt.md`
- Refresh browser dan coba lagi

**Enhancement ga ke-pake?**
- Cek format `prompt.md` atau `enhancement` di `skill.json`
- Pastikan ga ada syntax error
- Cek console browser buat error message

**Skill ilang setelah refresh?**
- Custom skill ke-save di localStorage
- Kalau ilang, berarti localStorage ke-clear
- Reinstall skill dari URL

## 🎉 Done!

Sekarang lu bisa bikin dan install custom skill dengan gampang! AI bakal otomatis detect dan pake skill yang lu install. Ga perlu manual coding lagi! 🚀
