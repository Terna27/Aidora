import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { DispatcherDashboardScreen } from '../screens/dispatcher/DispatcherDashboardScreen';

interface DispatcherNavigatorProps {
  onSwitchToPatientPortal?: () => void;
  onSwitchToResponderPortal?: () => void;
}

export const DispatcherNavigator: React.FC<DispatcherNavigatorProps> = ({
  onSwitchToPatientPortal,
  onSwitchToResponderPortal,
}) => {
  return (
    <View style={styles.container}>
      <DispatcherDashboardScreen
        onSwitchToPatientPortal={onSwitchToPatientPortal}
        onSwitchToResponderPortal={onSwitchToResponderPortal}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  portalBar: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 26, 44, 0.85)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 8,
    zIndex: 9999,
  },
  portalBarLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '500',
  },
  portalBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  portalBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
});
