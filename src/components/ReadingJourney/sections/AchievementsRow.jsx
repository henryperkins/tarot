/**
 * AchievementsRow - Horizontal scroll of badge achievements.
 * Uses rich badge illustrations with Phosphor icon fallbacks.
 */

import { memo } from 'react';
import { Medal, Fire, Star, Trophy, Sparkle } from '@phosphor-icons/react';
import {
  FirstReadingBadge,
  TenReadingsBadge,
  FiftyReadingsBadge,
  StreakBadge,
  MasteryBadge,
} from '../../illustrations/BadgeIllustrations';

// Badge type to fallback icon mapping (when illustrations fail to load)
const BADGE_ICONS = {
  fire: Fire,
  flame: Fire,
  streak: Fire,
  star: Star,
  first_reading: Star,
  medal: Medal,
  ten_readings: Medal,
  trophy: Trophy,
  fifty_readings: Trophy,
  sparkle: Sparkle,
  mastery: Sparkle,
};

// Badge type to illustration component mapping
const BADGE_ILLUSTRATIONS = {
  star: FirstReadingBadge,
  first_reading: FirstReadingBadge,
  medal: TenReadingsBadge,
  ten_readings: TenReadingsBadge,
  trophy: FiftyReadingsBadge,
  fifty_readings: FiftyReadingsBadge,
  fire: StreakBadge,
  flame: StreakBadge,
  streak: StreakBadge,
  sparkle: MasteryBadge,
  mastery: MasteryBadge,
};

// Badge type to color mapping
const BADGE_COLORS = {
  fire: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
  flame: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
  streak: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
  star: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30',
  first_reading: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30',
  medal: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  ten_readings: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  trophy: 'text-yellow-300 bg-yellow-500/15 border-yellow-500/30',
  fifty_readings: 'text-yellow-300 bg-yellow-500/15 border-yellow-500/30',
  sparkle: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
  mastery: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
};

function getBadgeIcon(type) {
  return BADGE_ICONS[type] || Fire;
}

function getBadgeIllustration(type) {
  return BADGE_ILLUSTRATIONS[type] || null;
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
          const BadgeIllustration = getBadgeIllustration(badge.badge_type);
          const FallbackIcon = getBadgeIcon(badge.badge_type);
          const colors = getBadgeColors(badge.badge_type);
          const count = badge?.count ?? badge?.metadata?.count ?? null;
          const title = badge?.metadata?.context || badge?.card_name || 'Achievement';

          return (
            <div
              key={badge.badge_key || index}
              className={`
                flex-shrink-0 flex items-center gap-2 rounded-xl
                border px-3 py-2 min-h-[44px] ${colors}
                hover:scale-[1.02] transition-transform
              `}
              title={title}
            >
              {BadgeIllustration ? (
                <BadgeIllustration className="h-7 w-7 flex-shrink-0" />
              ) : (
                <FallbackIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium whitespace-nowrap truncate max-w-[100px]">
                  {badge.card_name || 'Badge'}
                </span>
                {typeof count === 'number' && Number.isFinite(count) && (
                  <span className="text-[10px] opacity-70">×{count} appearances</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {badges.length > 6 && (
        <p className="text-[10px] text-amber-100/50 mt-1">
          +{badges.length - 6} more achievements
        </p>
      )}
      <p className="text-[10px] text-amber-100/50 mt-1">
        Badge = card appeared 3+ times in this scope.
      </p>
    </div>
  );
}

export default memo(AchievementsRow);
