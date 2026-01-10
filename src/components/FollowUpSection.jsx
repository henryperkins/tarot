/**
 * FollowUpSection Component
 * 
 * Enables users to ask follow-up questions about their tarot reading.
 * Shows contextual suggestions and supports free-form questions with
 * tier-based limits and optional journal context integration.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useReading } from '../contexts/ReadingContext';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { generateFollowUpSuggestions } from '../lib/followUpSuggestions';
import { ChatCircle, PaperPlaneTilt, SpinnerGap, Lightning, Lock, CaretDown } from '@phosphor-icons/react';
import clsx from 'clsx';

const MAX_MESSAGE_LENGTH = 500;
const MAX_VISIBLE_MESSAGES = 10;

// Tier-based follow-up limits (matches backend)
const FOLLOW_UP_LIMITS = {
  free: 1,
  plus: 3,
  pro: 10
};

export default function FollowUpSection() {
  const { 
    reading, 
    personalReading, 
    themes, 
    readingMeta,
    userQuestion 
  } = useReading();
  const { isAuthenticated } = useAuth();
  const { effectiveTier } = useSubscription();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [includeJournal, setIncludeJournal] = useState(true);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Generate contextual suggestions
  const suggestions = useMemo(() => 
    generateFollowUpSuggestions(reading, themes, readingMeta),
    [reading, themes, readingMeta]
  );
  
  // Check if user can use journal context (Plus+ tier)
  const canUseJournal = useMemo(() => {
    return effectiveTier === 'plus' || effectiveTier === 'pro';
  }, [effectiveTier]);
  
  // Get follow-up limit based on tier
  const followUpLimit = useMemo(() => {
    return FOLLOW_UP_LIMITS[effectiveTier] || FOLLOW_UP_LIMITS.free;
  }, [effectiveTier]);
  
  const turnsUsed = messages.filter(m => m.role === 'user').length;
  const canAskMore = turnsUsed < followUpLimit;
  const hasValidReading = Boolean(personalReading) && !personalReading.isError;
  
  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  const askFollowUp = useCallback(async (question) => {
    if (!question?.trim() || isLoading || !canAskMore || !hasValidReading) return;
    
    setError(null);
    setIsLoading(true);
    setInputValue('');
    
    // Add user message immediately
    const userMessage = { role: 'user', content: question.trim() };
    setMessages(prev => [...prev, userMessage]);
    
    try {
      const response = await fetch('/api/reading-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          requestId: readingMeta?.requestId,
          followUpQuestion: question.trim(),
          conversationHistory: messages,
          readingContext: {
            cardsInfo: reading,
            userQuestion,
            narrative: personalReading?.raw || (typeof personalReading === 'string' ? personalReading : ''),
            themes,
            spreadKey: readingMeta?.spreadKey,
            deckStyle: readingMeta?.deckStyle
          },
          options: {
            includeJournalContext: includeJournal && canUseJournal
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle specific error types
        if (response.status === 401) {
          throw new Error('Please sign in to ask follow-up questions.');
        }
        if (response.status === 403) {
          throw new Error(errorData.message || 'You\'ve reached your follow-up limit for this reading.');
        }
        if (response.status === 429) {
          throw new Error(errorData.message || 'Daily follow-up limit reached. Try again tomorrow.');
        }
        
        throw new Error(errorData.message || errorData.error || 'Failed to get response');
      }
      
      const data = await response.json();
      
      // Add assistant response
      const assistantMessage = { 
        role: 'assistant', 
        content: data.response,
        journalContext: data.journalContext
      };
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (err) {
      console.error('Follow-up error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      // Remove the user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading, canAskMore, hasValidReading, readingMeta, messages, reading, 
    userQuestion, personalReading, themes, includeJournal, canUseJournal
  ]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    askFollowUp(inputValue);
  };
  
  const handleSuggestionClick = (suggestion) => {
    if (!isLoading && canAskMore) {
      askFollowUp(suggestion.text);
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      // Focus input when expanding
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Don't render if no reading available
  if (!hasValidReading) {
    return null;
  }
  
  return (
    <section 
      className="mt-8 border-t border-secondary/30 pt-6"
      aria-labelledby="follow-up-heading"
    >
      {/* Collapsed state - toggle button */}
      <button 
        id="follow-up-heading"
        onClick={toggleExpanded}
        className={clsx(
          "flex items-center gap-2 text-accent hover:text-main transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-lg px-2 py-1 -ml-2"
        )}
        aria-expanded={isExpanded}
        aria-controls="follow-up-content"
      >
        <ChatCircle 
          className="w-5 h-5" 
          weight={isExpanded ? 'fill' : 'regular'} 
          aria-hidden="true"
        />
        <span className="font-medium">
          {isExpanded ? 'Close follow-up questions' : 'Have a question about your reading?'}
        </span>
        {!isExpanded && turnsUsed > 0 && (
          <span className="text-xs text-muted">({turnsUsed}/{followUpLimit} used)</span>
        )}
        <CaretDown 
          className={clsx(
            "w-4 h-4 transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      
      {/* Expanded state */}
      {isExpanded && (
        <div 
          id="follow-up-content"
          className="mt-4 space-y-4 animate-fade-in"
        >
          {/* Suggestions (show only if no messages yet) */}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2" role="list" aria-label="Suggested questions">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  disabled={isLoading || !canAskMore}
                  className={clsx(
                    "px-3 py-1.5 text-sm rounded-full border transition-all",
                    "border-accent/30 hover:border-accent hover:bg-accent/10",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  )}
                  role="listitem"
                >
                  {suggestion.text}
                </button>
              ))}
            </div>
          )}
          
          {/* Conversation history */}
          {messages.length > 0 && (
            <div 
              className="space-y-3 max-h-80 overflow-y-auto pr-2 scroll-smooth"
              role="log"
              aria-label="Conversation history"
              aria-live="polite"
            >
              {messages.slice(-MAX_VISIBLE_MESSAGES).map((msg, idx) => (
                <div 
                  key={idx} 
                  className={clsx(
                    "flex",
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div className={clsx(
                    "max-w-[85%] px-4 py-2.5 rounded-2xl",
                    msg.role === 'user' 
                      ? 'bg-primary/20 text-main rounded-br-md' 
                      : 'bg-surface-elevated text-main rounded-bl-md border border-secondary/20'
                  )}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    
                    {/* Journal context indicator */}
                    {msg.journalContext?.patternsFound?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-secondary/20 text-xs text-muted flex items-center gap-1">
                        <Lightning className="w-3 h-3" weight="fill" aria-hidden="true" />
                        <span>Informed by {msg.journalContext.patternsFound.length} journal pattern(s)</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted text-sm" aria-live="polite">
              <SpinnerGap className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Reflecting on your question...</span>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div 
              className="text-error text-sm bg-error/10 px-3 py-2 rounded-lg"
              role="alert"
            >
              {error}
            </div>
          )}
          
          {/* Input form */}
          {canAskMore ? (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a follow-up question..."
                  disabled={isLoading}
                  aria-label="Follow-up question"
                  className={clsx(
                    "w-full px-4 py-2.5 pr-16 rounded-xl border transition-all",
                    "border-secondary/40 bg-surface/80",
                    "focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none",
                    "placeholder:text-muted/60",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                />
                <span 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none"
                  aria-hidden="true"
                >
                  {inputValue.length}/{MAX_MESSAGE_LENGTH}
                </span>
              </div>
              
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                aria-label="Send question"
                className={clsx(
                  "px-4 py-2.5 bg-accent text-surface rounded-xl transition-all",
                  "hover:bg-accent/90 active:scale-95",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                )}
              >
                <PaperPlaneTilt className="w-5 h-5" weight="fill" aria-hidden="true" />
              </button>
            </form>
          ) : (
            <div className="text-center text-muted text-sm py-2">
              You&apos;ve used all {followUpLimit} follow-up question{followUpLimit > 1 ? 's' : ''} for this reading.
              {effectiveTier !== 'pro' && (
                <a 
                  href="/pricing" 
                  className="ml-2 text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded"
                >
                  Upgrade for more
                </a>
              )}
            </div>
          )}
          
          {/* Usage indicator */}
          {canAskMore && turnsUsed > 0 && (
            <div className="text-xs text-muted text-center">
              {turnsUsed}/{followUpLimit} follow-up{followUpLimit > 1 ? 's' : ''} used for this reading
            </div>
          )}
          
          {/* Journal toggle (Plus+ only) */}
          {canUseJournal && (
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeJournal}
                onChange={(e) => setIncludeJournal(e.target.checked)}
                className="rounded border-secondary/40 text-accent focus:ring-accent/50 focus:ring-offset-0"
              />
              <Lightning className="w-3 h-3" weight="fill" aria-hidden="true" />
              <span>Include insights from my journal history</span>
            </label>
          )}
          
          {/* Journal upsell for free/auth'd users */}
          {!canUseJournal && isAuthenticated && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Lock className="w-3 h-3" aria-hidden="true" />
              <span>
                <a 
                  href="/pricing" 
                  className="text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded"
                >
                  Upgrade to Plus
                </a>
                {' '}for journal-powered insights
              </span>
            </div>
          )}
          
          {/* Sign-in prompt for unauthenticated users */}
          {!isAuthenticated && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Lock className="w-3 h-3" aria-hidden="true" />
              <span>Sign in to ask follow-up questions</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
