import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Key, Globe, Cpu, ShieldCheck, CheckCircle2 } from 'lucide-react';

export function Settings() {
  const [keys, setKeys] = useState({
    gemini: '',
    groq: '',
    huggingface: '',
    ollama_url: 'http://localhost:11434',
    ollama_model: 'llama3'
  });
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const savedKeys = localStorage.getItem('ai_api_keys');
    if (savedKeys) {
      setKeys(JSON.parse(savedKeys));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('ai_api_keys', JSON.stringify(keys));
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleClear = () => {
    if (confirm('Clear all saved API keys?')) {
      localStorage.removeItem('ai_api_keys');
      localStorage.removeItem('preferred_agent');
      setKeys({
        gemini: '',
        groq: '',
        huggingface: '',
        ollama_url: 'http://localhost:11434',
        ollama_model: 'llama3'
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <SettingsIcon className="text-white w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">AI Configurations</h2>
            <p className="text-slate-500 text-sm">Provide your own API keys to bypass platform limits.</p>
          </div>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-bold text-sm">Settings saved successfully!</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Gemini */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Globe className="w-3 h-3" /> Gemini API Key
              </label>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-indigo-600 hover:underline">Get Key</a>
            </div>
            <input
              type="password"
              value={keys.gemini}
              onChange={e => setKeys({...keys, gemini: e.target.value})}
              placeholder="Enter your Google Gemini API Key"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
            />
          </div>

          {/* Groq */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Key className="w-3 h-3" /> Groq API Key
              </label>
              <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-[10px] text-indigo-600 hover:underline">Get Key</a>
            </div>
            <input
              type="password"
              value={keys.groq}
              onChange={e => setKeys({...keys, groq: e.target.value})}
              placeholder="Enter your Groq API Key"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
            />
          </div>

          {/* Hugging Face */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <ShieldCheck className="w-3 h-3" /> Hugging Face Token
              </label>
              <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-[10px] text-indigo-600 hover:underline">Get Token</a>
            </div>
            <input
              type="password"
              value={keys.huggingface}
              onChange={e => setKeys({...keys, huggingface: e.target.value})}
              placeholder="Enter your Hugging Face Access Token"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
            />
          </div>

          {/* Ollama */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Cpu className="w-3 h-3" /> Ollama URL
              </label>
              <input
                type="text"
                value={keys.ollama_url}
                onChange={e => setKeys({...keys, ollama_url: e.target.value})}
                placeholder="http://localhost:11434"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Cpu className="w-3 h-3" /> Ollama Model
              </label>
              <input
                type="text"
                value={keys.ollama_model}
                onChange={e => setKeys({...keys, ollama_model: e.target.value})}
                placeholder="llama3"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
              />
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleSave}
              className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" /> Save Configuration
            </button>
            <button
              onClick={handleClear}
              className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-lg hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl">
        <h4 className="text-amber-800 font-bold mb-2 flex items-center gap-2 uppercase text-xs">
          <ShieldCheck className="w-4 h-4" /> Privacy Note
        </h4>
        <p className="text-amber-700 text-sm leading-relaxed">
          Your API keys are stored locally in your browser's <strong>localStorage</strong>. They are only sent to the backend proxy for the duration of the request and are never stored on our servers.
        </p>
      </div>
    </div>
  );
}
