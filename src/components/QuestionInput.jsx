import React from 'react';
import { EXAMPLE_QUESTIONS } from '../data/exampleQuestions';

export function QuestionInput({ userQuestion, setUserQuestion, placeholderIndex }) {
  return (
    <div className="modern-surface p-6 mb-8">
      <label className="block text-amber-200 font-serif mb-3 text-sm sm:text-base">
        Step 2 · Your question or intention <span className="text-amber-300/80 text-xs font-normal">(optional)</span>
      </label>
      <input
        type="text"
        value={userQuestion}
        onChange={event => setUserQuestion(event.target.value)}
        placeholder={EXAMPLE_QUESTIONS[placeholderIndex]}
        className="w-full bg-slate-950/80 border border-emerald-400/40 rounded-lg px-4 py-3 text-amber-100 placeholder-emerald-200/35 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/70 transition-all"
      />
      <p className="text-amber-100/85 text-sm mt-2">Focus your intention for a more personalized reading</p>
    </div>
  );
}
