/**
 * Centralized Icon Registry
 *
 * Import commonly used Phosphor icons once here, then re-export for use throughout the app.
 * This provides a single source of truth for which icons are used and makes it easier to
 * swap icons or track usage.
 *
 * Usage:
 * import { Sparkle, Check, Info } from './components/icons';
 * import { Icon, ICON_SIZES } from './components/Icon';
 *
 * <Icon icon={Sparkle} size={ICON_SIZES.md} label="Generate" />
 */

// Navigation & Actions
export {
  ArrowLeft,
  ArrowRight,
  ArrowCounterClockwise,
  ArrowsClockwise,
  ArrowsOut,
  CaretLeft,
  CaretRight,
  CaretDown,
  CaretUp,
  X,
} from '@phosphor-icons/react';

// UI Elements
export {
  Check,
  Info,
  Question,
  Gear,
  UploadSimple,
  DownloadSimple,
} from '@phosphor-icons/react';

// Content & Features
export {
  Sparkle,
  Star,
  Eye,
  Path,
  Heart,
  Compass,
  Lightning,
  BookOpen,
  BookmarkSimple,
  ClipboardText,
  FileText,
  ChartBar,
  ChartLine,
} from '@phosphor-icons/react';

// Media & Audio
export {
  SpeakerHigh,
  SpeakerSlash,
  MusicNotes,
  Sun,
  Moon,
} from '@phosphor-icons/react';

// Layout & Organization
export {
  GridFour,
  Stack,
} from '@phosphor-icons/react';

// Social & Sharing
export {
  ShareNetwork,
  Copy,
} from '@phosphor-icons/react';

// User & Auth
export {
  SignIn,
  SignOut,
  User,
} from '@phosphor-icons/react';

// Actions & Operations
export {
  Trash,
  Scissors,
  MagicWand,
  ClockCounterClockwise,
} from '@phosphor-icons/react';

// Data & Charts
export {
  TrendUp,
  Medal,
  Fire,
} from '@phosphor-icons/react';

/**
 * Icon Usage Patterns by Context
 *
 * Standard patterns to follow for consistency:
 *
 * 1. DECORATIVE ICONS (inline with text)
 *    <Icon icon={Sparkle} size="sm" decorative />
 *
 * 2. INTERACTIVE ICONS (buttons, clickable)
 *    <Icon icon={Check} size="md" label="Confirm selection" />
 *
 * 3. STATUS ICONS (indicate state)
 *    <Icon icon={Check} size="md" weight="bold" decorative />
 *
 * 4. NAVIGATION ICONS
 *    <Icon icon={ArrowLeft} size="lg" label="Go back" />
 *
 * 5. FEATURE ICONS (section headers)
 *    <Icon icon={Sparkle} size="xl" weight="bold" decorative />
 */
