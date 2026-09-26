import PropTypes from 'prop-types';
import { Info } from '@phosphor-icons/react';

export function NarrativeSafetyNotice({
  className = '',
  compact = false
}) {
  // A quiet note rather than a card, so the reading itself leads.
  return (
    <div role="note" className={`flex items-start gap-2.5 ${className}`}>
      <Info aria-hidden="true" className={`${compact ? 'mt-0.5' : 'mt-1'} h-4 w-4 flex-none text-secondary`} />
      <div className={`min-w-0 space-y-1 ${compact ? 'text-xs' : 'text-sm'} leading-relaxed text-muted`}>
        <p>
          This narrative braids together your spread positions, card meanings, and reflections into a single through-line.
          {' '}Use what resonates, and set aside what does not.
        </p>
        <p>Reflective guidance only. Not medical, mental health, legal, financial, or safety advice.</p>
      </div>
    </div>
  );
}

NarrativeSafetyNotice.propTypes = {
  className: PropTypes.string,
  compact: PropTypes.bool
};
