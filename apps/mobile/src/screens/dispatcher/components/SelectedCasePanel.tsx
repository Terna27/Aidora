import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { DispatcherCase } from '../../../types/dispatcher';

interface SelectedCasePanelProps {
  selectedCase: DispatcherCase | null;
  onDispatchNearest: (caseItem: DispatcherCase) => void;
  isDispatching?: boolean;
}

export const SelectedCasePanel: React.FC<SelectedCasePanelProps> = ({
  selectedCase,
  onDispatchNearest,
  isDispatching = false,
}) => {
  if (!selectedCase) {
    return (
      <View style={[styles.card, styles.emptyCard]}>
        <Text style={styles.emptyText}>Select an emergency to inspect details</Text>
      </View>
    );
  }

  const isCritical = selectedCase.severity === 'CRITICAL';
  const isUrgent = selectedCase.severity === 'URGENT';
  const isStable = selectedCase.severity === 'STABLE';
  const isEnRoute = selectedCase.status === 'EN_ROUTE';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Selected case</Text>
        {isCritical && (
          <View style={[styles.badge, styles.badgeCritical]}>
            <Text style={styles.badgeTextCritical}>CRITICAL</Text>
          </View>
        )}
        {isUrgent && (
          <View style={[styles.badge, styles.badgeUrgent]}>
            <Text style={styles.badgeTextUrgent}>URGENT</Text>
          </View>
        )}
        {isStable && (
          <View style={[styles.badge, styles.badgeStable]}>
            <Text style={styles.badgeTextStable}>STABLE</Text>
          </View>
        )}
      </View>

      {/* Map Preview */}
      <View style={styles.mapContainer}>
        {/* Grid pattern overlay */}
        <View style={styles.gridOverlay}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={`h-${i}`}
              style={[styles.gridLineHorizontal, { top: (i + 1) * 16 }]}
            />
          ))}
          {Array.from({ length: 18 }).map((_, i) => (
            <View
              key={`v-${i}`}
              style={[styles.gridLineVertical, { left: (i + 1) * 16 }]}
            />
          ))}
        </View>

        {/* Pulsating Location Marker */}
        <View style={styles.markerContainer}>
          <View style={styles.markerHalo} />
          <View style={styles.markerCore} />
        </View>

        {/* Live map pill badge */}
        <View style={styles.liveMapBadge}>
          <Text style={styles.liveMapText}>Live map</Text>
        </View>
      </View>

      {/* Details Grid (2 Columns) */}
      <View style={styles.detailsGrid}>
        {/* Left Column */}
        <View style={styles.detailCol}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Reported by</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {selectedCase.reportedBy}
            </Text>
          </View>
          <View style={[styles.detailItem, { marginTop: 8 }]}>
            <Text style={styles.detailLabel}>Blood group</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {selectedCase.bloodGroup}
            </Text>
          </View>
        </View>

        {/* Right Column */}
        <View style={styles.detailCol}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Awake</Text>
            <Text
              style={[
                styles.detailValue,
                !selectedCase.isAwake && styles.awakeNoValue,
              ]}
              numberOfLines={1}
            >
              {selectedCase.isAwake ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={[styles.detailItem, { marginTop: 8 }]}>
            <Text style={styles.detailLabel}>Caller note</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {selectedCase.callerNote}
            </Text>
          </View>
        </View>
      </View>

      {/* Dispatch Action Button */}
      <TouchableOpacity
        activeOpacity={0.88}
        disabled={isDispatching || isEnRoute}
        onPress={() => onDispatchNearest(selectedCase)}
        style={[
          styles.dispatchBtn,
          isEnRoute && styles.dispatchBtnEnRoute,
          isDispatching && styles.dispatchBtnLoading,
        ]}
      >
        {isDispatching ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.dispatchBtnText}>
            {isEnRoute ? selectedCase.statusLabel || 'Unit en route' : 'Dispatch nearest unit'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e7ecf0',
    borderRadius: 8,
    padding: 16,
  },
  emptyCard: {
    minHeight: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#667085',
    fontSize: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f1a2c',
    letterSpacing: -0.1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeCritical: {
    backgroundColor: '#df2b1a',
  },
  badgeTextCritical: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  badgeUrgent: {
    backgroundColor: '#ffefc9',
  },
  badgeTextUrgent: {
    color: '#7e2e0d',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  badgeStable: {
    backgroundColor: '#e8f0fd',
  },
  badgeTextStable: {
    color: '#084681',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  mapContainer: {
    height: 98,
    backgroundColor: '#edf4fc',
    borderRadius: 6,
    marginTop: 12,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1eaf5',
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#dbe7f4',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#dbe7f4',
  },
  markerContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerHalo: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(217, 45, 31, 0.22)',
  },
  markerCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#df2b1a',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  liveMapBadge: {
    position: 'absolute',
    bottom: 7,
    left: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
      : { elevation: 1 }),
  } as any,
  liveMapText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#344054',
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  detailCol: {
    width: '48%',
  },
  detailItem: {},
  detailLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#667085',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f1a2c',
    marginTop: 2,
  },
  awakeNoValue: {
    color: '#df2b1a',
    fontWeight: '700',
  },
  dispatchBtn: {
    backgroundColor: '#d92d1f',
    borderRadius: 6,
    height: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 19,
  },
  dispatchBtnEnRoute: {
    backgroundColor: '#0c1b30',
  },
  dispatchBtnLoading: {
    opacity: 0.8,
  },
  dispatchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
