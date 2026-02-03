import PropTypes from 'prop-types';
import { WandsIcon, CupsIcon, SwordsIcon, PentaclesIcon } from './illustrations/SuitIcons';

/**
 * Presentational component that renders the standard tarot card back.
 *
 * Displays the reusable card back design used across the app, featuring a
 * central celestial sigil and surrounding suit medallions for Wands, Cups,
 * Swords, and Pentacles.
 *
 * @param {Object} props - Component props.
 * @param {string} [props.className] - Optional additional class names to merge
 *   with the base `tarot-card-back` styles.
 * @returns {JSX.Element} The decorative card back markup.
 */
export function CardBack({ className = '' }) {
  return (
    <div className={`tarot-card-back ${className}`} aria-hidden="true">
      <div className="tarot-card-back__frame" />
      <div className="tarot-card-back__inner">
        <div className="tarot-card-back__sigil">
          <div className="tarot-card-back__sigil-ring" />
          <div className="tarot-card-back__sigil-cross" />
          <div className="tarot-card-back__sigil-orbit" />
        </div>
        <div className="tarot-card-back__suits">
          <WandsIcon className="tarot-card-back__suit tarot-card-back__suit--wand" />
          <CupsIcon className="tarot-card-back__suit tarot-card-back__suit--cup" />
          <SwordsIcon className="tarot-card-back__suit tarot-card-back__suit--sword" />
          <PentaclesIcon className="tarot-card-back__suit tarot-card-back__suit--pentacle" />
        </div>
      </div>
    </div>
  );
}

CardBack.propTypes = {
  className: PropTypes.string,
};
