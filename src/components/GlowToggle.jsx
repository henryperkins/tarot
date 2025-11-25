import { useState, useEffect, useRef } from 'react';

/**
 * GlowToggle - A clean toggle switch with subtle glow feedback on state change
 */
export function GlowToggle({
  checked,
  onChange,
  disabled = false,
  label,
  labelId,
  describedBy
}) {
  const [glowing, setGlowing] = useState(false);
  const isFirstRender = useRef(true);
  const prevChecked = useRef(checked);

  // Trigger glow animation on state change (not on initial render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevChecked.current = checked;
      return;
    }

    if (prevChecked.current !== checked) {
      prevChecked.current = checked;
    }
  }, [checked]);

  // Handle glow timeout separately
  useEffect(() => {
    if (!glowing) return;
    const timer = setTimeout(() => setGlowing(false), 400);
    return () => clearTimeout(timer);
  }, [glowing]);

  const handleToggle = () => {
    if (disabled) return;
    setGlowing(true);
    onChange(!checked);
  };

  // Track: 44x24 for good mobile touch target and visibility
  // Thumb: 20x20 centered vertically with 2px padding
  const trackWidth = 44;
  const trackHeight = 24;
  const thumbSize = 20;
  const thumbTravel = trackWidth - thumbSize - 4; // 4px total padding (2px each side)

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={labelId ? undefined : label}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={handleToggle}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: trackWidth,
        height: trackHeight,
        padding: 0,
        border: 'none',
        background: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      {/* Track */}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: trackHeight / 2,
          backgroundColor: checked ? 'rgba(168, 162, 158, 0.4)' : 'rgba(30, 28, 26, 0.8)',
          border: checked ? '1.5px solid rgba(168, 162, 158, 0.7)' : '1.5px solid rgba(168, 162, 158, 0.3)',
          transition: 'all 200ms ease-out',
          boxShadow: glowing
            ? checked
              ? '0 0 12px 3px rgba(212, 184, 150, 0.5)'
              : '0 0 8px 2px rgba(168, 162, 158, 0.3)'
            : 'none',
        }}
        aria-hidden="true"
      />
      {/* Thumb */}
      <span
        style={{
          position: 'absolute',
          left: 2,
          width: thumbSize,
          height: thumbSize,
          borderRadius: '50%',
          backgroundColor: checked ? '#d4b896' : 'rgba(168, 162, 158, 0.6)',
          transform: `translateX(${checked ? thumbTravel : 0}px) scale(${glowing ? 1.1 : 1})`,
          transition: 'all 200ms ease-out',
          boxShadow: checked
            ? '0 2px 8px rgba(212, 184, 150, 0.5)'
            : '0 1px 3px rgba(0, 0, 0, 0.3)',
        }}
        aria-hidden="true"
      />
    </button>
  );
}
