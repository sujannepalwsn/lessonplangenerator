import React, { useState, useEffect } from 'react';
import { Play, Loader2, CheckCircle2, XCircle, Clock, Search, ChevronRight, Layers, LayoutList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface AgentLog {
  id: string;
  file_name: string;
  source_url: string;
  status: 'success' | 'failure' | 'skipped' | 'processing';
  agent_type: 'gemini' | 'free-agent';
  error_if_any?: string;
  created_at: string;
}

interface Iteration {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'idle';
  total_files: number;
  processed_files: number;
}

function getBackendUrl() {
  const savedKeysRaw = localStorage.getItem('ai_api_keys');
  if (savedKeysRaw) {
    const keys = JSON.parse(savedKeysRaw);
    if (keys.backend_url) return keys.backend_url;
  }
  return import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
}

export function AutonomousDashboard() {
  const [startUrl, setStartUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [iteration, setIteration] = useState<Iteration | null>(null);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);

  const fetchStatus = async () => {
    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/autonomous/status`);

      if (!response.ok) {
         // Silently handle 404 or other errors during initial polling
         setIsBackendConnected(false);
         return;
      }

      const data = await response.json();
      setIsBackendConnected(true);
      if (data.status) {
        setStatus(data.status);
        setIteration(data.iteration);
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch autonomous status:', err);
      setIsBackendConnected(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    if (!startUrl) return;
    setIsLoading(true);
    setError(null);
    try {
      // 1. Validate URL format first
      new URL(startUrl);

      // 2. Check backend health
      const backendUrl = getBackendUrl();
      const healthCheck = await fetch(`${backendUrl}/health`).catch(() => null);
      if (!healthCheck || !healthCheck.ok) {
        throw new Error(`Cannot connect to Backend Agent at ${backendUrl}. Please ensure the server is running or check your Settings.`);
      }

      // Get keys from localStorage
      const savedKeysRaw = localStorage.getItem('ai_api_keys');
      const userKeys = savedKeysRaw ? JSON.parse(savedKeysRaw) : {};

      try {
        const response = await fetch(`${backendUrl}/api/autonomous/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: startUrl, userKeys })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to start ingestion');
      } catch (err: any) {
        if (err.message.includes('Failed to fetch') || err.message.includes('net::ERR_CONNECTION_REFUSED')) {
           throw new Error(`Connection to AI Agent failed. Please ensure the backend server is running at ${backendUrl} or check your Settings.`);
        }
        throw err;
      }

      setStatus('running');
      setError(null);
    } catch (err: any) {
      if (err.message.includes('connect')) {
        setError(<>Agent server is not responding. Start it with <code className="bg-red-100 px-1 rounded">npm run server</code> in your terminal.</>);
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const progress = iteration && iteration.total_files > 0
    ? (iteration.processed_files / iteration.total_files) * 100
    : 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Control Panel */}
      <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Layers className="text-white w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-800">Autonomous Ingestion</h2>
              {isBackendConnected !== null && (
                <div className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
                  isBackendConnected ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", isBackendConnected ? "bg-emerald-500" : "bg-red-500")}></div>
                  {isBackendConnected ? "Agent Online" : "Agent Offline"}
                </div>
              )}
            </div>
            <p className="text-slate-500 text-sm">Discover, Extract & Upload PDF books automatically.</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="url"
              placeholder="Target website URL (e.g. https://openstax.org/subjects/science)"
              value={startUrl}
              onChange={e => setStartUrl(e.target.value)}
              disabled={status === 'running'}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <button
            onClick={handleStart}
            disabled={status === 'running' || !startUrl || isLoading}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 shrink-0"
          >
            {status === 'running' ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> In Progress...</>
            ) : (
              <><Play className="w-5 h-5 fill-current" /> Start Autonomous Mode</>
            )}
          </button>
        </div>
        {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
      </section>

      {/* Progress & Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Progress Card */}
          <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <LayoutList className="w-5 h-5 text-indigo-600" /> Iteration Progress
              </h3>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                status === 'running' ? "bg-amber-100 text-amber-600" :
                status === 'completed' ? "bg-emerald-100 text-emerald-600" :
                "bg-slate-100 text-slate-500"
              )}>
                {status}
              </span>
            </div>

            {status !== 'idle' && iteration && (
              <div className="space-y-6">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-3xl font-black text-slate-800">{iteration.processed_files} / {iteration.total_files}</p>
                    <p className="text-sm text-slate-500 font-medium">PDFs Processed</p>
                  </div>
                  <p className="text-lg font-bold text-indigo-600">{Math.round(progress)}%</p>
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-indigo-600 rounded-full"
                  />
                </div>
              </div>
            )}

            {status === 'idle' && (
              <div className="py-10 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>No active iteration. Enter a URL and start autonomous mode.</p>
              </div>
            )}
          </section>

          {/* Structured Logs */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Processing Logs</h3>
              <span className="text-xs font-bold text-slate-400 uppercase">{logs.length} Recent actions</span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {logs.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {logs.map((log) => (
                    <div key={log.id} className="p-6 hover:bg-slate-50 transition-all flex items-start gap-4">
                      <div className={cn(
                        "mt-1 p-2 rounded-lg shrink-0",
                        log.status === 'success' ? "bg-emerald-50 text-emerald-600" :
                        log.status === 'failure' ? "bg-red-50 text-red-600" :
                        "bg-slate-100 text-slate-400"
                      )}>
                        {log.status === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
                         log.status === 'failure' ? <XCircle className="w-5 h-5" /> :
                         <Clock className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="font-bold text-slate-800 truncate">{log.file_name}</h4>
                          <span className={cn(
                            "text-[10px] font-black uppercase px-2 py-0.5 rounded-md",
                            log.agent_type === 'gemini' ? "bg-indigo-100 text-indigo-600" : "bg-amber-100 text-amber-600"
                          )}>
                            {log.agent_type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mb-2">{log.source_url}</p>
                        {log.error_if_any && (
                          <div className="bg-red-50 text-red-700 text-[10px] p-2 rounded-lg border border-red-100 font-mono">
                            Error: {log.error_if_any}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center text-slate-400">
                  <p>Log entries will appear here once processing starts.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Checklist Sidebar */}
        <div className="lg:col-span-1">
          <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm sticky top-24">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Pipeline Checklist
            </h3>

            <div className="space-y-6">
              {[
                { label: 'Discovery Agent', desc: 'Finding PDF links on site', active: status === 'running' && progress === 0 },
                { label: 'Metadata Extractor', desc: 'Reading headers and labels', active: status === 'running' && progress > 0 && progress < 100 },
                { label: 'Supabase Storage', desc: 'Uploading & deduplicating', active: status === 'running' && progress > 0 && progress < 100 },
                { label: 'Iterative Loop', desc: 'Processing queue items', active: status === 'running' },
                { label: 'Completion', desc: 'Finalizing iteration logs', active: status === 'completed' }
              ].map((item, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      item.active ? "border-indigo-600 bg-indigo-50 text-indigo-600 animate-pulse" :
                      (status === 'completed' || (status === 'running' && i < 3)) ? "border-emerald-500 bg-emerald-500 text-white" :
                      "border-slate-200 text-slate-200"
                    )}>
                      {(status === 'completed' || (status === 'running' && i < 3)) ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-3 h-3" />}
                    </div>
                    {i < 4 && <div className={cn("w-0.5 h-10 mt-1", item.active ? "bg-indigo-100" : "bg-slate-50")}></div>}
                  </div>
                  <div>
                    <h4 className={cn("text-sm font-bold transition-all", item.active ? "text-indigo-600" : "text-slate-700")}>{item.label}</h4>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Supervisor Status</h5>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-xs font-bold text-slate-700">Gemini-First Mode Active</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Automatically switches to Free-Agent on 429 quota errors.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
