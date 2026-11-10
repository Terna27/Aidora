import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../../theme';
import { Header } from '../../../components/common/Header';
import { Card } from '../../../components/common/Card';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { EmergencyRequest } from '../../../types/emergency';
import { serviceRegistry } from '../../../services/serviceRegistry';
import { useAuth } from '../../../context/AuthContext';

interface EmergencyHistoryScreenProps {
  onBack: () => void;
}

export const EmergencyHistoryScreen: React.FC<EmergencyHistoryScreenProps> = ({
  onBack,
}) => {
  const { patient } = useAuth();
  const [history, setHistory] = useState<EmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (patient) {
        setLoading(true);
        const records = await serviceRegistry.emergencyService.getEmergencyHistory(patient.id);
        setHistory(records);
        setLoading(false);
      }
    })();
  }, [patient]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <View style={styles.screen}>
      <Header title="Emergency Journey History" onBack={onBack} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerIntro}>
          <Text style={styles.title}>Your Transportation Records</Text>
          <Text style={styles.subtitle}>
            Archived logs of maternal emergency dispatches, responders, and healthcare arrivals.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.healthcare.primary} />
            <Text style={styles.loadingText}>Retrieving journey history...</Text>
          </View>
        ) : history.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Emergency Records Yet</Text>
            <Text style={styles.emptySubtitle}>
              You have not submitted any emergency ride requests. When an emergency is dispatched, complete audit logs will appear here.
            </Text>
          </Card>
        ) : (
          history.map((item) => {
            const isExpanded = expandedId === item.id;
            const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            const timeStr = new Date(item.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => toggleExpand(item.id)}
                activeOpacity={0.8}
              >
                <Card style={styles.historyCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.dateBlock}>
                      <Text style={styles.dateText}>{dateStr}</Text>
                      <Text style={styles.timeText}>{timeStr} • ID: {item.id}</Text>
                    </View>
                    <StatusBadge state={item.status} />
                  </View>

                  <View style={styles.summarySection}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryIcon}>📍</Text>
                      <View style={styles.summaryContent}>
                        <Text style={styles.summaryLabel}>PICKUP LOCATION</Text>
                        <Text style={styles.summaryValue}>
                          {item.location.villageCommunity || 'Area not specified'}
                          {item.location.landmark ? ` (Near: ${item.location.landmark})` : ''}
                        </Text>
                      </View>
                    </View>

                    {item.destinationFacility ? (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryIcon}>🏥</Text>
                        <View style={styles.summaryContent}>
                          <Text style={styles.summaryLabel}>DESTINATION CLINIC</Text>
                          <Text style={styles.summaryValue}>
                            {item.destinationFacility.name} ({item.destinationFacility.community})
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    {item.assignedResponder ? (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryIcon}>
                          {item.assignedResponder.vehicleType === 'MOTORCYCLE' ? '🏍️' : '🚕'}
                        </Text>
                        <View style={styles.summaryContent}>
                          <Text style={styles.summaryLabel}>ASSIGNED DRIVER</Text>
                          <Text style={styles.summaryValue}>
                            {item.assignedResponder.fullName} ({item.assignedResponder.vehicleModel} • {item.assignedResponder.licensePlate})
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/* EXPANDABLE MILESTONE TIMELINE */}
                  {isExpanded && item.history && item.history.length > 0 ? (
                    <View style={styles.timelineSection}>
                      <Text style={styles.timelineHeading}>DISPATCH AUDIT TRAIL</Text>
                      {item.history.map((step, idx) => (
                        <View key={idx} style={styles.timelineItem}>
                          <View style={styles.timelineDot} />
                          <View style={styles.timelineContent}>
                            <Text style={styles.timelineState}>{step.state}</Text>
                            <Text style={styles.timelineTime}>
                              {new Date(step.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </Text>
                            {step.note ? (
                              <Text style={styles.timelineNote}>{step.note}</Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <Text style={styles.expandPrompt}>
                    {isExpanded ? '▲ Hide dispatch details' : '▼ View dispatch audit trail'}
                  </Text>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  headerIntro: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.neutral.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
  },
  loadingContainer: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.body,
    color: colors.neutral.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginTop: spacing.md,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.neutral.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 20,
  },
  historyCard: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  dateBlock: {
    flex: 1,
  },
  dateText: {
    ...typography.bodyLarge,
    fontWeight: '800',
    color: colors.neutral.textPrimary,
  },
  timeText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: 1,
  },
  summarySection: {
    gap: spacing.xs + 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginVertical: 2,
  },
  summaryIcon: {
    fontSize: 15,
    marginTop: 2,
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.neutral.textMuted,
    letterSpacing: 0.4,
  },
  summaryValue: {
    ...typography.body,
    color: colors.neutral.textPrimary,
    fontWeight: '600',
    marginTop: 1,
  },
  timelineSection: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    backgroundColor: colors.neutral.surfaceAlt,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  timelineHeading: {
    ...typography.label,
    fontSize: 9,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.healthcare.primary,
    marginTop: 4,
    marginRight: spacing.sm,
  },
  timelineContent: {
    flex: 1,
  },
  timelineState: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.neutral.textPrimary,
  },
  timelineTime: {
    ...typography.caption,
    fontSize: 10,
    color: colors.neutral.textMuted,
  },
  timelineNote: {
    ...typography.caption,
    fontSize: 11,
    color: colors.neutral.textSecondary,
    fontStyle: 'italic',
    marginTop: 1,
  },
  expandPrompt: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: colors.healthcare.primary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
