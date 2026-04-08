import React, { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, Copy, Save, HelpCircle } from 'lucide-react';
import { generateMCQs } from '../services/geminiService';
import { getSupabase } from '../lib/supabase';
import { BookContent } from '../types';

interface MCQGeneratorProps {
  content: BookContent;
  agent?: string;
  onQuestionsSaved?: () => void;
}

export function MCQGenerator({ content, agent, onQuestionsSaved }: MCQGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [count, setCount] = useState(5);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setSuccess(null);
    try {
      const mcqs = await generateMCQs(content, count, agent || 'gemini');
      setQuestions(mcqs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (questions.length === 0) return;
    const supabase = getSupabase();

    const toSave = questions.map(q => ({
      book_id: content.book_id,
      book_content_id: content.id,
      type: 'mcq',
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      difficulty: q.difficulty || 'medium'
    }));

    const { error } = await supabase.from('questions').insert(toSave);
    if (!error) {
      setSuccess(`Successfully saved ${questions.length} MCQs to the pool!`);
      setQuestions([]);
      if (onQuestionsSaved) onQuestionsSaved();
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-indigo-600" /> MCQ Generator
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="20"
            value={count}
            onChange={e => setCount(parseInt(e.target.value))}
            className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm"
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate
          </button>
        </div>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      {questions.length > 0 && (
        <div className="space-y-4">
          <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {questions.map((q, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 mb-3">{idx + 1}. {q.question_text}</p>
                <div className="grid grid-cols-2 gap-2">
                  {q.options.map((opt: string, oIdx: number) => (
                    <div key={oIdx} className={cn(
                      "p-2 rounded-lg text-xs border",
                      opt === q.correct_answer ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold" : "bg-white border-slate-100 text-slate-600"
                    )}>
                      {String.fromCharCode(65 + oIdx)}. {opt}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" /> Save to Question Pool
          </button>
        </div>
      )}
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
