import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { DispatcherSidebar, DispatcherNavTab } from './components/DispatcherSidebar';
import { DispatcherHeader } from './components/DispatcherHeader';
import { StatCardsRow } from './components/StatCardsRow';
import { EmergencyQueueTable } from './components/EmergencyQueueTable';
import { SelectedCasePanel } from './components/SelectedCasePanel';
import { NearestUnitsPanel } from './components/NearestUnitsPanel';
import { NewCaseModal } from './components/NewCaseModal';
import {
  DispatcherCase,
  DispatcherUnit,
  DispatcherStats,
  DispatcherProfile,
  NewCasePayload,
} from '../../types/dispatcher';
import { serviceRegistry } from '../../services/serviceRegistry';

interface DispatcherDashboardScreenProps {
  onSwitchToPatientPortal?: () => void;
  onSwitchToResponderPortal?: () => void;
}

export const DispatcherDashboardScreen: React.FC<DispatcherDashboardScreenProps> = ({
  onSwitchToPatientPortal,
  onSwitchToResponderPortal,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = windowWidth >= 960;

  const [activeTab, setActiveTab] = useState<DispatcherNavTab>('queue');
  const [cases, setCases] = useState<DispatcherCase[]>([]);
  const [units, setUnits] = useState<DispatcherUnit[]>([]);
  const [stats, setStats] = useState<DispatcherStats>({
    criticalWaiting: 1,
    urgentWaiting: 2,
    unitsEnRoute: 3,
    unitsAvailable: 5,
  });
  const [profile, setProfile] = useState<DispatcherProfile>({
    id: 'disp-401',
    name: 'N. Eze',
    initials: 'NE',
    role: 'Lead Emergency Dispatcher',
    shiftStatus: 'On shift',
  });
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // Load initial data
  const loadDashboardData = useCallback(async () => {
    try {
      const [fetchedCases, fetchedUnits, fetchedStats, fetchedProfile] =
        await Promise.all([
          serviceRegistry.dispatcherService.getCases(searchQuery),
          serviceRegistry.dispatcherService.getNearestUnits(3),
          serviceRegistry.dispatcherService.getStats(),
          serviceRegistry.dispatcherService.getProfile(),
        ]);

      setCases(fetchedCases);
      setUnits(fetchedUnits);
      setStats(fetchedStats);
      setProfile(fetchedProfile);

      // Default select the first case if none is selected
      if (!selectedCaseId && fetchedCases.length > 0) {
        setSelectedCaseId(fetchedCases[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load dispatcher dashboard data:', err);
    }
  }, [searchQuery, selectedCaseId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle case selection
  const handleSelectCase = (caseItem: DispatcherCase) => {
    setSelectedCaseId(caseItem.id);
  };

  // Handle unit dispatch
  const handleDispatchNearest = async (caseItem: DispatcherCase) => {
    setIsDispatching(true);
    setFeedbackMessage(null);
    try {
      const result = await serviceRegistry.dispatcherService.assignNearestUnit(caseItem.id);
      setFeedbackMessage({
        text: `Unit ${result.unit.name} dispatched to ${result.case.emergencyTitle} (${result.case.locationArea}). ETA: ${result.unit.distanceLabel}`,
        type: 'success',
      });
      await loadDashboardData();
    } catch (err: any) {
      setFeedbackMessage({
        text: err?.message || 'Failed to dispatch unit. Please retry.',
        type: 'error',
      });
    } finally {
      setIsDispatching(false);
    }
  };

  // Handle creating a new emergency case
  const handleCreateNewCase = async (payload: NewCasePayload) => {
    try {
      const created = await serviceRegistry.dispatcherService.createNewCase(payload);
      setSelectedCaseId(created.id);
      setFeedbackMessage({
        text: `New case #${created.id} (${created.emergencyTitle}) added to live queue.`,
        type: 'success',
      });
      await loadDashboardData();
    } catch (err: any) {
      setFeedbackMessage({
        text: err?.message || 'Failed to create emergency case.',
        type: 'error',
      });
    }
  };

  const selectedCase = cases.find((c) => c.id === selectedCaseId) || cases[0] || null;
  const pendingQueueCount = cases.length > 0 ? cases.length : 4;

  return (
    <View style={styles.rootContainer}>
      {/* 1. Left Sidebar (Fixed 163px) */}
      <DispatcherSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingCount={pendingQueueCount}
        dispatcherName={profile.name}
        dispatcherInitials={profile.initials}
        shiftStatus={profile.shiftStatus}
      />

      {/* 2. Main Workspace */}
      <View style={styles.workspace}>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Feedback Banner */}
          {feedbackMessage && (
            <View
              style={[
                styles.feedbackBanner,
                feedbackMessage.type === 'success'
                  ? styles.feedbackSuccess
                  : styles.feedbackError,
              ]}
            >
              <Text
                style={[
                  styles.feedbackText,
                  feedbackMessage.type === 'success'
                    ? styles.feedbackSuccessText
                    : styles.feedbackErrorText,
                ]}
              >
                {feedbackMessage.text}
              </Text>
            </View>
          )}

          {activeTab === 'queue' ? (
            <>
              {/* Header */}
              <DispatcherHeader
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onNewCasePress={() => setIsNewCaseModalOpen(true)}
              />

              {/* 4 Summary Stat Cards */}
              <StatCardsRow stats={stats} />

              {/* 2-Column Content Area */}
              <View
                style={[
                  styles.contentRow,
                  !isDesktop && styles.contentRowStacked,
                ]}
              >
                {/* Left Column: Emergency Queue Table */}
                <View
                  style={[
                    styles.leftColumn,
                    isDesktop ? { width: 517 } : { width: '100%' },
                  ]}
                >
                  <EmergencyQueueTable
                    cases={cases}
                    selectedCaseId={selectedCaseId}
                    onSelectCase={handleSelectCase}
                    onAssignUnit={handleDispatchNearest}
                  />
                </View>

                {/* Right Column: Selected Case & Nearest Available Panels */}
                <View
                  style={[
                    styles.rightColumn,
                    isDesktop ? { width: 323 } : { width: '100%', marginTop: 16 },
                  ]}
                >
                  <SelectedCasePanel
                    selectedCase={selectedCase}
                    onDispatchNearest={handleDispatchNearest}
                    isDispatching={isDispatching}
                  />
                  <NearestUnitsPanel units={units} />
                </View>
              </View>
            </>
          ) : (
            /* Subviews for Map, Units, History */
            <View style={styles.placeholderTabContainer}>
              <Text style={styles.placeholderTitle}>
                {activeTab === 'map' && 'Live Incident & Unit Map'}
                {activeTab === 'units' && 'Fleet & Vehicle Operations'}
                {activeTab === 'history' && 'Emergency Dispatch Audit History'}
              </Text>
              <Text style={styles.placeholderSubtitle}>
                {activeTab === 'map' &&
                  'Real-time geographic positions of verified ambulances, motor medics, and commercial transport responders.'}
                {activeTab === 'units' &&
                  'Overview of all 8 fleet units: status, maintenance records, and sector assignments.'}
                {activeTab === 'history' &&
                  'Complete immutable log of all resolved and transferred emergency incidents.'}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* New Case Creation Modal */}
      <NewCaseModal
        visible={isNewCaseModalOpen}
        onClose={() => setIsNewCaseModalOpen(false)}
        onSubmit={handleCreateNewCase}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0f1a2c',
    width: '100%',
    height: '100%',
    minHeight: Platform.OS === 'web' ? ('100vh' as any) : '100%',
    overflow: 'hidden',
  },
  workspace: {
    flex: 1,
    backgroundColor: '#f6f7fb',
    height: '100%',
    minHeight: Platform.OS === 'web' ? ('100vh' as any) : '100%',
  },
  scrollArea: {
    flex: 1,
    height: '100%',
  },
  scrollContent: {
    paddingLeft: 26,
    paddingRight: 22,
    paddingTop: 26,
    paddingBottom: 26,
    minHeight: Platform.OS === 'web' ? ('100vh' as any) : '100%',
  },
  contentRow: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'flex-start',
  },
  contentRowStacked: {
    flexDirection: 'column',
  },
  leftColumn: {
    flexShrink: 0,
  },
  rightColumn: {
    flexShrink: 0,
  },
  feedbackBanner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 14,
  },
  feedbackSuccess: {
    backgroundColor: '#ecfdf3',
    borderWidth: 1,
    borderColor: '#a6f4c5',
  },
  feedbackError: {
    backgroundColor: '#fef3f2',
    borderWidth: 1,
    borderColor: '#fecdca',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '500',
  },
  feedbackSuccessText: {
    color: '#027a48',
  },
  feedbackErrorText: {
    color: '#b42318',
  },
  placeholderTabContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e7ecf0',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f1a2c',
    marginBottom: 8,
  },
  placeholderSubtitle: {
    fontSize: 13,
    color: '#667085',
    textAlign: 'center',
    maxWidth: 500,
  },
});
