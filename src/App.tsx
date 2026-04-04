/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Upload, FileText, Loader2, Save, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Printer, BookOpen, Sparkles, List, GraduationCap, Book as BookIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseBookPDF, generatePlanFromContent } from './services/geminiService';
import { getSupabase } from './lib/supabase';
import { LessonPlan, Book, BookContent } from './types';
import { cn } from './lib/utils';

export default function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'generator' | 'history'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Book Data
  const [bookMetadata, setBookMetadata] = useState({ title: '', subject: '', class: '' });
  const [parsedContents, setParsedContents] = useState<Partial<BookContent>[]>([]);
  
  // Selector State
  const [availableGrades, setAvailableGrades] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableTopics, setAvailableTopics] = useState<BookContent[]>([]);
  
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<BookContent | null>(null);

  // Plans Data
  const [currentPlan, setCurrentPlan] = useState<LessonPlan | null>(null);
  const [planHistory, setPlanHistory] = useState<LessonPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Initial fetch for grades
  useEffect(() => {
    fetchGrades();
    fetchHistory();
  }, []);

  // Cascading effects
  useEffect(() => {
    if (selectedGrade) {
      fetchSubjects(selectedGrade);
      setSelectedSubject('');
      setSelectedTopic(null);
      setCurrentPlan(null);
    }
  }, [selectedGrade]);

  useEffect(() => {
    if (selectedSubject && selectedGrade) {
      fetchTopics(selectedGrade, selectedSubject);
      setSelectedTopic(null);
      setCurrentPlan(null);
    }
  }, [selectedSubject, selectedGrade]);

  useEffect(() => {
    if (selectedTopic) {
      handleAutoGenerate(selectedTopic);
    }
  }, [selectedTopic]);

  const fetchGrades = async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('books').select('class');
      if (error) throw error;
      const uniqueGrades = Array.from(new Set(data?.map(b => b.class))).filter(Boolean).sort();
      setAvailableGrades(uniqueGrades);
    } catch (err) {
      console.error('Grades fetch error:', err);
    }
  };

  const fetchSubjects = async (grade: string) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('books').select('subject').eq('class', grade);
      if (error) throw error;
      const uniqueSubjects = Array.from(new Set(data?.map(b => b.subject))).filter(Boolean).sort();
      setAvailableSubjects(uniqueSubjects);
    } catch (err) {
      console.error('Subjects fetch error:', err);
    }
  };

  const fetchTopics = async (grade: string, subject: string) => {
    try {
      const supabase = getSupabase();
      // First get the book ID
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .select('id')
        .eq('class', grade)
        .eq('subject', subject)
        .single();
      
      if (bookError) throw bookError;

      const { data, error } = await supabase
        .from('book_contents')
        .select('*')
        .eq('book_id', bookData.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setAvailableTopics(data || []);
    } catch (err) {
      console.error('Topics fetch error:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('lesson_plans').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setPlanHistory(data || []);
    } catch (err) {
      console.error('History fetch error:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        setError('Please upload a PDF file.');
        return;
      }
      setFile(selectedFile);
      setBookMetadata({ ...bookMetadata, title: selectedFile.name.replace('.pdf', '') });
      setError(null);
    }
  };

  const processBook = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const contents = await parseBookPDF(base64);
        setParsedContents(contents);
        setIsProcessing(false);
        setSuccess(`Successfully parsed ${contents.length} topics from the book!`);
      };
    } catch (err) {
      console.error(err);
      setError('An error occurred while parsing the book.');
      setIsProcessing(false);
    }
  };

  const saveBookToLibrary = async () => {
    if (parsedContents.length === 0) return;
    setIsProcessing(true);

    try {
      const supabase = getSupabase();
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .insert([bookMetadata])
        .select()
        .single();

      if (bookError) throw bookError;

      const contentsToSave = parsedContents.map(c => ({
        ...c,
        book_id: bookData.id
      }));

      const { error: contentsError } = await supabase.from('book_contents').insert(contentsToSave);
      if (contentsError) throw contentsError;

      setSuccess('Book and all contents saved to library!');
      setParsedContents([]);
      setFile(null);
      fetchGrades();
      setActiveTab('generator');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save book.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoGenerate = async (content: BookContent) => {
    setIsGenerating(true);
    setError(null);
    setCurrentPlan(null);
    setSuccess(null);

    try {
      const supabase = getSupabase();
      
      // 1. Check if a plan already exists in the database for this content
      const { data: existingPlan, error: fetchError } = await supabase
        .from('lesson_plans')
        .select('*')
        .eq('book_content_id', content.id)
        .maybeSingle();

      if (fetchError) console.error('Error checking existing plan:', fetchError);

      if (existingPlan) {
        // Use cached plan from database
        setCurrentPlan(existingPlan);
        setSuccess(`Retrieved existing plan for: ${content.topic} (No API call used)`);
        setIsGenerating(false);
        return;
      }

      // 2. If no plan exists, generate it using AI
      const plan = await generatePlanFromContent(content, selectedSubject, selectedGrade);
      
      // 3. Auto-save the generated plan to the database for future use (caching)
      const { data: savedPlan, error: saveError } = await supabase
        .from('lesson_plans')
        .insert([{ ...plan, book_content_id: content.id }])
        .select()
        .single();

      if (saveError) {
        console.error('Error auto-saving plan:', saveError);
        // Still show the plan even if save fails
        setCurrentPlan(plan);
      } else {
        setCurrentPlan(savedPlan);
      }
      
      setSuccess(`New lesson plan generated and cached for: ${content.topic}`);
      fetchHistory();
    } catch (err) {
      console.error(err);
      setError('Failed to generate or retrieve lesson plan.');
    } finally {
      setIsGenerating(false);
    }
  };

  const savePlan = async () => {
    // This is now handled automatically by handleAutoGenerate, 
    // but we can keep it for manual updates if needed or just remove it.
    if (!currentPlan) return;
    setSuccess('Plan is already saved in the database.');
  };

  const printPlan = (plan: LessonPlan) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <html>
        <head>
          <title>Lesson Plan - ${plan.lesson_topic}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.5; }
            .header { border: 2px solid #000; display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 20px; }
            .header-item { padding: 10px; border: 1px solid #eee; }
            .section { margin-bottom: 20px; }
            .section-title { font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #ccc; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            ul { margin-top: 5px; }
            li { margin-bottom: 3px; }
          </style>
        </head>
        <body>
          <h1 style="text-align: center;">Daily Lesson Plan</h1>
          <div class="header">
            <div class="header-item"><strong>Subject:</strong> ${plan.subject}</div>
            <div class="header-item"><strong>Class:</strong> ${plan.class}</div>
            <div class="header-item"><strong>Unit:</strong> ${plan.unit}</div>
            <div class="header-item"><strong>Period:</strong> ${plan.period}</div>
            <div class="header-item" style="grid-column: span 2;"><strong>Lesson Topic:</strong> ${plan.lesson_topic}</div>
            <div class="header-item" style="grid-column: span 2;"><strong>Date:</strong> ${plan.date || '_________'}</div>
          </div>
          <div class="section"><div class="section-title">1. Learning Outcomes:</div><p>${plan.learning_outcomes}</p></div>
          <div class="section"><div class="section-title">2. Warm up & Review:</div><p>${plan.warm_up_review}</p></div>
          <div class="section"><div class="section-title">3. Teaching Learning Activities:</div><ol type="a">${plan.teaching_activities.map(act => `<li>${act}</li>`).join('')}</ol></div>
          <div class="section"><div class="section-title">4. Class Review / Evaluation:</div><ol type="a">${plan.evaluation.map(ev => `<li>${ev}</li>`).join('')}</ol></div>
          <div class="section"><div class="section-title">5. Assignments:</div><div class="grid"><div><strong>Class Work:</strong><ul>${plan.class_work.map(cw => `<li>${cw}</li>`).join('')}</ul></div><div><strong>Home Assignment:</strong><ul>${plan.home_assignment.map(ha => `<li>${ha}</li>`).join('')}</ul></div></div></div>
          <div class="section"><div class="section-title">Remarks:</div><p>${plan.remarks || '________________________________________________'}</p></div>
          <div style="margin-top: 50px; display: flex; justify-content: space-between;"><div>_______________________<br>Subject Teacher's Signature</div><div>_______________________<br>Principal's Signature</div></div>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg"><FileText className="text-white w-6 h-6" /></div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">AI Lesson Planner</h1>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setActiveTab('upload')} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", activeTab === 'upload' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Upload Book</button>
            <button onClick={() => setActiveTab('generator')} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", activeTab === 'generator' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Generator</button>
            <button onClick={() => setActiveTab('history')} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", activeTab === 'history' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>History</button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence>
          {error && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3"><AlertCircle className="w-5 h-5" />{error}</motion.div>}
          {success && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl flex items-center gap-3"><CheckCircle2 className="w-5 h-5" />{success}</motion.div>}
        </AnimatePresence>

        {activeTab === 'upload' && (
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm max-w-2xl mx-auto">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">1. Upload Textbook</h2>
              <p className="text-slate-500 mb-8">Extract and store all lessons from your PDF into the system database.</p>
              
              <div className="relative group mb-6">
                <input type="file" accept=".pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className={cn("border-2 border-dashed rounded-xl p-10 transition-all flex flex-col items-center justify-center gap-4", file ? "border-indigo-400 bg-indigo-50" : "border-slate-300 group-hover:border-indigo-400 group-hover:bg-slate-50")}>
                  <div className={cn("p-4 rounded-full", file ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400")}><Upload className="w-8 h-8" /></div>
                  <p className="font-medium text-slate-700">{file ? file.name : "Click or drag PDF here"}</p>
                </div>
              </div>

              {file && !parsedContents.length && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <input type="text" placeholder="Grade/Class" value={bookMetadata.class} onChange={e => setBookMetadata({...bookMetadata, class: e.target.value})} className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <input type="text" placeholder="Subject" value={bookMetadata.subject} onChange={e => setBookMetadata({...bookMetadata, subject: e.target.value})} className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <input type="text" placeholder="Book Title" value={bookMetadata.title} onChange={e => setBookMetadata({...bookMetadata, title: e.target.value})} className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              )}

              {!parsedContents.length ? (
                <button onClick={processBook} disabled={!file || isProcessing} className={cn("w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]", !file || isProcessing ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200")}>
                  {isProcessing ? <><Loader2 className="w-6 h-6 animate-spin" /> Extracting Data...</> : "Analyze & Store Book"}
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl text-left max-h-60 overflow-y-auto border border-slate-200">
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><List className="w-4 h-4" /> Extracted Topics:</h4>
                    <ul className="space-y-2 text-sm">{parsedContents.map((c, i) => (<li key={i} className="p-2 bg-white rounded border border-slate-100"><span className="font-bold text-indigo-600">{c.unit} - {c.lesson}:</span> {c.topic}</li>))}</ul>
                  </div>
                  <button onClick={saveBookToLibrary} disabled={isProcessing} className="w-full py-4 rounded-xl font-bold text-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2">
                    {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Save className="w-6 h-6" /> Save to Database</>}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'generator' && (
          <section className="space-y-8">
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Sparkles className="text-indigo-600 w-6 h-6" /> Lesson Plan Generator</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Grade Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Select Grade</label>
                  <select 
                    value={selectedGrade} 
                    onChange={e => setSelectedGrade(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="">-- Choose Grade --</option>
                    {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                {/* Subject Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2"><BookIcon className="w-4 h-4" /> Select Subject</label>
                  <select 
                    value={selectedSubject} 
                    onChange={e => setSelectedSubject(e.target.value)}
                    disabled={!selectedGrade}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                  >
                    <option value="">-- Choose Subject --</option>
                    {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Topic Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2"><List className="w-4 h-4" /> Select Lesson/Topic</label>
                  <select 
                    value={selectedTopic?.id || ''} 
                    onChange={e => setSelectedTopic(availableTopics.find(t => t.id === e.target.value) || null)}
                    disabled={!selectedSubject}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                  >
                    <option value="">-- Choose Topic --</option>
                    {availableTopics.map(t => <option key={t.id} value={t.id}>{t.unit}: {t.topic}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Generated Plan Display */}
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                  <p className="text-slate-500 font-medium">Generating your lesson plan from database content...</p>
                </motion.div>
              ) : currentPlan ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-lg">
                  <div className="bg-indigo-600 px-8 py-6 flex items-center justify-between text-white">
                    <div>
                      <h3 className="text-2xl font-bold">{currentPlan.lesson_topic}</h3>
                      <p className="opacity-80">{currentPlan.subject} • Grade {currentPlan.class}</p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={savePlan} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all" title="Save to History"><Save className="w-5 h-5" /></button>
                      <button onClick={() => printPlan(currentPlan)} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all" title="Print Plan"><Printer className="w-5 h-5" /></button>
                    </div>
                  </div>
                  
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                      <div><h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">1. Learning Outcomes</h5><p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{currentPlan.learning_outcomes}</p></div>
                      <div><h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">2. Warm up & Review</h5><p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{currentPlan.warm_up_review}</p></div>
                      <div><h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">3. Teaching Learning Activities</h5><ul className="space-y-3">{currentPlan.teaching_activities.map((act, i) => (<li key={i} className="flex gap-4 text-slate-700 p-3 bg-white border border-slate-100 rounded-lg shadow-sm"><span className="text-indigo-600 font-bold">{String.fromCharCode(97 + i)}.</span>{act}</li>))}</ul></div>
                    </div>
                    <div className="space-y-8">
                      <div><h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">4. Class Review / Evaluation</h5><ul className="space-y-3">{currentPlan.evaluation.map((ev, i) => (<li key={i} className="flex gap-4 text-slate-700 p-3 bg-white border border-slate-100 rounded-lg shadow-sm"><span className="text-indigo-600 font-bold">{String.fromCharCode(97 + i)}.</span>{ev}</li>))}</ul></div>
                      <div>
                        <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">5. Assignments</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100"><h6 className="font-bold text-slate-800 text-sm mb-3 border-b border-slate-200 pb-2">Class Work</h6><ul className="text-sm space-y-2 text-slate-600 list-disc pl-4">{currentPlan.class_work.map((cw, i) => <li key={i}>{cw}</li>)}</ul></div>
                          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100"><h6 className="font-bold text-slate-800 text-sm mb-3 border-b border-slate-200 pb-2">Home Assignment</h6><ul className="text-sm space-y-2 text-slate-600 list-disc pl-4">{currentPlan.home_assignment.map((ha, i) => <li key={i}>{ha}</li>)}</ul></div>
                        </div>
                      </div>
                      {currentPlan.remarks && (<div><h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">Remarks</h5><p className="text-slate-600 italic text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">{currentPlan.remarks}</p></div>)}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                  <Sparkles className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400">Select a Grade, Subject, and Topic to auto-generate a lesson plan.</p>
                </div>
              )}
            </AnimatePresence>
          </section>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-800 mb-6">Saved Lesson Plans ({planHistory.length})</h3>
            {planHistory.map((plan, idx) => (
              <div key={plan.id} className="bg-white rounded-xl border border-slate-200 p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">{plan.lesson_topic}</h4>
                  <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">{plan.subject} • Grade {plan.class} • {plan.unit}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => printPlan(plan)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Printer className="w-5 h-5" /></button>
                </div>
              </div>
            ))}
            {planHistory.length === 0 && (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400">No saved plans found.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
