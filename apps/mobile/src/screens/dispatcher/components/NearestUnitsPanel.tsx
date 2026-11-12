import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DispatcherUnit } from '../../../types/dispatcher';

interface NearestUnitsPanelProps {
  units: DispatcherUnit[];
}

export const NearestUnitsPanel: React.FC<NearestUnitsPanelProps> = ({ units }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Nearest available</Text>

      <View style={styles.unitList}>
        {units.map((unit) => {
          const isAvailable = unit.operationalStatus === 'AVAILABLE';
          const isReturning = unit.operationalStatus === 'RETURNING';

          return (
            <View key={unit.id} style={styles.unitRow}>
              <View style={styles.unitLeft}>
                <View
                  style={[
                    styles.statusDot,
                    isAvailable && styles.dotAvailable,
                    isReturning && styles.dotReturning,
                    !isAvailable && !isReturning && styles.dotBusy,
                  ]}
                />
                <Text style={styles.unitName} numberOfLines={1}>
                  {unit.name}
                </Text>
              </View>

              <Text style={styles.distanceText}>
                {unit.distanceLabel || (unit.distanceKm ? `${unit.distanceKm} km` : '[x] km')}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e7ecf0',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f1a2c',
    marginBottom: 10,
    letterSpacing: -0.1,
  },
  unitList: {
    gap: 7,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  dotAvailable: {
    backgroundColor: '#12b76a',
  },
  dotReturning: {
    backgroundColor: '#f79009',
  },
  dotBusy: {
    backgroundColor: '#667085',
  },
  unitName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f1a2c',
  },
  distanceText: {
    fontSize: 11,
    color: '#667085',
    fontWeight: '500',
  },
});
