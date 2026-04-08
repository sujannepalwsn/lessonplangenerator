/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Upload, FileText, Loader2, Save, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Printer, BookOpen, Sparkles, List, GraduationCap, Book as BookIcon, Folder, RefreshCw, Trash2, Eye, Copy, Search, X, Menu, Link as LinkIcon, ChevronLeft, ChevronRight, Layers, Activity, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseBookPDF, generatePlanFromContent, generatePlanFromPDFAndTopic, answerQuestionFromBook, searchBookContents, extractFullBookReaderContent, identifyBookMetadata, extractTOC, unifiedBookExtraction } from './services/geminiService';
import { AutonomousDashboard } from './components/AutonomousDashboard';
import { ExamGenerator } from './components/ExamGenerator';
import { MCQGenerator } from './components/MCQGenerator';
import { Settings } from './components/Settings';
import { getSupabase } from './lib/supabase';
import { LessonPlan, Book, BookContent, BookReaderContent } from './types';
import { cn } from './lib/utils';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
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
  const [parsedReaderContents, setParsedReaderContents] = useState<Partial<BookReaderContent>[]>([]);
  const [bookUrl, setBookUrl] = useState('');
  const [bulkUrls, setBulkUrls] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [currentReaderPageIndex, setCurrentReaderPageIndex] = useState(0);
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  
  // Selector State
  const [availableGrades, setAvailableGrades] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableBooks, setAvailableBooks] = useState<Book[]>([]);
  const [availableTopics, setAvailableTopics] = useState<BookContent[]>([]);
  const [availableReaderContents, setAvailableReaderContents] = useState<BookReaderContent[]>([]);
  
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<BookContent | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('English');
  const [selectedAgent, setSelectedAgent] = useState<string>(() => localStorage.getItem('preferred_agent') || 'gemini');
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
  const [viewingPlan, setViewingPlan] = useState<LessonPlan | null>(null);
  const [generatedTopicIds, setGeneratedTopicIds] = useState<Set<string>>(new Set());
  const [isBulkGeneratingMCQs, setIsBulkGeneratingMCQs] = useState(false);

  // Filters for Lesson Plans tab
  const [filterGrade, setFilterGrade] = useState<string>('');
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [topicSearchTerm, setTopicSearchTerm] = useState<string>('');

  // Plans Data
  const [currentPlan, setCurrentPlan] = useState<LessonPlan | null>(null);
  const [planHistory, setPlanHistory] = useState<LessonPlan[]>([]);
  
  // Q&A State
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [qaSearchResults, setQaSearchResults] = useState<BookContent[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Initial fetch for grades
  useEffect(() => {
    fetchGrades();
    fetchHistory();
    fetchAllBooks();
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkBackendHealth = async () => {
    try {
      const savedKeysRaw = localStorage.getItem('ai_api_keys');
      let url = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      if (savedKeysRaw) {
        const keys = JSON.parse(savedKeysRaw);
        if (keys.backend_url) url = keys.backend_url;
      }
      const response = await fetch(`${url}/health`).catch(() => null);
      setIsBackendOnline(!!response?.ok);
    } catch {
      setIsBackendOnline(false);
    }
  };

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
      setQaQuestion('');
      setQaAnswer('');
      setCurrentReaderPageIndex(0);
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
        .select('*')
        .eq('book_id', bookId)
        .order('created_at', { ascending: true });
      
      if (topicsError) {
        console.error('Error fetching book_contents:', topicsError);
        throw topicsError;
      }
      setAvailableTopics(topics || []);
      setAvailableReaderContents(topics || []); // Use the same data for reader

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

  // Automatically set title from URL if no file is selected
  useEffect(() => {
    if (bookUrl && !file && !overwriteMode) {
      const fileName = bookUrl.split('/').pop() || '';
      if (fileName && fileName.toLowerCase().includes('.pdf')) {
        const title = decodeURIComponent(fileName)
          .split('?')[0] // Remove query params
          .replace('.pdf', '')
          .replace(/_/g, ' ')
          .replace(/-/g, ' ')
          .trim();
        if (title) {
          setBookMetadata(prev => ({ ...prev, title }));
        }
      }
    }
  }, [bookUrl, file, overwriteMode]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        setError('Please upload a PDF file.');
        return;
      }
      setFile(selectedFile);
      setBookUrl(''); // Clear URL if file is selected
      setBookMetadata({ ...bookMetadata, title: selectedFile.name.replace('.pdf', '') });
      setError(null);
    }
  };

  const uploadBookOnly = async () => {
    if (isBulkMode) {
      await handleBulkUpload();
      return;
    }
    if (!file && !bookUrl) return;
    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabase();
      
      let finalFile: File | Blob;
      let finalFileName: string;

      if (file) {
        finalFile = file;
        finalFileName = file.name;
      } else {
        // Handle URL download
        try {
          let response;
          try {
            response = await fetch(bookUrl);
          } catch (e) {
            // Fallback to CORS proxy if direct fetch fails (likely CORS issue)
            response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(bookUrl)}`);
          }

          if (!response.ok) throw new Error('Failed to fetch file from URL. Ensure the URL is public and allows CORS.');
          const blob = await response.blob();
          if (blob.type !== 'application/pdf' && !bookUrl.toLowerCase().endsWith('.pdf')) {
             throw new Error('The URL does not point to a PDF file.');
          }
          finalFile = blob;
          finalFileName = bookUrl.split('/').pop() || 'downloaded_book.pdf';
          if (!finalFileName.endsWith('.pdf')) finalFileName += '.pdf';
        } catch (err) {
          throw new Error(err instanceof Error ? err.message : 'Failed to download book from URL.');
        }
      }

      // 1. Identify metadata (smartly) if not fully provided
      let finalTitle = bookMetadata.title || finalFileName.replace('.pdf', '');
      let finalSubject = bookMetadata.subject;
      let finalClass = bookMetadata.class;

      if (!finalSubject || !finalClass) {
        try {
          const reader = new FileReader();
          const firstPart = finalFile.slice(0, 1024 * 1024); // First 1MB
          const base64 = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(firstPart);
          });
          
          const identified = await identifyBookMetadata(finalFileName, base64);
          if (!finalTitle) finalTitle = identified.title;
          if (!finalSubject) finalSubject = identified.subject;
          if (!finalClass) finalClass = identified.class;
        } catch (metaErr) {
          console.warn("Metadata identification failed", metaErr);
        }
      }

      // 2. Upload to Storage
      const fileExt = 'pdf';
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${finalClass || 'General'}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('books')
        .upload(filePath, finalFile);

      if (uploadError) throw uploadError;

      // 3. Determine book ID (New or Overwrite)
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
          .eq('title', finalTitle)
          .eq('subject', finalSubject || 'Unknown')
          .eq('class', finalClass || 'General')
          .maybeSingle();

        if (existingBook) {
          bookId = existingBook.id;
          isOverwrite = true;
          oldFilePath = existingBook.file_path;
        } else {
          const { data: newBook, error: bookError } = await supabase
            .from('books')
            .insert([{ 
              title: finalTitle, 
              subject: finalSubject || 'Unknown', 
              class: finalClass || 'General', 
              file_path: filePath 
            }])
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
        await supabase.from('books').update({ 
          title: finalTitle, 
          subject: finalSubject || 'Unknown', 
          class: finalClass || 'General', 
          file_path: filePath 
        }).eq('id', bookId);
      }

      setSuccess(isOverwrite ? 'Book file updated and old contents cleared!' : 'Book uploaded to library!');
      setFile(null);
      setBookUrl('');
      setOverwriteMode(false);
      setSelectedBookToOverwrite('');
      fetchGrades();
      fetchAllBooks();
      navigate('/books');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to upload book.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkUpload = async () => {
    const lines = bulkUrls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (lines.length === 0) return;

    setIsProcessing(true);
    setBulkTotal(lines.length);
    setBulkProgress(0);
    setError(null);
    setSuccess(null);

    let successCount = 0;
    let failCount = 0;

    const supabase = getSupabase();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Support format: URL | Grade | Subject | Title
      const parts = line.split('|').map(p => p.trim());
      const url = parts[0];
      const customGrade = parts[1];
      const customSubject = parts[2];
      const customTitle = parts[3];

      try {
        setBulkProgress(i + 1);
        
        // Extract title from URL as fallback
        const fileName = url.split('/').pop() || '';
        const fallbackTitle = decodeURIComponent(fileName)
          .split('?')[0]
          .replace('.pdf', '')
          .replace(/_/g, ' ')
          .replace(/-/g, ' ')
          .trim() || `Book ${i + 1}`;

        // Download
        let response;
        try {
          response = await fetch(url);
        } catch (e) {
          response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
        }

        if (!response.ok) throw new Error('Fetch failed');
        const blob = await response.blob();
        
        // Identify metadata (smartly)
        let metadata = { 
          title: customTitle || fallbackTitle, 
          subject: customSubject || bookMetadata.subject || 'Unknown', 
          class: customGrade || bookMetadata.class || 'General' 
        };

        // Only use AI if we are missing critical info and user didn't provide it in the line
        if ((!customGrade || !customSubject || !customTitle) && !bookMetadata.subject && !bookMetadata.class) {
          try {
            const reader = new FileReader();
            const firstPart = blob.slice(0, 1024 * 1024); // First 1MB
            const base64 = await new Promise<string>((resolve) => {
              reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
              reader.readAsDataURL(firstPart);
            });
            
            const identified = await identifyBookMetadata(fileName, base64);
            metadata = {
              title: customTitle || identified.title || fallbackTitle,
              subject: customSubject || bookMetadata.subject || identified.subject || 'Unknown',
              class: customGrade || bookMetadata.class || identified.class || 'General'
            };
          } catch (metaErr) {
            console.warn("Metadata identification failed, using fallback", metaErr);
          }
        }

        const fileExt = 'pdf';
        const storageFileName = `${Math.random()}.${fileExt}`;
        const filePath = `${metadata.class}/${storageFileName}`;

        const { error: uploadError } = await supabase.storage
          .from('books')
          .upload(filePath, blob);

        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
          .from('books')
          .insert({
            title: metadata.title,
            subject: metadata.subject,
            class: metadata.class,
            file_path: filePath
          });

        if (insertError) throw insertError;
        successCount++;
      } catch (err) {
        console.error(`Bulk upload failed for ${line}:`, err);
        failCount++;
      }
    }

    setSuccess(`Bulk upload complete: ${successCount} successful, ${failCount} failed.`);
    setBulkUrls('');
    setIsProcessing(false);
    fetchAllBooks();
    fetchGrades();
  };

  const analyzeExistingBook = async (book: Book) => {
    if (!book.file_path) return;
    setBookToAnalyze(book);
    navigate('/analyze');
    setIsProcessing(true);
    setError(null);
    setParsedContents([]);
    setParsedReaderContents([]);

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
          
          // 3. New TOC-First Unified Extraction
          const toc = await extractTOC(base64);
          setBulkTotal(toc.length);
          setBulkProgress(0);

          const allExtracted: Partial<BookContent>[] = [];

          for (let i = 0; i < toc.length; i++) {
            setBulkProgress(i + 1);
            try {
              const details = await unifiedBookExtraction(base64, toc[i]);
              allExtracted.push(details);
              // Update state incrementally so user sees progress
              setParsedContents([...allExtracted]);
            } catch (err) {
              console.error(`Failed to extract topic ${i}:`, err);
            }
          }

          setParsedContents(allExtracted);
          setParsedReaderContents(allExtracted as Partial<BookReaderContent>[]);
          setIsProcessing(false);
          setSuccess(`Successfully extracted ${allExtracted.length} topics from "${book.title}"!`);
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
      await supabase.from('book_contents').delete().eq('book_id', bookId);
      
      // 4. Save new unified contents
      const contentsToSave = parsedContents.map(c => ({
        ...c,
        book_id: bookId
      }));

      const { error: contentsError } = await supabase.from('book_contents').insert(contentsToSave);
      if (contentsError) throw contentsError;

      setSuccess(`Successfully saved ${parsedContents.length} topics to "${bookToAnalyze.title}"!`);
      setParsedContents([]);
      setParsedReaderContents([]);
      setBookToAnalyze(null);
      navigate('/books');
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

  const handleBulkMCQGenerate = async () => {
    if (!selectedBook || availableTopics.length === 0) return;
    setIsBulkGeneratingMCQs(true);
    setBulkProgress(0);
    setBulkTotal(availableTopics.length);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabase();
      let totalSaved = 0;

      for (let i = 0; i < availableTopics.length; i++) {
        const topic = availableTopics[i];
        setBulkProgress(i + 1);

        try {
          const mcqs = await generateMCQs(topic, 3, selectedAgent);
          const toSave = mcqs.map(q => ({
            book_id: selectedBook.id,
            book_content_id: topic.id,
            type: 'mcq',
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_answer,
            difficulty: q.difficulty || 'medium'
          }));

          const { error: saveError } = await supabase.from('questions').insert(toSave);
          if (!saveError) totalSaved += mcqs.length;

          await new Promise(r => setTimeout(r, 500));
        } catch (err) {
          console.error(`Failed MCQs for ${topic.topic}:`, err);
        }
      }

      setSuccess(`Bulk MCQ generation complete! Saved ${totalSaved} questions.`);
    } catch (err) {
      console.error(err);
      setError('Bulk MCQ generation failed.');
    } finally {
      setIsBulkGeneratingMCQs(false);
    }
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
            plan = await generatePlanFromPDFAndTopic(pdfBase64, topic, selectedSubject, selectedGrade, targetLanguage, selectedAgent);
          } else {
            plan = await generatePlanFromContent(topic, selectedSubject, selectedGrade, targetLanguage, selectedAgent);
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

        plan = await generatePlanFromPDFAndTopic(pdfBase64, content, selectedSubject, selectedGrade, targetLanguage, selectedAgent);
      } else {
        plan = await generatePlanFromContent(content, selectedSubject, selectedGrade, targetLanguage, selectedAgent);
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

  const handleAskQuestion = async () => {
    if (!selectedBook || !qaQuestion.trim()) return;
    
    setIsAnswering(true);
    setError(null);
    setQaAnswer('');
    
    try {
      const supabase = getSupabase();
      
      // 1. Search for relevant context first
      setIsSearching(true);
      const relevantContents = await searchBookContents(qaQuestion, selectedBook.id!, supabase);
      setQaSearchResults(relevantContents);
      setIsSearching(false);
      
      if (relevantContents.length === 0 && availableTopics.length === 0) {
        throw new Error("This book has no analyzed content. Please analyze it first in the Books tab.");
      }
      
      // If search found nothing, fallback to first few topics
      const contextToUse = relevantContents.length > 0 
        ? relevantContents 
        : availableTopics.slice(0, 5);
      
      const answer = await answerQuestionFromBook(
        qaQuestion,
        selectedBook.title,
        contextToUse,
        selectedSubject,
        selectedGrade,
        targetLanguage,
        selectedAgent
      );
      
      setQaAnswer(answer);
    } catch (err) {
      console.error('Q&A error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get an answer.');
    } finally {
      setIsAnswering(false);
      setIsSearching(false);
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
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg"><FileText className="text-white w-5 h-5 sm:w-6 sm:h-6" /></div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-800">AI Lesson Planner</h1>
          </Link>
          
          {/* Desktop Nav */}
          <nav className="hidden md:flex bg-slate-100 p-1 rounded-lg">
            <NavLink to="/" className={({isActive}) => cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", isActive ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Upload</NavLink>
            <NavLink to="/books" className={({isActive}) => cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", isActive ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Books</NavLink>
            <NavLink to="/generator" className={({isActive}) => cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", isActive ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Generator</NavLink>
            <NavLink to="/reader" className={({isActive}) => cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", isActive ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Reader</NavLink>
            <NavLink to="/qa" className={({isActive}) => cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", isActive ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Q&A</NavLink>
            <NavLink to="/autonomous" className={({isActive}) => cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", isActive ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Autonomous</NavLink>
            <NavLink to="/exams" className={({isActive}) => cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", isActive ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Exams</NavLink>
            <NavLink to="/lesson-plans" className={({isActive}) => cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", isActive ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Lesson Plans</NavLink>
            <NavLink to="/settings" className={({isActive}) => cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", isActive ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Settings</NavLink>
          </nav>

          <div className="hidden lg:flex items-center gap-4 ml-4">
            <div className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
              isBackendOnline ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
            )}>
              <div className={cn("w-1.5 h-1.5 rounded-full", isBackendOnline ? "bg-emerald-500" : "bg-red-500")}></div>
              {isBackendOnline ? "Agent Online" : "Agent Offline"}
            </div>
            <div className="h-4 w-px bg-slate-200"></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Agent:</span>
            <select
              value={selectedAgent}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAgent(val);
                localStorage.setItem('preferred_agent', val);
              }}
              className="text-xs font-bold bg-slate-100 border-none rounded-lg px-2 py-1 outline-none text-indigo-600"
            >
              <option value="gemini">Gemini (Auto)</option>
              <option value="groq">Groq (Llama 3)</option>
              <option value="huggingface">HuggingFace</option>
              <option value="ollama">Local Ollama</option>
            </select>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-slate-100 overflow-hidden"
            >
              <nav className="flex flex-col p-4 gap-2">
                <NavLink 
                  to="/" 
                  onClick={() => setIsMenuOpen(false)}
                  className={({isActive}) => cn("px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3", isActive ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50")}
                >
                  <Upload className="w-5 h-5" /> Upload
                </NavLink>
                <NavLink 
                  to="/books" 
                  onClick={() => setIsMenuOpen(false)}
                  className={({isActive}) => cn("px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3", isActive ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50")}
                >
                  <BookIcon className="w-5 h-5" /> Books
                </NavLink>
                <NavLink 
                  to="/generator" 
                  onClick={() => setIsMenuOpen(false)}
                  className={({isActive}) => cn("px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3", isActive ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50")}
                >
                  <Sparkles className="w-5 h-5" /> Generator
                </NavLink>
                <NavLink 
                  to="/reader" 
                  onClick={() => setIsMenuOpen(false)}
                  className={({isActive}) => cn("px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3", isActive ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50")}
                >
                  <BookOpen className="w-5 h-5" /> Reader
                </NavLink>
                <NavLink 
                  to="/qa" 
                  onClick={() => setIsMenuOpen(false)}
                  className={({isActive}) => cn("px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3", isActive ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50")}
                >
                  <Search className="w-5 h-5" /> Q&A
                </NavLink>
                <NavLink
                  to="/autonomous"
                  onClick={() => setIsMenuOpen(false)}
                  className={({isActive}) => cn("px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3", isActive ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50")}
                >
                  <Activity className="w-5 h-5" /> Autonomous
                </NavLink>
                <NavLink
                  to="/exams"
                  onClick={() => setIsMenuOpen(false)}
                  className={({isActive}) => cn("px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3", isActive ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50")}
                >
                  <FileText className="w-5 h-5" /> Exams
                </NavLink>
                <NavLink 
                  to="/lesson-plans" 
                  onClick={() => setIsMenuOpen(false)}
                  className={({isActive}) => cn("px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3", isActive ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50")}
                >
                  <FileText className="w-5 h-5" /> Lesson Plans
                </NavLink>
                <NavLink
                  to="/settings"
                  onClick={() => setIsMenuOpen(false)}
                  className={({isActive}) => cn("px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3", isActive ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50")}
                >
                  <SettingsIcon className="w-5 h-5" /> Settings
                </NavLink>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {error && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3"><AlertCircle className="w-5 h-5" />{error}</motion.div>}
          {success && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl flex items-center gap-3"><CheckCircle2 className="w-5 h-5" />{success}</motion.div>}
        </AnimatePresence>

        <Routes>
          <Route path="/" element={
            <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Upload Textbook</h2>
                  <p className="text-slate-500">Extract lessons from PDF and store in database.</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
                  <button 
                    onClick={() => { setOverwriteMode(false); setIsBulkMode(false); }} 
                    className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-all", (!overwriteMode && !isBulkMode) ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}
                  >
                    New Book
                  </button>
                  <button 
                    onClick={() => { setOverwriteMode(true); setIsBulkMode(false); }} 
                    className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-all", (overwriteMode && !isBulkMode) ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}
                  >
                    Overwrite
                  </button>
                  <button 
                    onClick={() => { setIsBulkMode(true); setOverwriteMode(false); }} 
                    className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-all", isBulkMode ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}
                  >
                    Bulk Links
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  {isBulkMode ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-indigo-600 font-bold mb-2">
                        <Layers className="w-5 h-5" />
                        <span>Bulk URL Upload</span>
                      </div>
                      <textarea
                        placeholder="Format: URL | Grade | Subject | Title (one per line)
Example: https://site.com/book.pdf | 10 | Science | Physics Part 1"
                        value={bulkUrls}
                        onChange={(e) => setBulkUrls(e.target.value)}
                        className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                      />
                      <p className="text-xs text-slate-400 italic">
                        Use the pipe symbol (|) to separate details. If you only provide the URL, AI will try to identify the rest.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="relative group">
                        <input type="file" accept=".pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                        <div className={cn("border-2 border-dashed rounded-2xl p-10 transition-all flex flex-col items-center justify-center gap-4", file ? "border-indigo-400 bg-indigo-50" : "border-slate-300 group-hover:border-indigo-400 group-hover:bg-slate-50")}>
                          <div className={cn("p-4 rounded-full", file ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400")}><Upload className="w-8 h-8" /></div>
                          <p className="font-bold text-slate-700 text-center">{file ? file.name : "Click or drag PDF here"}</p>
                          <p className="text-xs text-slate-400 tracking-wide uppercase font-bold">PDF Format Only</p>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                          <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-2 text-slate-400 font-bold tracking-widest">OR PASTE URL</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="relative">
                          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="url" 
                            placeholder="https://example.com/book.pdf" 
                            value={bookUrl}
                            onChange={e => {
                              setBookUrl(e.target.value);
                              if (e.target.value) setFile(null); // Clear file if URL is pasted
                            }}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 italic ml-1">Note: URL must be direct link to a public PDF file.</p>
                      </div>
                    </>
                  )}

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
                      disabled={isProcessing || (!isBulkMode && !file && !bookUrl) || (isBulkMode && !bulkUrls) || (overwriteMode && !selectedBookToOverwrite) || (!overwriteMode && !isBulkMode && (!bookMetadata.title || !bookMetadata.subject || !bookMetadata.class))}
                      className="w-full py-4 rounded-2xl font-bold text-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <div className="flex flex-col items-center">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="text-[10px] mt-1 font-normal opacity-80">
                            {isBulkMode ? `Processing ${bulkProgress}/${bulkTotal}` : 'Identifying & Uploading...'}
                          </span>
                        </div>
                      ) : (
                        <><Save className="w-6 h-6" /> {isBulkMode ? 'Bulk Upload to Library' : 'Upload to Library'}</>
                      )}
                    </button>

                    {isProcessing && bulkTotal > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                          <span>Processing Bulk Upload</span>
                          <span>{bulkProgress} / {bulkTotal}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(bulkProgress / bulkTotal) * 100}%` }}
                            className="h-full bg-indigo-600"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          } />

          <Route path="/analyze" element={
            <section className="max-w-4xl mx-auto space-y-8">
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Review Extraction</h2>
                    <p className="text-slate-500">AI analysis of {bookToAnalyze?.title || file?.name}</p>
                  </div>
                  <button 
                    onClick={() => navigate('/')}
                    className="text-sm font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 w-fit"
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

                    <div className="flex flex-col sm:flex-row gap-4">
                      <button 
                        onClick={() => navigate('/')}
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
          } />

          <Route path="/books" element={
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Book Library</h2>
                <p className="text-sm text-slate-500 hidden sm:block">Organized by Grade</p>
              </div>
              
              {Array.from(new Set(allBooks.map(b => b.class))).filter(Boolean).sort().map((grade, gIdx) => (
                <div key={`grade-group-${grade}-${gIdx}`} className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Folder className="w-5 h-5" />
                    <h3 className="font-bold text-slate-700">Grade {grade}</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pl-0 sm:pl-7">
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
                            className="text-slate-300 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
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
                              navigate('/generator');
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
          } />

          <Route path="/generator" element={
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
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
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
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        {isBulkGeneratingMCQs ? (
                          <div className="w-48">
                             <div className="flex justify-between text-[10px] font-bold text-indigo-600 mb-1 uppercase">
                               <span>MCQs...</span>
                               <span>{Math.round((bulkProgress / bulkTotal) * 100)}%</span>
                             </div>
                             <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                               <motion.div className="h-full bg-indigo-600" initial={{ width: 0 }} animate={{ width: `${(bulkProgress / bulkTotal) * 100}%` }} />
                             </div>
                          </div>
                        ) : (
                          <button
                            onClick={handleBulkMCQGenerate}
                            className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" /> Bulk MCQs
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <h3 className="text-xl font-bold flex items-center gap-2"><List className="text-indigo-600 w-5 h-5" /> Topics & Lessons</h3>
                        <div className="text-sm text-slate-500">
                          <span className="font-bold text-slate-700">{generatedTopicIds.size}</span> / {availableTopics.length} Generated
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                        <div className="relative w-full sm:w-64">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="text"
                            placeholder="Search topics..."
                            value={topicSearchTerm}
                            onChange={e => setTopicSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          />
                          {topicSearchTerm && (
                            <button 
                              onClick={() => setTopicSearchTerm('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full text-slate-400"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {isBulkGenerating ? (
                          <div className="w-full sm:w-64">
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
                      {availableTopics
                        .filter(t => !topicSearchTerm || t.topic.toLowerCase().includes(topicSearchTerm.toLowerCase()) || t.unit.toLowerCase().includes(topicSearchTerm.toLowerCase()))
                        .map((topic) => {
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
                    
                    {availableTopics.filter(t => !topicSearchTerm || t.topic.toLowerCase().includes(topicSearchTerm.toLowerCase()) || t.unit.toLowerCase().includes(topicSearchTerm.toLowerCase())).length === 0 && (
                      <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                        <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm">No topics match your search.</p>
                      </div>
                    )}
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
                    <div className="bg-indigo-600 px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white">
                      <div>
                        <h3 className="text-2xl font-bold">{currentPlan.lesson_topic || (currentPlan as any).topic}</h3>
                        <p className="opacity-80">{currentPlan.subject} • Grade {currentPlan.class}</p>
                      </div>
                      <div className="flex flex-wrap gap-3">
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
          } />

          <Route path="/reader" element={
            <section className="space-y-8">
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="text-indigo-600 w-6 h-6" /> Book Reader</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Grade Selector */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Grade</label>
                    <select 
                      value={selectedGrade} 
                      onChange={e => setSelectedGrade(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="">-- Grade --</option>
                      {availableGrades.map((g, i) => <option key={`reader-g-${g}-${i}`} value={g}>{g}</option>)}
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
                      {availableSubjects.map((s, i) => <option key={`reader-s-${s}-${i}`} value={s}>{s}</option>)}
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
                      {availableBooks.map((b, i) => <option key={`reader-b-${b.id}-${i}`} value={b.id}>{b.title}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {selectedBook && (availableReaderContents.length > 0 || availableTopics.length > 0) ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                  {/* Chapter Navigation Sidebar */}
                  <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-24">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><List className="w-4 h-4 text-indigo-600" /> Chapters</h3>
                      <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {(availableReaderContents.length > 0 ? availableReaderContents : availableTopics).map((topic, idx) => (
                          <button
                            key={`topic-nav-${idx}`}
                            onClick={() => {
                              setCurrentReaderPageIndex(idx);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all line-clamp-1",
                              currentReaderPageIndex === idx 
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                                : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
                            )}
                          >
                            <span className="opacity-50 mr-2">{idx + 1}.</span> {topic.topic}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Content Display */}
                  <div className="lg:col-span-3 space-y-8">
                    {availableReaderContents.length === 0 && availableTopics.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-800 text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p>Showing basic content. For the full academic reader experience (key points, examples, formulas), please re-analyze this book in the Library.</p>
                      </div>
                    )}

                    {/* Pagination Controls Top */}
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <button 
                        onClick={() => setCurrentReaderPageIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentReaderPageIndex === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" /> Previous
                      </button>
                      <div className="text-sm font-bold text-slate-500">
                        Page <span className="text-indigo-600">{currentReaderPageIndex + 1}</span> of {availableReaderContents.length > 0 ? availableReaderContents.length : availableTopics.length}
                      </div>
                      <button 
                        onClick={() => setCurrentReaderPageIndex(prev => Math.min((availableReaderContents.length > 0 ? availableReaderContents.length : availableTopics.length) - 1, prev + 1))}
                        disabled={currentReaderPageIndex === (availableReaderContents.length > 0 ? availableReaderContents.length : availableTopics.length) - 1}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 transition-all"
                      >
                        Next <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Single Page Content */}
                    {(() => {
                      const contentList = availableReaderContents.length > 0 ? availableReaderContents : availableTopics;
                      const topic = contentList[currentReaderPageIndex];
                      if (!topic) return null;

                      return (
                        <motion.div 
                          key={`page-${currentReaderPageIndex}`}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
                        >
                          <div className="bg-slate-50 px-8 py-4 border-b border-slate-200 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">{topic.unit} {topic.chapter ? `• ${topic.chapter}` : ''}</p>
                              <h3 className="text-xl font-bold text-slate-800">{topic.topic}</h3>
                            </div>
                            <div className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-lg shadow-indigo-100">
                              {currentReaderPageIndex + 1}
                            </div>
                          </div>
                          
                          <div className="p-8 space-y-8">
                            {topic.sub_topic && (
                              <div className="text-sm font-bold text-indigo-500 uppercase tracking-wider">
                                Sub-topic: {topic.sub_topic}
                              </div>
                            )}

                            <div className="prose prose-slate max-w-none">
                              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-lg">
                                {availableReaderContents.length > 0 ? (topic as any).full_content : (topic as any).content}
                              </p>
                            </div>
                            
                            {availableReaderContents.length > 0 && (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {(topic as any).key_points && (topic as any).key_points.length > 0 && (
                                    <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl">
                                      <h5 className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Sparkles className="w-3 h-3" /> Key Takeaways
                                      </h5>
                                      <ul className="space-y-3">
                                        {(topic as any).key_points.map((pt: string, i: number) => (
                                          <li key={`pt-${i}`} className="text-sm text-slate-700 flex gap-3">
                                            <span className="text-indigo-400 font-bold shrink-0">•</span> {pt}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {(topic as any).examples && (topic as any).examples.length > 0 && (
                                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl">
                                      <h5 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <BookOpen className="w-3 h-3" /> Examples
                                      </h5>
                                      <ul className="space-y-3">
                                        {(topic as any).examples.map((ex: string, i: number) => (
                                          <li key={`ex-${i}`} className="text-sm text-slate-700 flex gap-3">
                                            <span className="text-amber-400 font-bold shrink-0">→</span> {ex}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>

                                {(topic as any).formulas && (topic as any).formulas.length > 0 && (
                                  <div className="bg-slate-900 p-8 rounded-2xl">
                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                      <RefreshCw className="w-3 h-3" /> Formulas & Concepts
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      {(topic as any).formulas.map((f: string, i: number) => (
                                        <div key={`f-${i}`} className="bg-white/5 border border-white/10 p-4 rounded-xl text-white font-mono text-sm flex items-center justify-center text-center">
                                          {f}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}

                            {availableReaderContents.length === 0 && (topic as any).goals && (
                              <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl">
                                <h5 className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                                  <CheckCircle2 className="w-3 h-3" /> Learning Objectives
                                </h5>
                                <p className="text-emerald-800 text-sm italic">{(topic as any).goals}</p>
                              </div>
                            )}

                            <div className="pt-8 border-t border-slate-100">
                               <MCQGenerator content={topic as BookContent} agent={selectedAgent} />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })()}

                    {/* Pagination Controls Bottom */}
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <button 
                        onClick={() => {
                          setCurrentReaderPageIndex(prev => Math.max(0, prev - 1));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        disabled={currentReaderPageIndex === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" /> Previous
                      </button>
                      <button 
                        onClick={() => {
                          setCurrentReaderPageIndex(prev => Math.min((availableReaderContents.length > 0 ? availableReaderContents.length : availableTopics.length) - 1, prev + 1));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        disabled={currentReaderPageIndex === (availableReaderContents.length > 0 ? availableReaderContents.length : availableTopics.length) - 1}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 transition-all"
                      >
                        Next <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                </div>
              ) : selectedBook ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                  <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">This book hasn't been analyzed yet.</p>
                  <button 
                    onClick={() => navigate('/books')}
                    className="mt-4 text-indigo-600 font-bold hover:underline"
                  >
                    Go to Library to Analyze
                  </button>
                </div>
              ) : (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                  <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400">Select a Grade, Subject, and Book to view its content.</p>
                </div>
              )}
            </section>
          } />

          <Route path="/qa" element={
            <section className="space-y-8">
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2"><Search className="text-indigo-600 w-6 h-6" /> Book Q&A</h2>
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {/* Grade Selector */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Grade</label>
                    <select 
                      value={selectedGrade} 
                      onChange={e => setSelectedGrade(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="">-- Grade --</option>
                      {availableGrades.map((g, i) => <option key={`qa-g-${g}-${i}`} value={g}>{g}</option>)}
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
                      {availableSubjects.map((s, i) => <option key={`qa-s-${s}-${i}`} value={s}>{s}</option>)}
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
                      {availableBooks.map((b, i) => <option key={`qa-b-${b.id}-${i}`} value={b.id}>{b.title}</option>)}
                    </select>
                  </div>
                </div>

                {selectedBook && (
                  <div className="space-y-6 pt-6 border-t border-slate-100">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-500 uppercase">Ask a question about this book</label>
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Search-enabled</span>
                      </div>
                      <div className="relative">
                        <textarea 
                          value={qaQuestion}
                          onChange={e => setQaQuestion(e.target.value)}
                          placeholder="e.g., What are the main causes of air pollution mentioned in this book?"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[100px]"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <button 
                        onClick={handleAskQuestion}
                        disabled={isAnswering || !qaQuestion.trim()}
                        className="flex-1 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isAnswering ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        {isAnswering ? 'Finding Answer...' : 'Ask Question'}
                      </button>
                      
                      <button 
                        onClick={async () => {
                          if (!selectedBook || !qaQuestion.trim()) return;
                          setIsSearching(true);
                          const results = await searchBookContents(qaQuestion, selectedBook.id!, getSupabase());
                          setQaSearchResults(results);
                          setIsSearching(false);
                        }}
                        disabled={isSearching || !qaQuestion.trim()}
                        className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                        Search Book
                      </button>
                    </div>

                    {qaSearchResults.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-bold text-slate-400 uppercase">Related Sections Found:</p>
                        <div className="flex flex-wrap gap-2">
                          {qaSearchResults.map((res, i) => (
                            <div key={`res-${i}`} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg border border-indigo-100">
                              {res.topic}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!selectedBook && (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                    <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400">Select a Grade, Subject, and Book to start asking questions.</p>
                  </div>
                )}
              </div>

              {/* Answer Display */}
              <AnimatePresence mode="wait">
                {(isAnswering || qaAnswer) && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-lg"
                  >
                    <div className="bg-indigo-600 px-8 py-4 text-white flex items-center justify-between">
                      <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-5 h-5" /> Answer</h3>
                      {qaAnswer && (
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(qaAnswer);
                            setSuccess('Answer copied to clipboard!');
                          }}
                          className="p-2 hover:bg-white/10 rounded-lg transition-all"
                          title="Copy Answer"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="p-8">
                      {isAnswering ? (
                        <div className="flex flex-col items-center justify-center py-10">
                          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                          <p className="text-slate-500 animate-pulse">Consulting the textbook...</p>
                        </div>
                      ) : (
                        <div className="prose prose-slate max-w-none">
                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{qaAnswer}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          } />

          <Route path="/autonomous" element={<AutonomousDashboard />} />
          <Route path="/exams" element={<ExamGenerator agent={selectedAgent} />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/lesson-plans" element={
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <h3 className="text-2xl font-bold text-slate-800">Saved Lesson Plans</h3>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[250px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Search lessons, topics, subjects..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                      {searchTerm && (
                        <button 
                          onClick={() => setSearchTerm('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full text-slate-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

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
                    .filter(p => {
                      const matchesGrade = !filterGrade || p.class === filterGrade;
                      const matchesSubject = !filterSubject || p.subject === filterSubject;
                      const searchLower = searchTerm.toLowerCase();
                      const matchesSearch = !searchTerm || 
                        (p.lesson_topic || '').toLowerCase().includes(searchLower) ||
                        (p.subject || '').toLowerCase().includes(searchLower) ||
                        (p.chapter || '').toLowerCase().includes(searchLower) ||
                        (p.class || '').toLowerCase().includes(searchLower);
                      
                      return matchesGrade && matchesSubject && matchesSearch;
                    })
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
                  
                  {planHistory.length > 0 && planHistory.filter(p => {
                    const matchesGrade = !filterGrade || p.class === filterGrade;
                    const matchesSubject = !filterSubject || p.subject === filterSubject;
                    const searchLower = searchTerm.toLowerCase();
                    return matchesGrade && matchesSubject && (!searchTerm || 
                      (p.lesson_topic || '').toLowerCase().includes(searchLower) ||
                      (p.subject || '').toLowerCase().includes(searchLower) ||
                      (p.chapter || '').toLowerCase().includes(searchLower) ||
                      (p.class || '').toLowerCase().includes(searchLower));
                  }).length === 0 && (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                      <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400">No lesson plans match your search or filters.</p>
                    </div>
                  )}

                  {planHistory.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                      <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400">No lesson plans generated yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
