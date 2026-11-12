import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DispatcherCase } from '../../../types/dispatcher';

interface EmergencyQueueTableProps {
  cases: DispatcherCase[];
  selectedCaseId: string | null;
  onSelectCase: (caseItem: DispatcherCase) => void;
  onAssignUnit: (caseItem: DispatcherCase) => void;
}

const formatWaitingTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const EmergencyQueueTable: React.FC<EmergencyQueueTableProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  onAssignUnit,
}) => {
  return (
    <View style={styles.tableCard}>
      {/* Table Header */}
      <View style={styles.headerRow}>
        <View style={styles.colSeverity}>
          <Text style={styles.headerText}>SEVERITY</Text>
        </View>
        <View style={styles.colEmergency}>
          <Text style={styles.headerText}>EMERGENCY</Text>
        </View>
        <View style={styles.colLocation}>
          <Text style={styles.headerText}>LOCATION</Text>
        </View>
        <View style={styles.colWaiting}>
          <Text style={styles.headerText}>WAITING</Text>
        </View>
        <View style={styles.colStatus}>
          <Text style={styles.headerText}>STATUS</Text>
        </View>
      </View>

      {/* Rows */}
      {cases.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No emergency cases matching criteria</Text>
        </View>
      ) : (
        cases.map((item, index) => {
          const isSelected = item.id === selectedCaseId;
          const isCritical = item.severity === 'CRITICAL';
          const isUrgent = item.severity === 'URGENT';
          const isStable = item.severity === 'STABLE';
          const isUnassigned = item.status === 'UNASSIGNED';

          // First unassigned case gets prominent red button; subsequent unassigned get outline
          const isFirstUnassigned = isUnassigned && index === 0;

          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.9}
              onPress={() => onSelectCase(item)}
              style={[
                styles.row,
                index > 0 && styles.rowBorder,
                isSelected && isCritical && styles.selectedRowCritical,
                isSelected && !isCritical && styles.selectedRowGeneric,
              ]}
            >
              {/* 1. SEVERITY */}
              <View style={styles.colSeverity}>
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

              {/* 2. EMERGENCY */}
              <View style={styles.colEmergency}>
                <Text style={styles.emergencyTitle} numberOfLines={1}>
                  {item.emergencyTitle}
                </Text>
                <Text style={styles.emergencyDesc} numberOfLines={1}>
                  {item.emergencyDescription}
                </Text>
              </View>

              {/* 3. LOCATION */}
              <View style={styles.colLocation}>
                <Text style={styles.locationText} numberOfLines={1}>
                  {item.locationArea}
                </Text>
              </View>

              {/* 4. WAITING */}
              <View style={styles.colWaiting}>
                <Text
                  style={[
                    styles.waitingText,
                    isCritical && styles.waitingCritical,
                  ]}
                >
                  {formatWaitingTime(item.elapsedSeconds)}
                </Text>
              </View>

              {/* 5. STATUS */}
              <View style={styles.colStatus}>
                {isUnassigned ? (
                  isFirstUnassigned ? (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => onAssignUnit(item)}
                      style={styles.assignBtnRed}
                    >
                      <Text style={styles.assignBtnRedText}>Assign unit</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => onAssignUnit(item)}
                      style={styles.assignBtnOutline}
                    >
                      <Text style={styles.assignBtnOutlineText}>Assign unit</Text>
                    </TouchableOpacity>
                  )
                ) : (
                  <Text style={styles.enRouteText} numberOfLines={1}>
                    {item.statusLabel || `En route · ${item.assignedUnitEtaMinutes || 6} min`}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e7ecf0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 34,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f7',
  },
  headerText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#667085',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8.5,
    minHeight: 50,
    backgroundColor: '#FFFFFF',
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#f2f4f7',
  },
  selectedRowCritical: {
    backgroundColor: '#fff5f5',
  },
  selectedRowGeneric: {
    backgroundColor: '#f8fafc',
  },
  colSeverity: {
    width: 76,
    justifyContent: 'center',
  },
  colEmergency: {
    flex: 1,
    paddingRight: 10,
  },
  colLocation: {
    width: 90,
  },
  colWaiting: {
    width: 65,
  },
  colStatus: {
    width: 102,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
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
  emergencyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f1a2c',
    letterSpacing: -0.1,
  },
  emergencyDesc: {
    fontSize: 11,
    color: '#667085',
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#101828',
  },
  waitingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#101828',
  },
  waitingCritical: {
    color: '#df2b1a',
    fontWeight: '700',
  },
  assignBtnRed: {
    backgroundColor: '#df2b1d',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignBtnRedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  assignBtnOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 6,
    paddingVertical: 4.5,
    paddingHorizontal: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignBtnOutlineText: {
    color: '#344054',
    fontSize: 11,
    fontWeight: '600',
  },
  enRouteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#064884',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#667085',
    fontSize: 12,
  },
});
