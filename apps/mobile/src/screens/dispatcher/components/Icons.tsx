import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

interface IconProps {
  size?: number;
  color?: string;
}

export const AidlineLogo: React.FC<{ size?: number }> = ({ size = 24 }) => {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <rect width="24" height="24" rx="5" fill="#df2b1a" />
        <path
          d="M12 7V17M7 12H17"
          stroke="#FFFFFF"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Native fallback
  return (
    <View style={[styles.logoNative, { width: size, height: size }]}>
      <View style={[styles.crossVertical, { height: size * 0.55, width: 2.5 }]} />
      <View style={[styles.crossHorizontal, { width: size * 0.55, height: 2.5 }]} />
    </View>
  );
};

export const PulseIcon: React.FC<IconProps> = ({ size = 16, color = '#FFFFFF' }) => {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    );
  }
  return <View style={{ width: size, height: size, backgroundColor: color, borderRadius: size / 2 }} />;
};

export const MapPinIcon: React.FC<IconProps> = ({ size = 16, color = '#8e9aa8' }) => {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    );
  }
  return <View style={{ width: size, height: size, backgroundColor: color }} />;
};

export const UnitsIcon: React.FC<IconProps> = ({ size = 16, color = '#8e9aa8' }) => {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
      </svg>
    );
  }
  return <View style={{ width: size, height: size, backgroundColor: color }} />;
};

export const HistoryIcon: React.FC<IconProps> = ({ size = 16, color = '#8e9aa8' }) => {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }
  return <View style={{ width: size, height: size, backgroundColor: color }} />;
};

export const SearchIcon: React.FC<IconProps> = ({ size = 14, color = '#667085' }) => {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    );
  }
  return <View style={{ width: size, height: size, backgroundColor: color }} />;
};

export const PlusIcon: React.FC<IconProps> = ({ size = 14, color = '#FFFFFF' }) => {
  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    );
  }
  return <View style={{ width: size, height: size, backgroundColor: color }} />;
};

const styles = StyleSheet.create({
  logoNative: {
    backgroundColor: '#df2b1a',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossVertical: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  crossHorizontal: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
});
