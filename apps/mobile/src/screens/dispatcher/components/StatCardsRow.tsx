import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DispatcherStats } from '../../../types/dispatcher';

interface StatCardsRowProps {
  stats: DispatcherStats;
}

export const StatCardsRow: React.FC<StatCardsRowProps> = ({ stats }) => {
  return (
    <View style={styles.container}>
      {/* 1. Critical waiting */}
      <View style={styles.card}>
        <Text style={styles.label}>Critical waiting</Text>
        <Text style={[styles.value, styles.criticalValue]}>{stats.criticalWaiting}</Text>
      </View>

      {/* 2. Urgent waiting */}
      <View style={styles.card}>
        <Text style={styles.label}>Urgent waiting</Text>
        <Text style={[styles.value, styles.urgentValue]}>{stats.urgentWaiting}</Text>
      </View>

      {/* 3. Units en route */}
      <View style={styles.card}>
        <Text style={styles.label}>Units en route</Text>
        <Text style={[styles.value, styles.enRouteValue]}>{stats.unitsEnRoute}</Text>
      </View>

      {/* 4. Units available */}
      <View style={styles.card}>
        <Text style={styles.label}>Units available</Text>
        <Text style={[styles.value, styles.availableValue]}>{stats.unitsAvailable}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 18,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e7ecf0',
    borderRadius: 8,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    height: 78,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: '#667085',
    letterSpacing: 0.1,
  },
  value: {
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
  },
  criticalValue: {
    color: '#b22710',
  },
  urgentValue: {
    color: '#9a3507',
  },
  enRouteValue: {
    color: '#0c1b30',
  },
  availableValue: {
    color: '#006339',
  },
});
