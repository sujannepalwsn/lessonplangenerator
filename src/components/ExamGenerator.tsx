import React, { useState, useEffect } from 'react';
import { Upload, FileText, Sparkles, Loader2, Plus, Trash2, Download, Eye, FileCheck } from 'lucide-react';
import { downloadExamPDF } from '../lib/pdfUtils';
import { getSupabase } from '../lib/supabase';
import { Book } from '../types';
import { cn } from '../lib/utils';

export function ExamGenerator({ agent }: { agent?: string }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<string>('');
  const [examTitle, setExamTitle] = useState('');
  const [totalMarks, setTotalMarks] = useState(100);
  const [duration, setDuration] = useState(180);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cdcGridFile, setCdcGridFile] = useState<File | null>(null);
  const [samplePaperFile, setSamplePaperFile] = useState<File | null>(null);
  const [generatedPaper, setGeneratedPaper] = useState<any>(null);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    const supabase = getSupabase();
    const { data } = await supabase.from('books').select('*');
    setBooks(data || []);
  };

  const handleGenerate = async () => {
    if (!selectedBook || !examTitle) return;
    setIsGenerating(true);

    try {
      const supabase = getSupabase();

      // 1. Fetch book contents for context
      const { data: contents } = await supabase
        .from('book_contents')
        .select('topic, content')
        .eq('book_id', selectedBook)
        .limit(20);

      const bookContext = contents?.map(c => `Topic: ${c.topic}\nContent: ${c.content}`).join('\n\n') || '';

      // 2. Prepare files if any - use Supabase storage to avoid 413 payload limits
      const uploadedPaths: string[] = [];
      let fileInstruction = '';

      const uploadFile = async (file: File) => {
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `temp_exams/${fileName}`;
        const { error } = await supabase.storage.from('books').upload(filePath, file);
        if (!error) uploadedPaths.push(filePath);
        return filePath;
      };

      if (cdcGridFile) await uploadFile(cdcGridFile);
      if (samplePaperFile) await uploadFile(samplePaperFile);

      if (cdcGridFile && samplePaperFile) {
        fileInstruction = "Analyze both provided PDFs: one contains the CDC Specification Grid and the other a Sample Question Paper. Strictly follow the grid's mark distribution and the sample's format.";
      } else if (cdcGridFile) {
        fileInstruction = "Strictly follow the structure and mark distribution found in the provided CDC Specification Grid PDF.";
      } else if (samplePaperFile) {
        fileInstruction = "Use the provided Question Sample PDF as a template for the format and style of questions.";
      }

      // 3. Call API
      const savedKeysRaw = localStorage.getItem('ai_api_keys');
      const userKeys = savedKeysRaw ? JSON.parse(savedKeysRaw) : {};

      let backendUrl = userKeys.backend_url || import.meta.env.VITE_BACKEND_URL;
      if (!backendUrl) {
        backendUrl = import.meta.env.PROD ? window.location.origin : 'http://localhost:3001';
      }

      const response = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: agent || 'gemini',
          userKeys,
          pdfPaths: uploadedPaths.length > 0 ? uploadedPaths : undefined,
          jsonMode: true,
          prompt: `Generate a complete exam paper based on the following context.

          EXAM DETAILS:
          Title: ${examTitle}
          Total Marks: ${totalMarks}
          Duration: ${duration} minutes

          BOOK CONTEXT:
          ${bookContext}

          ${fileInstruction || "Create a standard balanced exam structure (MCQs, Short Answers, Long Answers)."}

          Return a JSON object with this schema:
          {
            "title": string,
            "total_marks": number,
            "duration": number,
            "sections": [
              {
                "title": string,
                "marks_per_question": number,
                "questions": string[]
              }
            ]
          }`
        })
      });

      if (!response.ok) throw new Error('Failed to generate exam');
      const result = await response.json();
      const paperData = JSON.parse(result.response);
      setGeneratedPaper(paperData);

      // 4. Save to Supabase
      const { error: dbError } = await supabase.from('exam_papers').insert({
        title: paperData.title,
        subject: books.find(b => b.id === selectedBook)?.subject || 'Unknown',
        class: books.find(b => b.id === selectedBook)?.class || 'General',
        duration_minutes: paperData.duration,
        total_marks: paperData.total_marks,
        questions: paperData.sections
      });
      if (dbError) console.error('Failed to save exam to DB:', dbError);

    } catch (err) {
      console.error(err);
      alert('Failed to generate exam: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <FileText className="text-indigo-600 w-6 h-6" /> Exam Paper Generator
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase">Exam Title</label>
              <input
                type="text"
                placeholder="e.g. First Terminal Examination 2081"
                value={examTitle}
                onChange={e => setExamTitle(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase">Total Marks</label>
                <input
                  type="number"
                  value={totalMarks}
                  onChange={e => setTotalMarks(parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase">Duration (mins)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={e => setDuration(parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase">Select Book Context</label>
              <select
                value={selectedBook}
                onChange={e => setSelectedBook(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">-- Select Book --</option>
                {books.map(b => <option key={b.id} value={b.id}>{b.title} (Class {b.class})</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 border-dashed">
              <h3 className="text-sm font-bold text-indigo-700 uppercase mb-4 flex items-center gap-2">
                <FileCheck className="w-4 h-4" /> Specification Grid & Samples
              </h3>

              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500">CDC Specification Grid (PDF)</label>
                  <input
                    type="file"
                    onChange={e => setCdcGridFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500">Question Sample/Format (PDF)</label>
                  <input
                    type="file"
                    onChange={e => setSamplePaperFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedBook || !examTitle}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Sparkles className="w-6 h-6" /> Generate Exam Paper</>}
            </button>
          </div>
        </div>
      </div>

      {generatedPaper && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-lg animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-slate-800 text-white p-8">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold uppercase tracking-widest">{generatedPaper.title}</h1>
              <div className="flex justify-center gap-8 text-sm font-medium opacity-80">
                <span>Time: {Math.floor(generatedPaper.duration / 60)} hrs {generatedPaper.duration % 60} mins</span>
                <span>Full Marks: {generatedPaper.total_marks}</span>
              </div>
            </div>
          </div>

          <div className="p-10 space-y-10">
            {generatedPaper.sections.map((section: any, sIdx: number) => (
              <div key={sIdx} className="space-y-6">
                <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2">
                  <h3 className="font-bold text-lg uppercase">{section.title}</h3>
                  <span className="text-sm font-bold">[{section.questions.length} × {section.marks_per_question} = {section.questions.length * section.marks_per_question}]</span>
                </div>
                <div className="space-y-4">
                  {section.questions.map((q: string, qIdx: number) => (
                    <div key={qIdx} className="flex gap-4">
                      <span className="font-bold">{qIdx + 1}.</span>
                      <p className="text-slate-800 font-medium">{q}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-end gap-4">
            <button
              onClick={() => downloadExamPDF(generatedPaper)}
              className="px-6 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <button
              onClick={() => window.print()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <Eye className="w-4 h-4" /> Print Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
