/**
 * RideRoute Accessible Design Tokens - Colors
 *
 * Implements a modern healthcare technology aesthetic:
 * - Deep medical blue as primary brand color for trust and clinical authority.
 * - Emergency crimson for urgent maternal SOS actions.
 * - Soft emerald for verified and completed states.
 * - Warm amber for pending actions and caution notices.
 * - Elegant neutral surfaces with high contrast and readable text.
 */

export const colors = {
  // Primary Brand - Deep Medical Blue
  healthcare: {
    primary: '#0D5C96',      // Deep clinical medical blue
    dark: '#083B64',         // Deep navy
    light: '#EFF6FC',        // Gentle ice-blue surface tint
    border: '#BAE0FD',       // Crisp clinical border
    glow: 'rgba(13, 92, 150, 0.25)',
  },

  // Emergency Crimson / Coral (For SOS buttons and life-critical actions)
  emergency: {
    primary: '#D92D20',      // High-visibility emergency crimson
    dark: '#B42318',         // Deep crimson
    light: '#FEF3F2',        // Soft emergency alert tint
    border: '#FECDCA',       // Coral border
    glow: 'rgba(217, 45, 32, 0.35)',
  },

  // Semantic Status & Feedback
  semantic: {
    // Soft Emerald (Success, verified, arrivals)
    emerald: '#059669',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',

    // Warm Amber (Pending, awaiting confirmation, warnings)
    amber: '#D97706',
    amberBg: '#FFFBEB',
    amberBorder: '#FDE68A',

    // Clinical Blue (Accepted, active milestones)
    blue: '#2563EB',
    blueBg: '#EFF6FF',
    blueBorder: '#BFDBFE',

    // Purple (Patient onboard, hospital confirmed)
    purple: '#7C3AED',
    purpleBg: '#F5F3FF',
    purpleBorder: '#DDD6FE',

    // Slate / Neutral (Offline, cancelled, default)
    slate: '#475569',
    slateBg: '#F1F5F9',
    slateBorder: '#E2E8F0',

    // Red (Error, expired, crisis)
    red: '#DC2626',
    redBg: '#FEF2F2',
    redBorder: '#FECACA',
  },

  // Neutral Palette & Surfaces
  neutral: {
    white: '#FFFFFF',
    background: '#F8FAFC',   // Subtle slate-tinted canvas
    surface: '#FFFFFF',      // Pure white cards
    surfaceAlt: '#F1F5F9',   // Light gray fill
    border: '#E2E8F0',       // Subtle border
    borderStrong: '#CBD5E1', // Focused / prominent border
    textPrimary: '#0F172A',  // Slate 900 for high-contrast readability
    textSecondary: '#475569',// Slate 600 for body copy
    textMuted: '#94A3B8',    // Slate 400 for helper labels
  },

  // Dispatcher Dashboard Theme Tokens (Pixel-matched to Aidline specification)
  dispatcher: {
    sidebarBg: '#0f1a2c',
    sidebarActiveBg: '#1b2940',
    sidebarUserBg: '#17263d',
    sidebarAvatarBg: '#2d405d',
    sidebarTextMuted: '#8e9aa8',
    workspaceBg: '#f6f7fb',
    cardBorder: '#e7ecf0',
    textNavy: '#0f1a2c',
    textMuted: '#667085',
    textSecondary: '#344054',
    badgeDispatch: '#175cd3',
    badgeCritical: '#df2b1a',
    badgeUrgentBg: '#ffefc9',
    badgeUrgentText: '#7e2e0d',
    badgeStableBg: '#e8f0fd',
    badgeStableText: '#084681',
    statCritical: '#b22710',
    statUrgent: '#9a3507',
    statEnRoute: '#0c1b30',
    statAvailable: '#006339',
    btnAssignRed: '#df2b1d',
    btnDispatchRed: '#d92d1f',
    unitAvailable: '#12b76a',
    unitReturning: '#f79009',
    enRouteText: '#064884',
    mapGrid: '#edf4fc',
    mapGridLine: '#dbe7f4',
    selectedRowBg: '#fff5f5',
  },

  // Safety & Warning Disclaimer
  safety: {
    bannerBg: '#FEF3C7',
    bannerBorder: '#F59E0B',
    bannerText: '#92400E',
  },

  // Refined Shadow Tokens
  shadows: {
    sm: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    card: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    prominent: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 14,
      elevation: 4,
    },
    sosGlow: {
      shadowColor: '#D92D20',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.38,
      shadowRadius: 20,
      elevation: 8,
    },
  },
};
