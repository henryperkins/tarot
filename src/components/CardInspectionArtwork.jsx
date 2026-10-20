import { useEffect, useState } from 'react';
import { FALLBACK_IMAGE, getCardImage, getCardPreviewImage } from '../lib/cardLookup';

/** Mount with a per-card key: an old scan must never illustrate a new name. */
export function CardInspectionArtwork({ card, frame, full = false, children, ...touchHandlers }) {
  const scan = getCardImage(card);
  const preview = getCardPreviewImage(card);
  const [source, setSource] = useState(preview);
  const [failed, setFailed] = useState(false);
  const [width, height] = frame.split('/').map(Number);
  const ratio = width > 0 && height > 0 ? width / height : 100 / 172;

  useEffect(() => {
    if (preview === scan) return undefined;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      setSource(scan);
      setFailed(false);
    };
    image.src = scan;
    return () => { active = false; image.onload = null; };
  }, [preview, scan]);

  return <div className="card-inspector__artwork-group">
    <div
      data-reading-full-artwork={full ? 'true' : undefined}
      className={`card-inspector__artwork${full ? ' card-inspector__artwork--full' : ''}`}
      style={{ '--card-art-ratio': ratio }}
      {...touchHandlers}
    >
      <img
        src={source}
        alt={card.name}
        width={360}
        height={Math.round(360 / ratio)}
        className={card.isReversed ? 'card-inspector__image--reversed' : undefined}
        loading="eager"
        decoding="async"
        draggable={false}
        onError={() => {
          if (source === FALLBACK_IMAGE) return;
          setFailed(true);
          setSource(FALLBACK_IMAGE);
        }}
      />
      {children && <div className={`absolute inset-0${card.isReversed ? ' rotate-180' : ''}`}>{children}</div>}
    </div>
    {failed && <p role="status" className="card-inspector__artwork-status">Artwork unavailable. The card details are still here.</p>}
  </div>;
}
