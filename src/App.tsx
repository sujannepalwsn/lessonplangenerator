/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Upload, FileText, Loader2, Save, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Printer, BookOpen, Sparkles, List, GraduationCap, Book as BookIcon, Folder, RefreshCw, Trash2, Eye, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseBookPDF, generatePlanFromContent, generatePlanFromPDFAndTopic } from './services/geminiService';
import { getSupabase } from './lib/supabase';
import { LessonPlan, Book, BookContent } from './types';
import { cn } from './lib/utils';

export default function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'analyze' | 'books' | 'generator' | 'lesson-plans'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Book Data
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);

  const [bookMetadata, setBookMetadata] = useState({ title: '', subject: '', class: '' });
  const [overwriteMode, setOverwriteMode] = useState(false);
  const [selectedBookToOverwrite, setSelectedBookToOverwrite] = useState<string>('');
  const [bookToAnalyze, setBookToAnalyze] = useState<Book | null>(null);
  const [parsedContents, setParsedContents] = useState<Partial<BookContent>[]>([]);
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  
  // Selector State
  const [availableGrades, setAvailableGrades] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableBooks, setAvailableBooks] = useState<Book[]>([]);
  const [availableTopics, setAvailableTopics] = useState<BookContent[]>([]);
  
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<BookContent | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('English');
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
  const [viewingPlan, setViewingPlan] = useState<LessonPlan | null>(null);
  const [generatedTopicIds, setGeneratedTopicIds] = useState<Set<string>>(new Set());

  // Filters for Lesson Plans tab
  const [filterGrade, setFilterGrade] = useState<string>('');
  const [filterSubject, setFilterSubject] = useState<string>('');

  // Plans Data
  const [currentPlan, setCurrentPlan] = useState<LessonPlan | null>(null);
  const [planHistory, setPlanHistory] = useState<LessonPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Initial fetch for grades
  useEffect(() => {
    fetchGrades();
    fetchHistory();
    fetchAllBooks();
  }, []);

  const fetchAllBooks = async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('books')
        .select('id, title, subject, class, file_path, created_at')
        .order('class', { ascending: true });
      if (error) throw error;
      setAllBooks(data || []);
    } catch (err) {
      console.error('Fetch all books error:', err);
    }
  };

  // Cascading effects
  useEffect(() => {
    if (selectedGrade) {
      fetchSubjects(selectedGrade);
      setSelectedSubject('');
      setSelectedBook(null);
      setSelectedTopic(null);
      setCurrentPlan(null);
    }
  }, [selectedGrade]);

  useEffect(() => {
    if (selectedSubject && selectedGrade) {
      fetchBooks(selectedGrade, selectedSubject);
      setSelectedBook(null);
      setSelectedTopic(null);
      setCurrentPlan(null);
    }
  }, [selectedSubject, selectedGrade]);

  useEffect(() => {
    if (selectedBook) {
      fetchTopics(selectedBook.id);
      setSelectedTopic(null);
      setCurrentPlan(null);
    }
  }, [selectedBook]);

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

  const fetchBooks = async (grade: string, subject: string) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('books')
        .select('id, title, subject, class, file_path, created_at')
        .eq('class', grade)
        .eq('subject', subject);
      
      if (error) throw error;
      setAvailableBooks(data || []);
    } catch (err) {
      console.error('Books fetch error:', err);
    }
  };

  const fetchTopics = async (bookId: string) => {
    try {
      const supabase = getSupabase();
      const { data: topics, error: topicsError } = await supabase
        .from('book_contents')
        .select('id, book_id, unit, chapter, lesson, topic, sub_topic, content, goals, created_at')
        .eq('book_id', bookId)
        .order('created_at', { ascending: true });
      
      if (topicsError) throw topicsError;
      setAvailableTopics(topics || []);

      if (topics && topics.length > 0) {
        const topicIds = topics.map(t => t.id);
        const { data: plans, error: plansError } = await supabase
          .from('lesson_plans')
          .select('book_content_id')
          .in('book_content_id', topicIds);
        
        if (plansError) throw plansError;
        const generatedIds = new Set(plans?.map(p => p.book_content_id).filter(Boolean) as string[]);
        setGeneratedTopicIds(generatedIds);
      } else {
        setGeneratedTopicIds(new Set());
      }
    } catch (err) {
      console.error('Topics fetch error:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('lesson_plans')
        .select(`
          id, 
          book_content_id, 
          subject, 
          class, 
          unit, 
          period, 
          lesson_topic, 
          date, 
          learning_outcomes, 
          warm_up_review, 
          teaching_activities, 
          evaluation, 
          class_work, 
          home_assignment, 
          remarks, 
          created_at, 
          center_id, 
          teacher_id, 
          objectives, 
          learning_activities, 
          evaluation_activities, 
          principal_remarks, 
          chapter
        `)
        .order('created_at', { ascending: false });
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

  const uploadBookOnly = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabase();
      
      // 1. Upload to Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${bookMetadata.class}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('books')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Determine book ID (New or Overwrite)
      let bookId: string;
      let isOverwrite = false;
      let oldFilePath: string | null = null;

      if (overwriteMode && selectedBookToOverwrite) {
        bookId = selectedBookToOverwrite;
        isOverwrite = true;
        const book = allBooks.find(b => b.id === bookId);
        oldFilePath = book?.file_path || null;
      } else {
        const { data: existingBook } = await supabase
          .from('books')
          .select('id, file_path')
          .eq('title', bookMetadata.title)
          .eq('subject', bookMetadata.subject)
          .eq('class', bookMetadata.class)
          .maybeSingle();

        if (existingBook) {
          bookId = existingBook.id;
          isOverwrite = true;
          oldFilePath = existingBook.file_path;
        } else {
          const { data: newBook, error: bookError } = await supabase
            .from('books')
            .insert([{ ...bookMetadata, file_path: filePath }])
            .select()
            .single();

          if (bookError) throw bookError;
          bookId = newBook.id;
        }
      }

      if (isOverwrite) {
        // 1. Delete old file from storage if it exists
        if (oldFilePath) {
          await supabase.storage.from('books').remove([oldFilePath]);
        }

        // 2. Find all book_contents IDs for this book
        const { data: contents } = await supabase
          .from('book_contents')
          .select('id')
          .eq('book_id', bookId);
        
        if (contents && contents.length > 0) {
          const contentIds = contents.map(c => c.id);
          // 3. Delete lesson_plans referencing these contents
          await supabase
            .from('lesson_plans')
            .delete()
            .in('book_content_id', contentIds);
        }

        // 4. Delete existing contents for this book
        await supabase
          .from('book_contents')
          .delete()
          .eq('book_id', bookId);

        // 5. Update book metadata
        await supabase.from('books').update({ ...bookMetadata, file_path: filePath }).eq('id', bookId);
      }

      setSuccess(isOverwrite ? 'Book file updated and old contents cleared!' : 'Book uploaded to library!');
      setFile(null);
      setOverwriteMode(false);
      setSelectedBookToOverwrite('');
      fetchGrades();
      fetchAllBooks();
      setActiveTab('books');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to upload book.');
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeExistingBook = async (book: Book) => {
    if (!book.file_path) return;
    setBookToAnalyze(book);
    setActiveTab('analyze');
    setIsProcessing(true);
    setError(null);
    setParsedContents([]);

    try {
      const supabase = getSupabase();
      
      // 1. Download file from storage
      const { data, error: downloadError } = await supabase.storage
        .from('books')
        .download(book.file_path);

      if (downloadError) throw downloadError;

      // 2. Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(data);
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const contents = await parseBookPDF(base64);
          setParsedContents(contents);
          setIsProcessing(false);
          setSuccess(`Successfully extracted ${contents.length} topics from "${book.title}"!`);
        } catch (err) {
          console.error(err);
          setError('An error occurred while analyzing the book.');
          setIsProcessing(false);
        }
      };
    } catch (err) {
      console.error(err);
      setError('Failed to retrieve book for analysis.');
      setIsProcessing(false);
    }
  };

  const saveExtractedContents = async () => {
    if (parsedContents.length === 0 || !bookToAnalyze) return;
    setIsProcessing(true);

    try {
      const supabase = getSupabase();
      const bookId = bookToAnalyze.id!;
      
      // 1. Find all book_contents IDs for this book
      const { data: contents } = await supabase
        .from('book_contents')
        .select('id')
        .eq('book_id', bookId);
      
      if (contents && contents.length > 0) {
        const contentIds = contents.map(c => c.id);
        // 2. Delete lesson_plans referencing these contents
        await supabase
          .from('lesson_plans')
          .delete()
          .in('book_content_id', contentIds);
      }

      // 3. Delete existing contents for this book
      const { error: deleteError } = await supabase
        .from('book_contents')
        .delete()
        .eq('book_id', bookId);
      
      if (deleteError) throw deleteError;

      // 4. Save new contents
      const contentsToSave = parsedContents.map(c => ({
        ...c,
        book_id: bookId
      }));

      const { error: contentsError } = await supabase.from('book_contents').insert(contentsToSave);
      if (contentsError) throw contentsError;

      setSuccess(`Successfully saved ${parsedContents.length} topics to "${bookToAnalyze.title}"!`);
      setParsedContents([]);
      setBookToAnalyze(null);
      setActiveTab('books');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save extraction.');
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteBook = async (bookId: string) => {
    if (!confirm('Are you sure you want to delete this book and all its contents?')) return;
    try {
      const supabase = getSupabase();

      // 0. Get file path to delete from storage
      const { data: book } = await supabase.from('books').select('file_path').eq('id', bookId).single();

      // 1. Find all book_contents IDs for this book
      const { data: contents } = await supabase
        .from('book_contents')
        .select('id')
        .eq('book_id', bookId);
      
      if (contents && contents.length > 0) {
        const contentIds = contents.map(c => c.id);
        // 2. Delete lesson_plans referencing these contents
        await supabase
          .from('lesson_plans')
          .delete()
          .in('book_content_id', contentIds);
      }

      // 3. Delete the book (cascade should handle book_contents if configured, but we already handled lesson_plans)
      const { error } = await supabase.from('books').delete().eq('id', bookId);
      if (error) throw error;

      // 4. Delete file from storage
      if (book?.file_path) {
        await supabase.storage.from('books').remove([book.file_path]);
      }

      setSuccess('Book deleted successfully');
      fetchAllBooks();
      fetchGrades();
    } catch (err) {
      console.error(err);
      setError('Failed to delete book');
    }
  };

  const viewPdf = async (filePath: string) => {
    setIsProcessing(true);
    try {
      const supabase = getSupabase();
      
      // 1. Download the file as a blob
      const { data, error } = await supabase.storage.from('books').download(filePath);
      if (error) throw error;
      
      // 2. Create a local blob URL
      const url = URL.createObjectURL(data);
      setViewingPdfUrl(url);
    } catch (err) {
      console.error(err);
      setError('Failed to load PDF viewer. Please ensure the file exists.');
    } finally {
      setIsProcessing(false);
    }
  };

  const closePdfViewer = () => {
    if (viewingPdfUrl) {
      URL.revokeObjectURL(viewingPdfUrl);
    }
    setViewingPdfUrl(null);
  };

  const handleBulkGenerate = async () => {
    if (!selectedBook || availableTopics.length === 0) return;
    
    setIsBulkGenerating(true);
    setBulkProgress(0);
    setBulkTotal(availableTopics.length);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabase();
      
      // Get PDF base64 if available for better generation
      let pdfBase64: string | null = null;
      if (selectedBook.file_path) {
        const { data: pdfBlob, error: downloadError } = await supabase.storage
          .from('books')
          .download(selectedBook.file_path);
        
        if (!downloadError) {
          const reader = new FileReader();
          pdfBase64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(pdfBlob);
          });
        }
      }

      for (let i = 0; i < availableTopics.length; i++) {
        const topic = availableTopics[i];
        setBulkProgress(i + 1);

        // Check if plan already exists
        const { data: existingPlan } = await supabase
          .from('lesson_plans')
          .select('id')
          .eq('book_content_id', topic.id)
          .maybeSingle();

        let plan: LessonPlan;
        try {
          if (pdfBase64) {
            plan = await generatePlanFromPDFAndTopic(pdfBase64, topic, selectedSubject, selectedGrade, targetLanguage);
          } else {
            plan = await generatePlanFromContent(topic, selectedSubject, selectedGrade, targetLanguage);
          }

          const planWithMetadata = {
            ...plan,
            center_id: '00000000-0000-0000-0000-000000000000',
            teacher_id: '00000000-0000-0000-0000-000000000000',
            book_content_id: topic.id,
            class: selectedGrade,
            subject: selectedSubject,
            date: new Date().toLocaleDateString()
          };

          const fieldsToRemove = ['content', 'description', 'title', 'grade', 'status', 'updated_at', 'notes', 'objectives', 'learning_activities', 'evaluation_activities'];
          fieldsToRemove.forEach(field => {
            if (field in planWithMetadata) {
              delete (planWithMetadata as any)[field];
            }
          });

          if (existingPlan) {
            await supabase
              .from('lesson_plans')
              .update({ ...planWithMetadata })
              .eq('id', existingPlan.id);
          } else {
            await supabase
              .from('lesson_plans')
              .insert([planWithMetadata]);
            setGeneratedTopicIds(prev => new Set(prev).add(topic.id!));
          }
          
          // Small delay to prevent rate limiting
          await new Promise(r => setTimeout(r, 500));
        } catch (genErr) {
          console.error(`Failed to generate plan for topic ${topic.topic}:`, genErr);
          // Continue with next topic
        }
      }

      setSuccess(`Successfully generated lesson plans for ${selectedBook.title}!`);
      fetchHistory();
    } catch (err) {
      console.error('Bulk generation error:', err);
      setError('Bulk generation failed. Please try again.');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const handleAutoGenerate = async (content: BookContent, forceRegenerate: boolean = false) => {
    setIsGenerating(true);
    setError(null);
    setCurrentPlan(null);
    setSuccess(null);

    try {
      const supabase = getSupabase();
      
      const { data: existingPlan, error: fetchError } = await supabase
        .from('lesson_plans')
        .select(`
          id, 
          book_content_id, 
          subject, 
          class, 
          unit, 
          period, 
          lesson_topic, 
          date, 
          learning_outcomes, 
          warm_up_review, 
          teaching_activities, 
          evaluation, 
          class_work, 
          home_assignment, 
          remarks, 
          created_at, 
          center_id, 
          teacher_id, 
          objectives, 
          learning_activities, 
          evaluation_activities, 
          principal_remarks, 
          chapter
        `)
        .eq('book_content_id', content.id)
        .maybeSingle();

      if (fetchError) console.error('Error checking existing plan:', fetchError);

      if (existingPlan && !forceRegenerate) {
        const isNepali = (text: string) => /[\u0900-\u097F]/.test(text);
        const planIsNepali = isNepali(existingPlan.objectives || '');
        const targetIsNepali = targetLanguage === 'Nepali';

        if (planIsNepali === targetIsNepali) {
          setCurrentPlan(existingPlan);
          setSuccess(`Retrieved existing ${targetLanguage} plan for: ${content.topic}`);
          setIsGenerating(false);
          return;
        }
      }

      let plan: LessonPlan;

      if (forceRegenerate && selectedBook?.file_path) {
        // "Study the document and regenerate"
        const { data: pdfBlob, error: downloadError } = await supabase.storage
          .from('books')
          .download(selectedBook.file_path);
        
        if (downloadError) throw downloadError;

        const reader = new FileReader();
        const pdfBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(pdfBlob);
        });

        plan = await generatePlanFromPDFAndTopic(pdfBase64, content, selectedSubject, selectedGrade, targetLanguage);
      } else {
        plan = await generatePlanFromContent(content, selectedSubject, selectedGrade, targetLanguage);
      }
      
      // Add metadata for the external system integration
      const planWithMetadata = {
        ...plan,
        center_id: '00000000-0000-0000-0000-000000000000', // Placeholder UUID
        teacher_id: '00000000-0000-0000-0000-000000000000', // Placeholder
        book_content_id: content.id,
        class: selectedGrade,
        subject: selectedSubject,
        date: new Date().toLocaleDateString()
      };

      // CRITICAL: Remove fields that don't exist in the database schema
      const fieldsToRemove = ['content', 'description', 'title', 'grade', 'status', 'updated_at', 'notes', 'objectives', 'learning_activities', 'evaluation_activities'];
      fieldsToRemove.forEach(field => {
        if (field in planWithMetadata) {
          delete (planWithMetadata as any)[field];
        }
      });

      if (existingPlan) {
        const { data: updatedPlan, error: updateError } = await supabase
          .from('lesson_plans')
          .update({ ...planWithMetadata })
          .eq('id', existingPlan.id)
          .select()
          .single();
        
        if (updateError) {
          if (updateError.message.includes('row-level security')) {
            throw new Error('Supabase RLS policy violation on "lesson_plans" (update). Please check your policies.');
          }
          throw updateError;
        }
        setCurrentPlan(updatedPlan);
      } else {
        const { data: savedPlan, error: saveError } = await supabase
          .from('lesson_plans')
          .insert([planWithMetadata])
          .select()
          .single();

        if (saveError) {
          if (saveError.message.includes('row-level security')) {
            throw new Error('Supabase RLS policy violation on "lesson_plans" (insert). Please check your policies.');
          }
          throw saveError;
        }
        setCurrentPlan(savedPlan);
        setGeneratedTopicIds(prev => new Set(prev).add(content.id!));
      }
      
      setSuccess(forceRegenerate ? `Lesson plan regenerated in ${targetLanguage}!` : `New ${targetLanguage} lesson plan generated and cached!`);
      fetchHistory();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to generate or retrieve lesson plan.');
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

    const topic = plan.lesson_topic || (plan as any).topic;
    const objectives = plan.learning_outcomes || plan.objectives;
    const activities = plan.teaching_activities || plan.learning_activities || [];
    const evaluation = plan.evaluation || plan.evaluation_activities || [];
    const remarks = plan.principal_remarks || plan.remarks;

    const content = `
      <html>
        <head>
          <title>Lesson Plan - ${topic}</title>
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
            <div class="header-item"><strong>Chapter:</strong> ${plan.chapter || ''}</div>
            <div class="header-item"><strong>Period:</strong> ${plan.period || ''}</div>
            <div class="header-item" style="grid-column: span 2;"><strong>Topic:</strong> ${topic}</div>
            <div class="header-item" style="grid-column: span 2;"><strong>Date:</strong> ${plan.date || '_________'}</div>
          </div>
          <div class="section"><div class="section-title">1. Objectives / Learning Outcomes:</div><p>${objectives}</p></div>
          <div class="section"><div class="section-title">2. Warm up & Review:</div><p>${plan.warm_up_review}</p></div>
          <div class="section"><div class="section-title">3. Teaching & Learning Activities:</div><ol type="a">${activities.map(act => `<li>${act}</li>`).join('')}</ol></div>
          <div class="section"><div class="section-title">4. Evaluation:</div><ol type="a">${evaluation.map(ev => `<li>${ev}</li>`).join('')}</ol></div>
          <div class="grid">
            <div class="section">
              <div class="section-title">Class Work:</div>
              <ul>${Array.isArray(plan.class_work) ? plan.class_work.map(item => `<li>${item}</li>`).join('') : `<li>${plan.class_work || ''}</li>`}</ul>
            </div>
            <div class="section">
              <div class="section-title">Home Assignment:</div>
              <ul>${Array.isArray(plan.home_assignment) ? plan.home_assignment.map(item => `<li>${item}</li>`).join('') : `<li>${plan.home_assignment || ''}</li>`}</ul>
            </div>
          </div>
          ${remarks ? `<div class="section"><div class="section-title">Remarks:</div><p><i>${remarks}</i></p></div>` : ''}
          <div style="margin-top: 50px; display: flex; justify-content: space-between;">
            <div>____________________<br>Teacher's Signature</div>
            <div>____________________<br>Principal's Signature</div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const copyPlanToClipboard = (plan: LessonPlan) => {
    const topic = plan.lesson_topic || (plan as any).topic;
    const objectives = plan.learning_outcomes || plan.objectives;
    const activities = plan.teaching_activities || plan.learning_activities || [];
    const evaluation = plan.evaluation || plan.evaluation_activities || [];
    const classwork = plan.class_work || [];
    const homework = plan.home_assignment || [];
    const warmUp = plan.warm_up_review || '';
    const remarks = plan.principal_remarks || plan.remarks || '';

    const sections = [
      `TOPIC: ${topic}`,
      `SUBJECT: ${plan.subject} | GRADE: ${plan.class} | DATE: ${plan.date || 'N/A'}`,
      '',
      '1. OBJECTIVES / LEARNING OUTCOMES',
      objectives,
      '',
      '2. WARM UP & REVIEW',
      warmUp,
      '',
      '3. TEACHING & LEARNING ACTIVITIES',
      ...(Array.isArray(activities) ? activities.map((a, i) => `${String.fromCharCode(97 + i)}. ${a}`) : [activities]),
      '',
      '4. EVALUATION',
      ...(Array.isArray(evaluation) ? evaluation.map((e, i) => `${String.fromCharCode(97 + i)}. ${e}`) : [evaluation]),
      '',
      'CLASS WORK',
      ...(Array.isArray(classwork) ? classwork : [classwork]),
      '',
      'HOME ASSIGNMENT',
      ...(Array.isArray(homework) ? homework : [homework]),
      '',
      remarks ? `REMARKS: ${remarks}` : ''
    ];

    const text = sections
      .map(s => s === undefined ? '' : s)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    navigator.clipboard.writeText(text).then(() => {
      setSuccess('Lesson plan content copied to clipboard!');
    }).catch(err => {
      console.error('Copy failed:', err);
      setError('Failed to copy to clipboard.');
    });
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
            <button onClick={() => setActiveTab('upload')} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", (activeTab === 'upload' || activeTab === 'analyze') ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Upload</button>
            <button onClick={() => setActiveTab('books')} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", activeTab === 'books' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Books</button>
            <button onClick={() => setActiveTab('generator')} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", activeTab === 'generator' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Generator</button>
            <button onClick={() => setActiveTab('lesson-plans')} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", activeTab === 'lesson-plans' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Lesson Plans</button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence>
          {error && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3"><AlertCircle className="w-5 h-5" />{error}</motion.div>}
          {success && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl flex items-center gap-3"><CheckCircle2 className="w-5 h-5" />{success}</motion.div>}
        </AnimatePresence>

        {activeTab === 'upload' && (
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Upload Textbook</h2>
                <p className="text-slate-500">Extract lessons from PDF and store in database.</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => setOverwriteMode(false)} 
                  className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-all", !overwriteMode ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}
                >
                  New Book
                </button>
                <button 
                  onClick={() => setOverwriteMode(true)} 
                  className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-all", overwriteMode ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}
                >
                  Overwrite
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="relative group">
                  <input type="file" accept=".pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className={cn("border-2 border-dashed rounded-2xl p-10 transition-all flex flex-col items-center justify-center gap-4", file ? "border-indigo-400 bg-indigo-50" : "border-slate-300 group-hover:border-indigo-400 group-hover:bg-slate-50")}>
                    <div className={cn("p-4 rounded-full", file ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400")}><Upload className="w-8 h-8" /></div>
                    <p className="font-bold text-slate-700 text-center">{file ? file.name : "Click or drag PDF here"}</p>
                    <p className="text-xs text-slate-400 tracking-wide uppercase font-bold">PDF Format Only</p>
                  </div>
                </div>

                {overwriteMode ? (
                  <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Select Book to Replace</h3>
                    <div className="space-y-3">
                      <select 
                        value={selectedGrade} 
                        onChange={e => setSelectedGrade(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      >
                        <option value="">-- Select Grade --</option>
                        {availableGrades.map((g, i) => <option key={`up-g-${g}-${i}`} value={g}>{g}</option>)}
                      </select>
                      <select 
                        value={selectedSubject} 
                        onChange={e => setSelectedSubject(e.target.value)}
                        disabled={!selectedGrade}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                      >
                        <option value="">-- Select Subject --</option>
                        {availableSubjects.map((s, i) => <option key={`up-s-${s}-${i}`} value={s}>{s}</option>)}
                      </select>
                      <select 
                        value={selectedBookToOverwrite} 
                        onChange={e => {
                          const bookId = e.target.value;
                          setSelectedBookToOverwrite(bookId);
                          const book = availableBooks.find(b => b.id === bookId);
                          if (book) {
                            setBookMetadata({ title: book.title, subject: book.subject, class: book.class });
                          }
                        }}
                        disabled={!selectedSubject}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                      >
                        <option value="">-- Select Book --</option>
                        {availableBooks.map((b, i) => <option key={`up-b-${b.id}`} value={b.id}>{b.title}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2"><FileText className="w-4 h-4" /> Book Details</h3>
                    <div className="space-y-3">
                      <input type="text" placeholder="Grade/Class (e.g. 10)" value={bookMetadata.class} onChange={e => setBookMetadata({...bookMetadata, class: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                      <input type="text" placeholder="Subject (e.g. Science)" value={bookMetadata.subject} onChange={e => setBookMetadata({...bookMetadata, subject: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                      <input type="text" placeholder="Book Title" value={bookMetadata.title} onChange={e => setBookMetadata({...bookMetadata, title: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-center">
                <div className="bg-indigo-50/50 rounded-3xl p-8 border border-indigo-100 text-center space-y-6">
                  <div className="bg-white w-16 h-16 rounded-2xl shadow-sm flex items-center justify-center mx-auto text-indigo-600">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Upload to Library</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">
                      Upload your book PDF to the library. You can identify units, chapters, and topics later from the Book Library tab.
                    </p>
                  </div>
                  <button 
                    onClick={uploadBookOnly} 
                    disabled={!file || isProcessing || (overwriteMode && !selectedBookToOverwrite) || (!overwriteMode && (!bookMetadata.title || !bookMetadata.subject || !bookMetadata.class))}
                    className="w-full py-4 rounded-2xl font-bold text-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Save className="w-6 h-6" /> Upload to Library</>}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'analyze' && (
          <section className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Review Extraction</h2>
                  <p className="text-slate-500">AI analysis of {bookToAnalyze?.title || file?.name}</p>
                </div>
                <button 
                  onClick={() => {
                    setBookToAnalyze(null);
                    setActiveTab('upload');
                  }}
                  className="text-sm font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  Back to Upload
                </button>
              </div>

              {isProcessing ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                  <p className="text-slate-500 font-medium">AI is analyzing your book... This may take a minute.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-slate-800 flex items-center gap-2"><List className="w-5 h-5" /> Extracted Structure</h4>
                      <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold">{parsedContents.length} Topics Found</span>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {parsedContents.map((c, i) => (
                        <div key={`parsed-${i}`} className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm flex items-start gap-4">
                          <div className="bg-slate-50 px-2 py-1 rounded text-[10px] font-bold text-slate-400 uppercase mt-1">Topic {i+1}</div>
                          <div>
                            <div className="font-bold text-slate-700">{c.unit} - {c.lesson}</div>
                            <div className="text-sm text-slate-500">{c.topic}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => setActiveTab('upload')}
                      className="flex-1 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={saveExtractedContents} 
                      disabled={isProcessing || parsedContents.length === 0}
                      className="flex-[2] py-4 rounded-xl font-bold text-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Save className="w-6 h-6" /> Save Extraction</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'books' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800">Book Library</h2>
              <p className="text-sm text-slate-500">Organized by Grade</p>
            </div>
            
            {Array.from(new Set(allBooks.map(b => b.class))).filter(Boolean).sort().map((grade, gIdx) => (
              <div key={`grade-group-${grade}-${gIdx}`} className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <Folder className="w-5 h-5" />
                  <h3 className="font-bold text-slate-700">Grade {grade}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-7">
                  {allBooks.filter(b => b.class === grade).map((book, bIdx) => (
                    <div key={`book-card-${book.id}-${bIdx}`} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                            <BookIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 line-clamp-1">{book.title}</h4>
                            <p className="text-xs text-slate-500">{book.subject}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteBook(book.id!)} 
                          className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button 
                          onClick={() => book.file_path && viewPdf(book.file_path)}
                          className="text-xs font-bold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" /> View
                        </button>
                        <button 
                          onClick={() => analyzeExistingBook(book)}
                          className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" /> Analyze
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedGrade(book.class);
                            setSelectedSubject(book.subject);
                            setSelectedBook(book);
                            setActiveTab('generator');
                          }}
                          className="text-xs font-bold text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-all"
                        >
                          Generate Plans
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {allBooks.length === 0 && (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400">No books uploaded yet. Go to the Upload tab to start.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'generator' && (
          <section className="space-y-8">
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="text-indigo-600 w-6 h-6" /> Lesson Plan Generator</h2>
                  {selectedTopic && (
                    <button 
                      onClick={() => handleAutoGenerate(selectedTopic, true)}
                      disabled={isGenerating}
                      className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={cn("w-3 h-3", isGenerating && "animate-spin")} />
                      Regenerate
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setTargetLanguage('English')} 
                    className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-all", targetLanguage === 'English' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}
                  >
                    English
                  </button>
                  <button 
                    onClick={() => setTargetLanguage('Nepali')} 
                    className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-all", targetLanguage === 'Nepali' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}
                  >
                    Nepali
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Grade Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Grade</label>
                  <select 
                    value={selectedGrade} 
                    onChange={e => setSelectedGrade(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="">-- Grade --</option>
                    {availableGrades.map((g, i) => <option key={`sel-g-${g}-${i}`} value={g}>{g}</option>)}
                  </select>
                </div>

                {/* Subject Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2"><BookIcon className="w-4 h-4" /> Subject</label>
                  <select 
                    value={selectedSubject} 
                    onChange={e => setSelectedSubject(e.target.value)}
                    disabled={!selectedGrade}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                  >
                    <option value="">-- Subject --</option>
                    {availableSubjects.map((s, i) => <option key={`sel-s-${s}-${i}`} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Book Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2"><BookOpen className="w-4 h-4" /> Book</label>
                  <select 
                    value={selectedBook?.id || ''} 
                    onChange={e => setSelectedBook(availableBooks.find(b => b.id === e.target.value) || null)}
                    disabled={!selectedSubject}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                  >
                    <option value="">-- Book --</option>
                    {availableBooks.map((b, i) => <option key={`sel-b-${b.id}-${i}`} value={b.id}>{b.title}</option>)}
                  </select>
                </div>

                {selectedBook && availableTopics.length === 0 && !isProcessing && (
                  <div className="col-span-full mt-2 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2 text-amber-700 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>This book hasn't been analyzed yet. Go to <strong>Books</strong> tab and click <strong>Analyze</strong> to extract topics.</span>
                  </div>
                )}
              </div>

              {/* Topic List & Bulk Generation */}
              {selectedBook && availableTopics.length > 0 && (
                <div className="mt-8 pt-8 border-t border-slate-100 space-y-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <h3 className="text-xl font-bold flex items-center gap-2"><List className="text-indigo-600 w-5 h-5" /> Topics & Lessons</h3>
                      <div className="text-sm text-slate-500">
                        <span className="font-bold text-slate-700">{generatedTopicIds.size}</span> / {availableTopics.length} Generated
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      {isBulkGenerating ? (
                        <div className="flex-1 sm:w-64">
                          <div className="flex justify-between text-xs font-bold text-indigo-600 mb-1 uppercase tracking-wider">
                            <span>Bulk Generating...</span>
                            <span>{Math.round((bulkProgress / bulkTotal) * 100)}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-indigo-600"
                              initial={{ width: 0 }}
                              animate={{ width: `${(bulkProgress / bulkTotal) * 100}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 text-center">
                            Processing {bulkProgress} of {bulkTotal} topics
                          </p>
                        </div>
                      ) : (
                        <button 
                          onClick={handleBulkGenerate}
                          disabled={isGenerating}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 text-sm"
                        >
                          <Sparkles className="w-4 h-4" />
                          Generate All Plans
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {availableTopics.map((topic) => {
                      const isGenerated = generatedTopicIds.has(topic.id!);
                      const isSelected = selectedTopic?.id === topic.id;
                      
                      return (
                        <div 
                          key={topic.id} 
                          className={cn(
                            "p-4 rounded-xl border transition-all flex items-center justify-between gap-4",
                            isSelected ? "border-indigo-200 bg-indigo-50/30 ring-1 ring-indigo-200" : "border-slate-100 bg-slate-50/50 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {isGenerated && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{topic.unit}</span>
                            </div>
                            <h4 className="font-bold text-slate-800 truncate text-sm" title={topic.topic}>{topic.topic}</h4>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {isGenerated ? (
                              <>
                                <button 
                                  onClick={() => {
                                    setSelectedTopic(topic);
                                    handleAutoGenerate(topic);
                                  }}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                                  title="View/Load Plan"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => {
                                    setSelectedTopic(topic);
                                    handleAutoGenerate(topic, true);
                                  }}
                                  disabled={isGenerating}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all disabled:opacity-50"
                                  title="Regenerate Plan"
                                >
                                  <RefreshCw className={cn("w-4 h-4", (isGenerating && isSelected) && "animate-spin")} />
                                </button>
                              </>
                            ) : (
                              <button 
                                onClick={() => {
                                  setSelectedTopic(topic);
                                  handleAutoGenerate(topic);
                                }}
                                disabled={isGenerating}
                                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-1"
                              >
                                <Sparkles className="w-3 h-3" /> Generate
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Generated Plan Display */}
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                  <p className="text-slate-500 font-medium">
                    {selectedBook?.file_path ? "Studying PDF document and generating lesson plan..." : "Generating your lesson plan from database content..."}
                  </p>
                </motion.div>
              ) : currentPlan ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-lg">
                  <div className="bg-indigo-600 px-8 py-6 flex items-center justify-between text-white">
                    <div>
                      <h3 className="text-2xl font-bold">{currentPlan.lesson_topic || (currentPlan as any).topic}</h3>
                      <p className="opacity-80">{currentPlan.subject} • Grade {currentPlan.class}</p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => selectedTopic && handleAutoGenerate(selectedTopic, true)} 
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium" 
                        title="Study PDF and Regenerate"
                      >
                        <RefreshCw className="w-4 h-4" /> Regenerate
                      </button>
                      <button onClick={savePlan} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all" title="Save to History"><Save className="w-5 h-5" /></button>
                      <button onClick={() => printPlan(currentPlan)} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all" title="Print Plan"><Printer className="w-5 h-5" /></button>
                      <button onClick={() => copyPlanToClipboard(currentPlan)} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all" title="Copy Content"><Copy className="w-5 h-5" /></button>
                    </div>
                  </div>
                  
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                      <div>
                        <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">1. Objectives / Learning Outcomes</h5>
                        <p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                          {currentPlan.learning_outcomes || currentPlan.objectives}
                        </p>
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">2. Warm up & Review</h5>
                        <p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{currentPlan.warm_up_review}</p>
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">3. Teaching & Learning Activities</h5>
                        <ul className="space-y-3">
                          {(currentPlan.teaching_activities || currentPlan.learning_activities || []).map((act, i) => (
                            <li key={i} className="flex gap-4 text-slate-700 p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                              <span className="text-indigo-600 font-bold">{String.fromCharCode(97 + i)}.</span>{act}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="space-y-8">
                      <div>
                        <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">4. Evaluation</h5>
                        <ul className="space-y-3">
                          {(currentPlan.evaluation || currentPlan.evaluation_activities || []).map((ev, i) => (
                            <li key={i} className="flex gap-4 text-slate-700 p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                              <span className="text-indigo-600 font-bold">{String.fromCharCode(97 + i)}.</span>{ev}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">5. Assignments</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                            <h6 className="font-bold text-slate-800 text-sm mb-3 border-b border-slate-200 pb-2">Class Work</h6>
                            <div className="text-sm text-slate-600 space-y-1">
                              {Array.isArray(currentPlan.class_work) ? (
                                currentPlan.class_work.map((item, i) => <p key={i}>• {item}</p>)
                              ) : (
                                <p>{currentPlan.class_work}</p>
                              )}
                            </div>
                          </div>
                          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                            <h6 className="font-bold text-slate-800 text-sm mb-3 border-b border-slate-200 pb-2">Home Assignment</h6>
                            <div className="text-sm text-slate-600 space-y-1">
                              {Array.isArray(currentPlan.home_assignment) ? (
                                currentPlan.home_assignment.map((item, i) => <p key={i}>• {item}</p>)
                              ) : (
                                <p>{currentPlan.home_assignment}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {(currentPlan.principal_remarks || currentPlan.remarks) && (
                        <div>
                          <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">Remarks</h5>
                          <p className="text-slate-600 italic text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
                            {currentPlan.principal_remarks || currentPlan.remarks}
                          </p>
                        </div>
                      )}
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

        {activeTab === 'lesson-plans' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-2xl font-bold text-slate-800">Saved Lesson Plans</h3>
              
              <div className="flex flex-wrap gap-3">
                <select 
                  value={filterGrade} 
                  onChange={e => setFilterGrade(e.target.value)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">All Grades</option>
                  {Array.from(new Set(planHistory.map(p => p.class))).filter(Boolean).sort().map(g => (
                    <option key={`filter-g-${g}`} value={g}>Grade {g}</option>
                  ))}
                </select>
                
                <select 
                  value={filterSubject} 
                  onChange={e => setFilterSubject(e.target.value)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">All Subjects</option>
                  {Array.from(new Set(planHistory.map(p => p.subject))).filter(Boolean).sort().map(s => (
                    <option key={`filter-s-${s}`} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {planHistory
                .filter(p => (!filterGrade || p.class === filterGrade) && (!filterSubject || p.subject === filterSubject))
                .map((plan, idx) => (
                  <div key={`history-item-${plan.id}-${idx}`} className="bg-white rounded-xl border border-slate-200 p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg">{plan.lesson_topic || (plan as any).topic}</h4>
                      <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">{plan.subject} • Grade {plan.class} • {plan.chapter}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setViewingPlan(plan)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="View Plan">
                        <Eye className="w-5 h-5" />
                      </button>
                      <button onClick={() => printPlan(plan)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Print Plan">
                        <Printer className="w-5 h-5" />
                      </button>
                      <button onClick={() => copyPlanToClipboard(plan)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Copy Content">
                        <Copy className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              
              {planHistory.length === 0 && (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                  <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400">No lesson plans generated yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Plan Viewer Modal */}
        <AnimatePresence>
          {viewingPlan && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setViewingPlan(null)}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-4xl my-8 overflow-hidden flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                  <div>
                    <h3 className="text-2xl font-bold">{viewingPlan.lesson_topic || (viewingPlan as any).topic}</h3>
                    <p className="opacity-80">{viewingPlan.subject} • Grade {viewingPlan.class}</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => printPlan(viewingPlan)} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all" title="Print Plan"><Printer className="w-5 h-5" /></button>
                    <button onClick={() => copyPlanToClipboard(viewingPlan)} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all" title="Copy Content"><Copy className="w-5 h-5" /></button>
                    <button 
                      onClick={() => setViewingPlan(null)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                    >
                      <ChevronDown className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10 overflow-y-auto max-h-[70vh] custom-scrollbar">
                  <div className="space-y-8">
                    <div>
                      <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">1. Objectives / Learning Outcomes</h5>
                      <p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                        {viewingPlan.learning_outcomes || viewingPlan.objectives}
                      </p>
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">2. Warm up & Review</h5>
                      <p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{viewingPlan.warm_up_review}</p>
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">3. Teaching & Learning Activities</h5>
                      <ul className="space-y-3">
                        {(viewingPlan.teaching_activities || viewingPlan.learning_activities || []).map((act, i) => (
                          <li key={i} className="flex gap-4 text-slate-700 p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                            <span className="text-indigo-600 font-bold">{String.fromCharCode(97 + i)}.</span>{act}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">4. Evaluation</h5>
                      <ul className="space-y-3">
                        {(viewingPlan.evaluation || viewingPlan.evaluation_activities || []).map((ev, i) => (
                          <li key={i} className="flex gap-4 text-slate-700 p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                            <span className="text-indigo-600 font-bold">{String.fromCharCode(97 + i)}.</span>{ev}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">5. Assignments</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                          <h6 className="font-bold text-slate-800 text-sm mb-3 border-b border-slate-200 pb-2">Class Work</h6>
                          <div className="text-sm text-slate-600 space-y-1">
                            {Array.isArray(viewingPlan.class_work) ? (
                              viewingPlan.class_work.map((item, i) => <p key={i}>• {item}</p>)
                            ) : (
                              <p>{viewingPlan.class_work}</p>
                            )}
                          </div>
                        </div>
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                          <h6 className="font-bold text-slate-800 text-sm mb-3 border-b border-slate-200 pb-2">Home Assignment</h6>
                          <div className="text-sm text-slate-600 space-y-1">
                            {Array.isArray(viewingPlan.home_assignment) ? (
                              viewingPlan.home_assignment.map((item, i) => <p key={i}>• {item}</p>)
                            ) : (
                              <p>{viewingPlan.home_assignment}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {(viewingPlan.principal_remarks || viewingPlan.remarks) && (
                      <div>
                        <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">Remarks</h5>
                        <p className="text-slate-600 italic text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
                          {viewingPlan.principal_remarks || viewingPlan.remarks}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PDF Viewer Modal */}
        <AnimatePresence>
          {viewingPdfUrl && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
              onClick={closePdfViewer}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-600" /> PDF Viewer</h3>
                    <a 
                      href={viewingPdfUrl} 
                      download="book.pdf"
                      className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-1"
                    >
                      <Upload className="w-3 h-3 rotate-180" /> Download
                    </a>
                  </div>
                  <button 
                    onClick={closePdfViewer}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600"
                  >
                    <ChevronDown className="w-6 h-6" />
                  </button>
                </div>
                <div className="flex-1 bg-slate-100 relative">
                  <object 
                    data={viewingPdfUrl} 
                    type="application/pdf" 
                    className="w-full h-full border-none"
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-white">
                      <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 max-w-md">
                        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                        <h4 className="text-lg font-bold text-slate-800 mb-2">Browser Blocked the Viewer</h4>
                        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                          Chrome's security settings are preventing the PDF from displaying inside this window. You can still view it by downloading or opening it in a new tab.
                        </p>
                        <div className="flex flex-col gap-3">
                          <a 
                            href={viewingPdfUrl} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                          >
                            <BookOpen className="w-4 h-4" /> Open in New Tab
                          </a>
                          <a 
                            href={viewingPdfUrl} 
                            download="book.pdf"
                            className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                          >
                            <Upload className="w-4 h-4 rotate-180" /> Download PDF
                          </a>
                        </div>
                      </div>
                    </div>
                  </object>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
