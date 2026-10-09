import PropTypes from 'prop-types';
import { TableuLogo } from './TableuLogo';

/** Shared, decorative Tableu card back for ritual and unrevealed cards. */
export function CardBack({ className = '' }) {
  return (
    <div className={`tarot-card-back ${className}`} aria-hidden="true">
      <TableuLogo size="100%" className="tarot-card-back__brand" decorative />
    </div>
  );
}

CardBack.propTypes = {
  className: PropTypes.string
};
