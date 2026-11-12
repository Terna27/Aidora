import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { SearchIcon } from './Icons';

interface DispatcherHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewCasePress: () => void;
}

export const DispatcherHeader: React.FC<DispatcherHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onNewCasePress,
}) => {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.titleSection}>
        <Text style={styles.title}>Live queue</Text>
        <Text style={styles.subtitle}>Sorted by severity, then waiting time</Text>
      </View>

      <View style={styles.controlsSection}>
        {/* Search input */}
        <View style={styles.searchBox}>
          <SearchIcon size={14} color="#667085" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search cases"
            placeholderTextColor="#667085"
            value={searchQuery}
            onChangeText={onSearchChange}
            clearButtonMode="while-editing"
          />
        </View>

        {/* + New case button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onNewCasePress}
          style={styles.newCaseBtn}
        >
          <Text style={styles.newCaseBtnText}>+ New case</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleSection: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f1a2c',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#667085',
    marginTop: 2,
    fontWeight: '400',
  },
  controlsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 6,
    height: 32,
    paddingHorizontal: 9,
    width: 144,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#101828',
    marginLeft: 6,
    paddingVertical: 0,
    outlineWidth: 0, // for React Native Web
  } as any,
  newCaseBtn: {
    backgroundColor: '#0f1a2c',
    borderRadius: 6,
    height: 32,
    paddingHorizontal: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newCaseBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
