import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ApiKeyManager({ onClose }: { onClose: () => void }) {
  const [keys, setKeys] = useState<string[]>([]);
  const [newKey, setNewKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    const savedKeys = JSON.parse(localStorage.getItem('user_gemini_api_keys') || '[]');
    setKeys(savedKeys);
  }, []);

  const addKey = () => {
    if (!newKey.trim()) return;
    if (keys.includes(newKey.trim())) {
      setError('This key is already added.');
      return;
    }
    
    const updatedKeys = [...keys, newKey.trim()];
    setKeys(updatedKeys);
    localStorage.setItem('user_gemini_api_keys', JSON.stringify(updatedKeys));
    setNewKey('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
    setError(null);
  };

  const removeKey = (index: number) => {
    const updatedKeys = keys.filter((_, i) => i !== index);
    setKeys(updatedKeys);
    localStorage.setItem('user_gemini_api_keys', JSON.stringify(updatedKeys));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="p-6 bg-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <Key className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold">Manage API Keys</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-500 leading-relaxed">
            Add multiple Gemini API keys to bypass rate limits. The system will automatically rotate through them if one gets exhausted.
          </p>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Add New Key</label>
            <div className="flex gap-2">
              <input 
                type="password" 
                placeholder="AIzaSy..." 
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-mono"
              />
              <button 
                onClick={addKey}
                className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
            {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</p>}
            {success && <p className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Key added successfully!</p>}
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Keys ({keys.length + 1})</label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <span className="text-sm font-mono text-slate-400">Primary System Key</span>
                </div>
                <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded uppercase font-bold">System</span>
              </div>
              
              {keys.map((key, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 group animate-in fade-in slide-in-from-right-2">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full" />
                    <span className="text-sm font-mono text-slate-600">
                      {key.substring(0, 8)}...{key.substring(key.length - 4)}
                    </span>
                  </div>
                  <button 
                    onClick={() => removeKey(idx)}
                    className="p-1 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
