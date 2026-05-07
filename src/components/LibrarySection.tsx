import React from 'react';
import { motion } from 'motion/react';
import { List, Search, Folder, Trash2, Eye, Copy, Loader2, AlertCircle, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { Book } from '../types';

interface LibrarySectionProps {
  allBooks: Book[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  deleteBook: (id: string) => void;
  isProcessing: boolean;
}

export default function LibrarySection({ allBooks, searchTerm, setSearchTerm, deleteBook, isProcessing }: LibrarySectionProps) {
  const filteredBooks = allBooks.filter(book => 
    book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.class.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-sm">
            <Folder className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Book Library</h2>
            <p className="text-sm text-gray-600">Manage and view your ingested textbooks</p>
          </div>
        </div>
        
        <div className="relative group max-w-md w-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, subject, or grade..."
            className="block w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="p-0">
        {filteredBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Folder className="h-16 w-16 mb-4 opacity-10" />
            <p className="text-lg font-medium">No books found</p>
            <p className="text-sm">Try adjusting your search or upload a new book</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Book Details</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Subject</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Grade</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Added On</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {filteredBooks.map((book) => (
                  <motion.tr 
                    key={book.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-blue-50/30 transition-colors group"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-600 transition-colors">
                          <FileText className="h-5 w-5 text-blue-600 group-hover:text-white transition-colors" />
                        </div>
                        <span className="text-sm font-bold text-gray-900">{book.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[11px] font-bold uppercase tracking-tight">
                        {book.subject}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[11px] font-bold uppercase tracking-tight">
                        Grade {book.class}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm text-gray-500">
                      {book.created_at ? new Date(book.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => window.open(book.file_path, '_blank')}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="View PDF"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => deleteBook(book.id!)}
                          disabled={isProcessing}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Book"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
