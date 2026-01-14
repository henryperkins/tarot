/**
 * AchievementsRow - Horizontal scroll of badge achievements.
 */

import { memo } from 'react';
import { Medal, Fire, Star, Trophy, Sparkle } from '@phosphor-icons/react';

// Badge type to icon mapping
const BADGE_ICONS = {
  fire: Fire,
  flame: Fire,
  streak: Fire,
  star: Star,
  medal: Medal,
  trophy: Trophy,
  sparkle: Sparkle,
};

// Badge type to color mapping
const BADGE_COLORS = {
  fire: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
  flame: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
  streak: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
  star: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30',
  medal: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  trophy: 'text-yellow-300 bg-yellow-500/15 border-yellow-500/30',
  sparkle: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
};

function getBadgeIcon(type) {
  return BADGE_ICONS[type] || Fire;
}

function getBadgeColors(type) {
  return BADGE_COLORS[type] || BADGE_COLORS.fire;
}

function AchievementsRow({ badges = [] }) {
  if (!badges.length) return null;

  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-amber-100/60 mb-2">
        <Medal className="h-3 w-3" />
        Achievements
      </p>

      <div
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-amber-200/20 scrollbar-track-transparent"
        style={{ scrollPaddingInline: '4px' }}
      >
        {badges.slice(0, 6).map((badge, index) => {
          const Icon = getBadgeIcon(badge.badge_type);
          const colors = getBadgeColors(badge.badge_type);
          const count = badge?.count ?? badge?.metadata?.count ?? null;
          const title = badge?.metadata?.context || badge?.card_name || 'Achievement';

          return (
            <div
              key={badge.badge_key || index}
              className={`
                flex-shrink-0 flex items-center gap-1.5 rounded-full
                border px-2.5 py-1.5 min-h-[32px] ${colors}
              `}
              title={title}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-xs font-medium whitespace-nowrap">
                {badge.card_name || 'Badge'}
              </span>
              {typeof count === 'number' && Number.isFinite(count) && (
                <span className="text-[10px] opacity-70">x{count}</span>
              )}
            </div>
          );
        })}
      </div>

      {badges.length > 6 && (
        <p className="text-[10px] text-amber-100/50 mt-1">
          +{badges.length - 6} more achievements
        </p>
      )}
    </div>
  );
}

export default memo(AchievementsRow);
