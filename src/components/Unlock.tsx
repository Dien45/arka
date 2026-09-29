import { useState } from 'react';
import { Lock, ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useVault } from '../store';

export default function Unlock() {
  const { unlock } = useVault();
  const [passphrase, setPassphrase] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    if (!passphrase) return;
    setLoading(true);
    setError('');
    const ok = await unlock(passphrase);
    setLoading(false);
    if (!ok) {
      setError('Passphrase salah, atau data terenkripsi rusak.');
    }
  };

  return (
    <div className="h-dvh w-screen flex items-center justify-center bg-[#f0f4f8] p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border border-[#b8c9db]">
        <div className="flex flex-col items-center mb-5 text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7c9cbf] to-[#5a7fa0] flex items-center justify-center mb-3">
            <Lock size={22} className="text-white" />
          </div>
          <h2 className="font-bold text-[#334155]">Data Arka Terkunci</h2>
          <p className="text-xs text-[#64748b] mt-1">
            API key provider &amp; token GitHub kamu dienkripsi di perangkat ini. Masukkan passphrase untuk membuka sesi.
          </p>
        </div>
        <div className="relative mb-2">
          <input
            type={show ? 'text' : 'password'}
            value={passphrase}
            onChange={e => setPassphrase(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            placeholder="Passphrase"
            autoFocus
            className="w-full px-3 py-2.5 pr-10 rounded-lg border border-[#b8c9db] text-sm focus:border-[#7c9cbf] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[#e8eef4] text-[#64748b]"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-[#c97878] text-xs mb-3">
            <AlertCircle size={12} /> {error}
          </div>
        )}
        <button
          onClick={handleUnlock}
          disabled={!passphrase || loading}
          className="w-full py-2.5 rounded-lg bg-[#7c9cbf] text-white text-sm font-medium hover:bg-[#5a7fa0] disabled:opacity-40 transition-colors flex items-center justify-center gap-2 mt-2"
        >
          <ShieldCheck size={14} /> {loading ? 'Membuka...' : 'Buka'}
        </button>
        <p className="text-[10px] text-[#94a3b8] text-center mt-4">
          Lupa passphrase? Tidak ada cara memulihkan data terenkripsi tanpa itu. Kamu bisa menghapus data lokal lewat DevTools
          (Application → Local Storage) untuk memulai dari awal.
        </p>
      </div>
    </div>
  );
}
