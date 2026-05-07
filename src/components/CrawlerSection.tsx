import React from 'react';
import { motion } from 'motion/react';
import { Globe, Search, Loader2, Link as LinkIcon, CheckCircle2, Bot, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface CrawlerSectionProps {
  crawlerUrl: string;
  setCrawlerUrl: (url: string) => void;
  isCrawling: boolean;
  crawlSiteForPDFs: () => void;
  activeAgent: 'Gemini' | 'FreeAgent';
}

export default function CrawlerSection({ crawlerUrl, setCrawlerUrl, isCrawling, crawlSiteForPDFs, activeAgent }: CrawlerSectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-xl shadow-sm">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Autonomous Site Crawler</h2>
              <p className="text-sm text-gray-600">Discover and extract PDF textbooks from any website</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 px-3 py-1 bg-white/80 backdrop-blur-sm rounded-full border border-blue-100 shadow-sm">
            {activeAgent === 'Gemini' ? (
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            ) : (
              <Bot className="h-3.5 w-3.5 text-orange-600" />
            )}
            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">
              {activeAgent} Active
            </span>
          </div>
        </div>
      </div>
      
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Globe className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="url"
              value={crawlerUrl}
              onChange={(e) => setCrawlerUrl(e.target.value)}
              placeholder="https://example.com/textbooks"
              className="block w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
            />
            <button
              onClick={crawlSiteForPDFs}
              disabled={isCrawling || !crawlerUrl}
              className="absolute right-2 top-2 bottom-2 px-6 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center space-x-2"
            >
              {isCrawling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Crawling...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>Start Crawl</span>
                </>
              )}
            </button>
          </div>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start space-x-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="mt-1 p-1.5 bg-blue-100 rounded-lg">
                <LinkIcon className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 uppercase tracking-tight">Discovery</p>
                <p className="text-[11px] text-gray-500 leading-relaxed">Intelligently identifies PDF links across the page</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="mt-1 p-1.5 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 uppercase tracking-tight">Deduplication</p>
                <p className="text-[11px] text-gray-500 leading-relaxed">Automatically skips books already in your library</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="mt-1 p-1.5 bg-purple-100 rounded-lg">
                <Bot className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 uppercase tracking-tight">Autonomous</p>
                <p className="text-[11px] text-gray-500 leading-relaxed">Handles metadata extraction and storage automatically</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
