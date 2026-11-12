import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import { EmergencySeverity, NewCasePayload } from '../../../types/dispatcher';

interface NewCaseModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: NewCasePayload) => void;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const [severity, setSeverity] = useState<EmergencySeverity>('CRITICAL');
  const [emergencyTitle, setEmergencyTitle] = useState('');
  const [emergencyDescription, setEmergencyDescription] = useState('');
  const [locationArea, setLocationArea] = useState('');
  const [reportedBy, setReportedBy] = useState('Bystander');
  const [isAwake, setIsAwake] = useState(false);
  const [bloodGroup, setBloodGroup] = useState('Not on file');
  const [callerNote, setCallerNote] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = () => {
    if (!emergencyTitle.trim() || !locationArea.trim()) {
      setErrorMessage('Please provide both an emergency title and location area.');
      return;
    }
    setErrorMessage('');
    onSubmit({
      severity,
      emergencyTitle: emergencyTitle.trim(),
      emergencyDescription: emergencyDescription.trim() || emergencyTitle.trim(),
      locationArea: locationArea.trim(),
      reportedBy: reportedBy.trim() || 'Bystander',
      isAwake,
      bloodGroup: bloodGroup.trim() || 'Not on file',
      callerNote: callerNote.trim() || 'Urgent dispatch intake',
    });
    // Reset fields
    setEmergencyTitle('');
    setEmergencyDescription('');
    setLocationArea('');
    setCallerNote('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Intake New Emergency Case</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            {/* Severity Selection */}
            <Text style={styles.fieldLabel}>SEVERITY LEVEL</Text>
            <View style={styles.severityRow}>
              {(['CRITICAL', 'URGENT', 'STABLE'] as EmergencySeverity[]).map((sev) => {
                const isSelected = severity === sev;
                return (
                  <TouchableOpacity
                    key={sev}
                    onPress={() => setSeverity(sev)}
                    style={[
                      styles.severityBtn,
                      isSelected && sev === 'CRITICAL' && styles.sevBtnCriticalActive,
                      isSelected && sev === 'URGENT' && styles.sevBtnUrgentActive,
                      isSelected && sev === 'STABLE' && styles.sevBtnStableActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.severityBtnText,
                        isSelected && styles.severityBtnTextActive,
                      ]}
                    >
                      {sev}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Title */}
            <Text style={styles.fieldLabel}>EMERGENCY TITLE</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Unconscious, Severe bleed, etc."
              value={emergencyTitle}
              onChangeText={setEmergencyTitle}
              placeholderTextColor="#98A2B3"
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>SECONDARY DESCRIPTION</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Female, heavy bleeding, unresponsive"
              value={emergencyDescription}
              onChangeText={setEmergencyDescription}
              placeholderTextColor="#98A2B3"
            />

            {/* Location */}
            <Text style={styles.fieldLabel}>LOCATION AREA</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. [Area E], Karu Market Junction"
              value={locationArea}
              onChangeText={setLocationArea}
              placeholderTextColor="#98A2B3"
            />

            {/* Reported By & Awake */}
            <View style={styles.rowTwoCols}>
              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel}>REPORTED BY</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Bystander, Family"
                  value={reportedBy}
                  onChangeText={setReportedBy}
                  placeholderTextColor="#98A2B3"
                />
              </View>

              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel}>PATIENT AWAKE?</Text>
                <View style={styles.awakeRow}>
                  <TouchableOpacity
                    onPress={() => setIsAwake(true)}
                    style={[styles.awakeBtn, isAwake && styles.awakeBtnActive]}
                  >
                    <Text style={[styles.awakeBtnText, isAwake && styles.awakeBtnTextActive]}>
                      Yes
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIsAwake(false)}
                    style={[styles.awakeBtn, !isAwake && styles.awakeBtnActiveNo]}
                  >
                    <Text style={[styles.awakeBtnText, !isAwake && styles.awakeBtnTextActive]}>
                      No
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Blood Group & Caller Note */}
            <View style={styles.rowTwoCols}>
              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel}>BLOOD GROUP</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. O+, A-, Not on file"
                  value={bloodGroup}
                  onChangeText={setBloodGroup}
                  placeholderTextColor="#98A2B3"
                />
              </View>
              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel}>CALLER NOTE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Collapsed at transit hub"
                  value={callerNote}
                  onChangeText={setCallerNote}
                  placeholderTextColor="#98A2B3"
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSubmit} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>Add to live queue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 26, 44, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e7ecf0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f7',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f1a2c',
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    fontSize: 16,
    color: '#667085',
  },
  scrollBody: {
    padding: 20,
  },
  errorText: {
    color: '#df2b1a',
    fontSize: 12,
    marginBottom: 10,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#667085',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  severityBtn: {
    flex: 1,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  sevBtnCriticalActive: {
    backgroundColor: '#df2b1a',
    borderColor: '#df2b1a',
  },
  sevBtnUrgentActive: {
    backgroundColor: '#ffefc9',
    borderColor: '#f79009',
  },
  sevBtnStableActive: {
    backgroundColor: '#e8f0fd',
    borderColor: '#175cd3',
  },
  severityBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#344054',
  },
  severityBtnTextActive: {
    color: '#FFFFFF',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
    color: '#101828',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
  } as any,
  rowTwoCols: {
    flexDirection: 'row',
    gap: 12,
  },
  colHalf: {
    flex: 1,
  },
  awakeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  awakeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 6,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  awakeBtnActive: {
    backgroundColor: '#12b76a',
    borderColor: '#12b76a',
  },
  awakeBtnActiveNo: {
    backgroundColor: '#df2b1a',
    borderColor: '#df2b1a',
  },
  awakeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#344054',
  },
  awakeBtnTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f2f4f7',
    gap: 10,
    backgroundColor: '#f8fafc',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#667085',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#0f1a2c',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  submitBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
