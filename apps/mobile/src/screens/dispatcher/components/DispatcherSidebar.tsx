import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import {
  AidlineLogo,
  PulseIcon,
  MapPinIcon,
  UnitsIcon,
  HistoryIcon,
} from './Icons';

export type DispatcherNavTab = 'queue' | 'map' | 'units' | 'history';

interface DispatcherSidebarProps {
  activeTab: DispatcherNavTab;
  onSelectTab: (tab: DispatcherNavTab) => void;
  pendingCount?: number;
  dispatcherName?: string;
  dispatcherInitials?: string;
  shiftStatus?: string;
}

export const DispatcherSidebar: React.FC<DispatcherSidebarProps> = ({
  activeTab,
  onSelectTab,
  pendingCount = 4,
  dispatcherName = 'N. Eze',
  dispatcherInitials = 'NE',
  shiftStatus = 'On shift',
}) => {
  return (
    <View style={styles.sidebar}>
      {/* Brand Header */}
      <View style={styles.brandContainer}>
        <AidlineLogo size={22} />
        <Text style={styles.brandText}>Aidline</Text>
        <View style={styles.dispatchBadge}>
          <Text style={styles.dispatchBadgeText}>DISPATCH</Text>
        </View>
      </View>

      {/* Navigation Menu */}
      <View style={styles.navMenu}>
        {/* Live queue item */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onSelectTab('queue')}
          style={[styles.navItem, activeTab === 'queue' && styles.navItemActive]}
        >
          <View style={styles.navItemLeft}>
            <PulseIcon size={16} color={activeTab === 'queue' ? '#FFFFFF' : '#8e9aa8'} />
            <Text
              style={[
                styles.navItemText,
                activeTab === 'queue' ? styles.navItemTextActive : styles.navItemTextInactive,
              ]}
            >
              Live queue
            </Text>
          </View>
          {pendingCount > 0 && (
            <View style={styles.counterBadge}>
              <Text style={styles.counterBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Map item */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onSelectTab('map')}
          style={[styles.navItem, activeTab === 'map' && styles.navItemActive]}
        >
          <View style={styles.navItemLeft}>
            <MapPinIcon size={16} color={activeTab === 'map' ? '#FFFFFF' : '#8e9aa8'} />
            <Text
              style={[
                styles.navItemText,
                activeTab === 'map' ? styles.navItemTextActive : styles.navItemTextInactive,
              ]}
            >
              Map
            </Text>
          </View>
        </TouchableOpacity>

        {/* Units item */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onSelectTab('units')}
          style={[styles.navItem, activeTab === 'units' && styles.navItemActive]}
        >
          <View style={styles.navItemLeft}>
            <UnitsIcon size={16} color={activeTab === 'units' ? '#FFFFFF' : '#8e9aa8'} />
            <Text
              style={[
                styles.navItemText,
                activeTab === 'units' ? styles.navItemTextActive : styles.navItemTextInactive,
              ]}
            >
              Units
            </Text>
          </View>
        </TouchableOpacity>

        {/* History item */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onSelectTab('history')}
          style={[styles.navItem, activeTab === 'history' && styles.navItemActive]}
        >
          <View style={styles.navItemLeft}>
            <HistoryIcon size={16} color={activeTab === 'history' ? '#FFFFFF' : '#8e9aa8'} />
            <Text
              style={[
                styles.navItemText,
                activeTab === 'history' ? styles.navItemTextActive : styles.navItemTextInactive,
              ]}
            >
              History
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Dispatcher Profile at bottom */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{dispatcherInitials}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName} numberOfLines={1}>
            {dispatcherName}
          </Text>
          <Text style={styles.profileShift}>{shiftStatus}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 163,
    backgroundColor: '#0f1a2c',
    height: '100%',
    minHeight: Platform.OS === 'web' ? ('100vh' as any) : '100%',
    paddingTop: 18,
    paddingHorizontal: 10,
    justifyContent: 'flex-start',
    position: 'relative',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.05)',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: -0.2,
  },
  dispatchBadge: {
    backgroundColor: '#175cd3',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 3,
    marginLeft: 6,
  },
  dispatchBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  navMenu: {
    gap: 3,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  navItemActive: {
    backgroundColor: '#1b2940',
  },
  navItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navItemText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
  },
  navItemTextActive: {
    color: '#FFFFFF',
  },
  navItemTextInactive: {
    color: '#8e9aa8',
  },
  counterBadge: {
    backgroundColor: '#df2b1a',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  counterBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  profileCard: {
    position: 'absolute',
    bottom: 16,
    left: 10,
    right: 10,
    backgroundColor: '#17263d',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2d405d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  profileInfo: {
    marginLeft: 8,
    flex: 1,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
  },
  profileShift: {
    color: '#12b76a',
    fontSize: 10.5,
    fontWeight: '500',
    lineHeight: 14,
  },
});
