import React from 'react';
import { motion } from 'motion/react';
import { Upload, Link as LinkIcon, FileText, Loader2, Save, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface UploadSectionProps {
  isBulkMode: boolean;
  setIsBulkMode: (mode: boolean) => void;
  bookUrl: string;
  setBookUrl: (url: string) => void;
  bulkUrls: string;
  setBulkUrls: (urls: string) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  file: File | null;
  bookMetadata: { title: string; subject: string; class: string };
  setBookMetadata: (metadata: any) => void;
  overwriteMode: boolean;
  setOverwriteMode: (mode: boolean) => void;
  uploadBookOnly: () => void;
  handleBulkUpload: () => void;
  isProcessing: boolean;
  isBulkGenerating: boolean;
  bulkProgress: number;
  bulkTotal: number;
  error: string | null;
  success: string | null;
}

export default function UploadSection({
  isBulkMode, setIsBulkMode, bookUrl, setBookUrl, bulkUrls, setBulkUrls,
  handleFileChange, file, bookMetadata, setBookMetadata, overwriteMode, setOverwriteMode,
  uploadBookOnly, handleBulkUpload, isProcessing, isBulkGenerating, bulkProgress, bulkTotal, error, success
}: UploadSectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-xl shadow-sm">
              <Upload className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Manual Ingestion</h2>
              <p className="text-sm text-gray-600">Upload single or bulk PDF textbooks manually</p>
            </div>
          </div>
          <div className="flex bg-white/80 backdrop-blur-sm p-1 rounded-xl border border-blue-100 shadow-sm">
            <button
              onClick={() => setIsBulkMode(false)}
              className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", !isBulkMode ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:text-gray-700")}
            >
              Single
            </button>
            <button
              onClick={() => setIsBulkMode(true)}
              className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", isBulkMode ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:text-gray-700")}
            >
              Bulk
            </button>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="space-y-8">
          {!isBulkMode ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-tight">Upload PDF File</label>
                  <div className="relative group">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={cn(
                      "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl transition-all",
                      file ? "bg-blue-50 border-blue-400" : "bg-gray-50 border-gray-200 group-hover:border-blue-300 group-hover:bg-blue-50/30"
                    )}>
                      <div className={cn("p-4 rounded-full mb-3", file ? "bg-blue-100" : "bg-gray-100")}>
                        <FileText className={cn("h-8 w-8", file ? "text-blue-600" : "text-gray-400")} />
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{file ? file.name : "Choose a file or drag it here"}</p>
                      <p className="text-xs text-gray-500 mt-1">PDF files only (max 50MB)</p>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 bg-white text-xs font-bold text-gray-400 uppercase tracking-widest">OR</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-tight">PDF URL</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <LinkIcon className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type="url"
                      value={bookUrl}
                      onChange={(e) => setBookUrl(e.target.value)}
                      placeholder="https://example.com/book.pdf"
                      className="block w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight flex items-center space-x-2">
                  <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                  <span>Book Metadata</span>
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Book Title</label>
                    <input
                      type="text"
                      value={bookMetadata.title}
                      onChange={(e) => setBookMetadata({ ...bookMetadata, title: e.target.value })}
                      className="block w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Subject</label>
                      <input
                        type="text"
                        value={bookMetadata.subject}
                        onChange={(e) => setBookMetadata({ ...bookMetadata, subject: e.target.value })}
                        className="block w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Grade/Class</label>
                      <input
                        type="text"
                        value={bookMetadata.class}
                        onChange={(e) => setBookMetadata({ ...bookMetadata, class: e.target.value })}
                        className="block w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 bg-white rounded-xl border border-gray-200">
                    <input
                      type="checkbox"
                      id="overwrite"
                      checked={overwriteMode}
                      onChange={(e) => setOverwriteMode(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all"
                    />
                    <label htmlFor="overwrite" className="text-xs font-semibold text-gray-700 cursor-pointer">
                      Overwrite if book already exists
                    </label>
                  </div>
                </div>

                <button
                  onClick={uploadBookOnly}
                  disabled={isProcessing || (!file && !bookUrl)}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center space-x-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      <span>Ingest to Library</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-gray-700 uppercase tracking-tight">Bulk PDF URLs</label>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">One URL per line</span>
                </div>
                <textarea
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  placeholder="https://example.com/book1.pdf&#10;https://example.com/book2.pdf"
                  rows={8}
                  className="block w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                />
                <p className="mt-3 text-[11px] text-gray-500 italic">
                  Tip: You can also use the format: <span className="font-bold text-gray-700">URL | Grade | Subject | Title</span> for explicit metadata.
                </p>
              </div>

              {isBulkGenerating && (
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                  <div className="flex justify-between text-xs font-bold text-blue-700 mb-3 uppercase tracking-wider">
                    <span>Bulk Processing Progress</span>
                    <span>{bulkProgress} / {bulkTotal} ({Math.round((bulkProgress / bulkTotal) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden shadow-inner">
                    <motion.div
                      className="bg-blue-600 h-full shadow-lg"
                      initial={{ width: 0 }}
                      animate={{ width: `${(bulkProgress / bulkTotal) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleBulkUpload}
                disabled={isProcessing || !bulkUrls.trim()}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center space-x-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing Bulk Ingestion...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    <span>Start Bulk Ingestion</span>
                  </>
                )}
              </button>
            </div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start space-x-3 p-4 bg-red-50 border border-red-100 rounded-2xl"
            >
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start space-x-3 p-4 bg-green-50 border border-green-100 rounded-2xl"
            >
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <p className="text-sm text-green-700 font-medium">{success}</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
