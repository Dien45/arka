# 📦 Virtual Workspace - Arka

## 🎯 Overview

Arka sekarang punya **Virtual Workspace** - sistem file virtual yang tersimpan di browser memory (localStorage). AI bisa langsung buat file tanpa perlu pilih folder fisik!

## ✨ Fitur

### 1. **Virtual File System**
- File tersimpan di localStorage browser
- Auto-save setiap kali AI buat/edit file
- Persistent across sessions
- Real-time sync dengan File Explorer

### 2. **Tools yang Support Virtual Workspace**

#### `write_file`
```json
{
  "name": "write_file",
  "parameters": {
    "path": "index.html",
    "content": "<html>...</html>"
  }
}
```
- Langsung buat file di virtual workspace
- Tidak perlu pilih folder
- File otomatis muncul di File Explorer

#### `read_file`
```json
{
  "name": "read_file",
  "parameters": {
    "path": "index.html"
  }
}
```
- Baca file dari virtual workspace
- Return content lengkap

#### `list_files`
```json
{
  "name": "list_files",
  "parameters": {
    "path": "/"
  }
}
```
- List semua file di virtual workspace
- Show size dan modified time

### 3. **File Explorer Integration**
- Virtual workspace muncul sebagai folder terpisah
- Icon: 📦 Virtual Workspace
- Real-time update ketika AI buat file
- Bisa buka, edit, copy, delete file
- Tab system untuk multiple files

## 🚀 Cara Pakai

### Contoh 1: AI Buat File
```
User: "Buatkan login.html"
AI: [write_file tool]
{
  "path": "login.html",
  "content": "<html>...</html>"
}
→ File langsung muncul di File Explorer
```

### Contoh 2: Lihat File yang Dibuat
```
User: "Apa aja file yang udah dibuat?"
AI: [list_files tool]
→ Show list semua file di virtual workspace
```

### Contoh 3: Edit File
```
User: "Tambahin CSS ke login.html"
AI: [read_file tool] → baca content
AI: [write_file tool] → tulis content baru
→ File ter-update di File Explorer
```

## 📊 Storage

**Lokasi:** `localStorage.getItem('arka-virtual-files')`

**Format:**
```json
{
  "index.html": {
    "content": "<html>...</html>",
    "modified": "2024-01-20T10:30:00.000Z",
    "size": 1234
  },
  "style.css": {
    "content": "body { ... }",
    "modified": "2024-01-20T10:31:00.000Z",
    "size": 567
  }
}
```

## 🔄 Sync Mechanism

1. **AI buat file** → write ke localStorage
2. **File Explorer** → listen storage changes setiap 1 detik
3. **Auto-refresh** → virtual files muncul otomatis
4. **Real-time** → ga perlu refresh page

## 🎨 UI/UX

### File Explorer View
```
📦 Virtual Workspace
  ├── 📄 login.html (6.3 KB, untracked)
  ├── 📄 style.css (1.2 KB, untracked)
  └── 📄 script.js (2.4 KB, untracked)

📁 arka-project (mock)
  ├── 📁 src/
  │   └── 📁 components/
  │       ├── 📄 App.tsx
  │       └── 📄 Header.tsx
  └── 📄 README.md
```

### Features
- ✅ Virtual workspace di top
- ✅ Mock workspace di bawah
- ✅ Icon berbeda (📦 vs 📁)
- ✅ Git status: untracked (hijau)
- ✅ File size dan modified time
- ✅ Click to open in tab

## 🔧 Technical Details

### Tools Implementation
```typescript
// write_file
execute: async (params) => {
  const virtualFiles = JSON.parse(localStorage.getItem('arka-virtual-files') || '{}');
  virtualFiles[params.path] = {
    content: params.content,
    modified: new Date().toISOString(),
    size: params.content.length,
  };
  localStorage.setItem('arka-virtual-files', JSON.stringify(virtualFiles));
  return `✅ File "${params.path}" berhasil dibuat`;
}
```

### File Explorer Integration
```typescript
// Load virtual files
useEffect(() => {
  const loadVirtualFiles = () => {
    const files = JSON.parse(localStorage.getItem('arka-virtual-files') || '{}');
    setVirtualFiles(files);
  };
  
  loadVirtualFiles();
  const interval = setInterval(loadVirtualFiles, 1000);
  return () => clearInterval(interval);
}, []);

// Convert to FileNode
const getVirtualFileNodes = (): FileNode[] => {
  return Object.entries(virtualFiles).map(([path, file]) => ({
    id: `virtual-${path}`,
    name: path.split('/').pop() || path,
    type: 'file',
    content: file.content,
    language: detectLanguage(path),
    size: `${(file.size / 1024).toFixed(1)} KB`,
    modified: new Date(file.modified).toLocaleString('id-ID'),
    gitStatus: 'untracked',
  }));
};
```

## 💡 Tips

### Untuk AI
- Selalu pake `write_file` untuk buat file baru
- Pake `read_file` dulu sebelum edit
- Pake `list_files` untuk cek file yang ada
- Path bisa pake folder: `src/App.tsx`, `components/Header.tsx`

### Untuk User
- File virtual muncul otomatis di File Explorer
- Ga perlu pilih folder fisik
- File persistent di browser
- Bisa export/download file kapan aja

## 🎯 Use Cases

### 1. **Quick Prototyping**
```
User: "Buatkan landing page sederhana"
AI: [write_file] index.html, style.css, script.js
→ Langsung jadi, bisa preview di browser
```

### 2. **Code Generation**
```
User: "Generate React component untuk login form"
AI: [write_file] components/LoginForm.tsx
→ Component langsung tersedia di workspace
```

### 3. **Documentation**
```
User: "Buatkan README.md untuk project ini"
AI: [write_file] README.md
→ Dokumentasi langsung jadi
```

## 🚧 Limitations

- ⚠️ Storage limit: ~5-10MB (browser dependent)
- ⚠️ Ga bisa run file langsung (perlu download dulu)
- ⚠️ Ga ada version control (git integration coming soon)
- ⚠️ Ga bisa share file antar browser/device

## 🔮 Future Enhancements

- [ ] Export/Download all files as ZIP
- [ ] Git integration (commit virtual files)
- [ ] File preview (HTML, images)
- [ ] Drag & drop upload
- [ ] File sharing via URL
- [ ] Cloud sync (optional)
- [ ] File versioning
- [ ] Collaborative editing

## 📝 Summary

Virtual Workspace bikin Arka jadi lebih powerful:
- ✅ AI bisa langsung buat file tanpa ribet
- ✅ User ga perlu setup folder fisik
- ✅ Real-time sync dengan File Explorer
- ✅ Persistent di browser
- ✅ Perfect untuk quick prototyping

Sekarang Arka bisa jadi **full coding assistant** yang beneran! 🚀
