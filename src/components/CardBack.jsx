import PropTypes from 'prop-types';
import { TableuLogo } from './TableuLogo';

/**
 * Shared, decorative Tableu card back for ritual and unrevealed cards. Pass
 * `as="span"` inside a button, whose content must be phrasing content.
 */
export function CardBack({ className = '', as: Tag = 'div' }) {
  return (
    <Tag className={`tarot-card-back ${className}`} aria-hidden="true">
      <TableuLogo size="100%" className="tarot-card-back__brand" decorative />
    </Tag>
  );
}

CardBack.propTypes = {
  className: PropTypes.string,
  as: PropTypes.oneOf(['div', 'span'])
};
