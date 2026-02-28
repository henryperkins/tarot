import PropTypes from 'prop-types';

export function NarrativeSafetyNotice({
  className = '',
  compact = false
}) {
  return (
    <div className={`rounded-xl border border-secondary/35 bg-surface/70 ${compact ? 'px-3 py-2.5' : 'px-4 py-3.5'} ${className}`}>
      <p className={`${compact ? 'text-xs' : 'text-sm'} text-muted leading-relaxed`}>
        This narrative braids together your spread positions, card meanings, and reflections into a single through-line.
      </p>
      <p className={`${compact ? 'mt-1.5 text-xs' : 'mt-2 text-sm'} text-muted leading-relaxed`}>
        Use what resonates, and set aside what does not.
      </p>
      <p className={`${compact ? 'mt-1.5 text-xs' : 'mt-2 text-sm'} text-muted/90 leading-relaxed`}>
        Reflective guidance only. Not medical, mental health, legal, financial, or safety advice.
      </p>
    </div>
  );
}

NarrativeSafetyNotice.propTypes = {
  className: PropTypes.string,
  compact: PropTypes.bool
};
