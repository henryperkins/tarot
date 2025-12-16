/**
 * JourneyStorySection - Prose narrative of the reading journey.
 */

import { memo } from 'react';
import { BookOpen } from '@phosphor-icons/react';

function JourneyStorySection({ story }) {
  if (!story) return null;

  return (
    <div className="rounded-lg bg-amber-200/5 p-3 border border-amber-300/10">
      <p className="flex items-center gap-1.5 text-xs text-amber-100/60 mb-2">
        <BookOpen className="h-3 w-3" />
        Your Journey Story
      </p>
      <p className="text-sm text-amber-100/80 leading-relaxed italic">
        &ldquo;{story}&rdquo;
      </p>
    </div>
  );
}

export default memo(JourneyStorySection);
