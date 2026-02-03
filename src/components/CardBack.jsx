import { WandsIcon, CupsIcon, SwordsIcon, PentaclesIcon } from './illustrations/SuitIcons';

export function CardBack({ className = '' }) {
  return (
    <div className={`tarot-card-back ${className}`} aria-hidden="true">
      <div className="tarot-card-back__frame" aria-hidden="true" />
      <div className="tarot-card-back__inner">
        <div className="tarot-card-back__sigil">
          <div className="tarot-card-back__sigil-ring" />
          <div className="tarot-card-back__sigil-cross" />
          <div className="tarot-card-back__sigil-orbit" />
        </div>
        <div className="tarot-card-back__suits" aria-hidden="true">
          <WandsIcon className="tarot-card-back__suit tarot-card-back__suit--wand" />
          <CupsIcon className="tarot-card-back__suit tarot-card-back__suit--cup" />
          <SwordsIcon className="tarot-card-back__suit tarot-card-back__suit--sword" />
          <PentaclesIcon className="tarot-card-back__suit tarot-card-back__suit--pentacle" />
        </div>
      </div>
    </div>
  );
}
