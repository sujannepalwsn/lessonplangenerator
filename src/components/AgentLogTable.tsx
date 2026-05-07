import React from 'react';
import { motion } from 'motion/react';
import { Info, CheckCircle2, AlertCircle, Bot, Database, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface AgentLog {
  id: string;
  timestamp: string;
  event: string;
  status: 'info' | 'success' | 'warning' | 'error';
  agent: string;
}

interface AgentLogTableProps {
  logs: AgentLog[];
}

export default function AgentLogTable({ logs }: AgentLogTableProps) {
  const getStatusIcon = (status: AgentLog['status']) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAgentIcon = (agent: string) => {
    if (agent.includes('Gemini')) return <Sparkles className="h-3 w-3 text-blue-600" />;
    if (agent.includes('FreeAgent') || agent.includes('Scraper')) return <Bot className="h-3 w-3 text-orange-600" />;
    if (agent.includes('Database') || agent.includes('Supabase')) return <Database className="h-3 w-3 text-purple-600" />;
    return <Bot className="h-3 w-3 text-gray-400" />;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bot className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Agent Live Activity</h3>
        </div>
        <div className="flex items-center space-x-1">
          <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-[10px] font-medium text-gray-500 uppercase">Live</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-gray-200">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Bot className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-xs italic">Waiting for agent activity...</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-tight">Time</th>
                <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-tight">Agent</th>
                <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-tight">Event</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {logs.map((log) => (
                <motion.tr 
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="hover:bg-blue-50/30 transition-colors"
                >
                  <td className="px-4 py-2.5 whitespace-nowrap text-[10px] font-mono text-gray-400">
                    {log.timestamp}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="flex items-center space-x-1.5">
                      <div className="p-1 rounded bg-gray-100">
                        {getAgentIcon(log.agent)}
                      </div>
                      <span className="text-[10px] font-bold text-gray-700">{log.agent}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-start space-x-2">
                      <div className="mt-0.5">{getStatusIcon(log.status)}</div>
                      <span className={cn(
                        "text-xs leading-relaxed",
                        log.status === 'error' ? "text-red-600 font-medium" : 
                        log.status === 'success' ? "text-green-700 font-medium" : "text-gray-600"
                      )}>
                        {log.event}
                      </span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
