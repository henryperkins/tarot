import React from 'react';
import { EXAMPLE_QUESTIONS } from '../data/exampleQuestions';

export function QuestionInput({ userQuestion, setUserQuestion, placeholderIndex }) {
  return (
    <div className="bg-indigo-900/40 backdrop-blur rounded-lg p-6 mb-8 border border-amber-500/20">
      <label className="block text-amber-200 font-serif mb-3">Your Question or Intention (Optional)</label>
      <input
        type="text"
        value={userQuestion}
        onChange={event => setUserQuestion(event.target.value)}
        placeholder={EXAMPLE_QUESTIONS[placeholderIndex]}
        className="w-full bg-indigo-950/60 border border-amber-500/30 rounded-lg px-4 py-3 text-amber-100 placeholder-amber-100/40 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
      />
      <p className="text-amber-100/60 text-sm mt-2">Focus your intention for a more personalized reading</p>
    </div>
  );
}