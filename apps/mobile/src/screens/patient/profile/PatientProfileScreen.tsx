import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../../theme';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Header } from '../../../components/common/Header';
import { Card } from '../../../components/common/Card';
import { SafetyBanner } from '../../../components/common/SafetyBanner';
import { useAuth } from '../../../context/AuthContext';
import { serviceRegistry } from '../../../services/serviceRegistry';

interface PatientProfileScreenProps {
  onBack: () => void;
}

export const PatientProfileScreen: React.FC<PatientProfileScreenProps> = ({
  onBack,
}) => {
  const { patient, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState(patient?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(patient?.phoneNumber || '');
  const [community, setCommunity] = useState(patient?.communityOrVillage || '');
  const [gestationalAge, setGestationalAge] = useState(
    patient?.gestationalAgeWeeks ? String(patient.gestationalAgeWeeks) : ''
  );
  const [bloodGroup, setBloodGroup] = useState(patient?.bloodGroup || '');
  const [notes, setNotes] = useState(patient?.allergiesOrNotes || '');

  React.useEffect(() => {
    if (patient) {
      setFullName(patient.fullName || '');
      setPhoneNumber(patient.phoneNumber || '');
      setCommunity(patient.communityOrVillage || '');
      setGestationalAge(patient.gestationalAgeWeeks ? String(patient.gestationalAgeWeeks) : '');
      setBloodGroup(patient.bloodGroup || '');
      setNotes(patient.allergiesOrNotes || '');
    }
  }, [patient]);

  // Add Contact Form
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('');
  const [newContactIsPrimary, setNewContactIsPrimary] = useState(false);

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSaveProfile = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }

    setSaving(true);
    try {
      await serviceRegistry.authService.updateProfile({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        communityOrVillage: community.trim(),
        gestationalAgeWeeks: gestationalAge ? parseInt(gestationalAge, 10) : undefined,
        bloodGroup: bloodGroup.trim(),
        allergiesOrNotes: notes.trim(),
      });
      await refreshProfile();
      setSuccessMessage('Profile and clinical details updated successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      setErrorMessage('Contact name and phone are required.');
      return;
    }

    try {
      await serviceRegistry.authService.addEmergencyContact({
        name: newContactName.trim(),
        phoneNumber: newContactPhone.trim(),
        relationship: newContactRelation.trim() || 'Family',
        isPrimary: newContactIsPrimary,
      });
      await refreshProfile();
      setNewContactName('');
      setNewContactPhone('');
      setNewContactRelation('');
      setNewContactIsPrimary(false);
      setShowAddContact(false);
      setSuccessMessage('Emergency contact added.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add contact.';
      setErrorMessage(msg);
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    try {
      await serviceRegistry.authService.removeEmergencyContact(contactId);
      await refreshProfile();
      setSuccessMessage('Contact removed.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not remove contact.';
      setErrorMessage(msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="Patient Profile & Health Details" onBack={onBack} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* PATIENT HEADER CARD */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarEmoji}>🤰</Text>
          </View>
          <View style={styles.headerDetails}>
            <Text style={styles.patientName}>{patient?.fullName || 'Patient'}</Text>
            <Text style={styles.patientPhone}>{patient?.phoneNumber}</Text>
            <View style={styles.maternalPill}>
              <Text style={styles.maternalPillText}>
                {patient?.gestationalAgeWeeks
                  ? `👶 ${patient.gestationalAgeWeeks} Wks Pregnant`
                  : 'Maternal Transport Profile'}
              </Text>
            </View>
          </View>
        </View>

        {successMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>✓ {successMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
          </View>
        ) : null}

        {/* SECTION 1: PERSONAL & COMMUNITY DETAILS */}
        <Card style={styles.card}>
          <Text style={styles.cardSectionHeading}>Personal & Community Information</Text>

          <Input
            label="Full Legal Name"
            value={fullName}
            onChangeText={setFullName}
            required
          />

          <Input
            label="Mobile Phone Number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            required
          />

          <Input
            label="Home Community, Village or Neighborhood"
            value={community}
            onChangeText={setCommunity}
            helperText="Your standard residential area for emergency dispatches"
          />
        </Card>

        {/* SECTION 2: MATERNAL HEALTH INFORMATION */}
        <Card style={styles.card}>
          <Text style={styles.cardSectionHeading}>Maternal Clinical Information</Text>
          <Text style={styles.cardSectionSub}>
            Shared with destination triage healthcare staff upon emergency arrival.
          </Text>

          <Input
            label="Gestational Age (Weeks)"
            placeholder="e.g. 34"
            value={gestationalAge}
            onChangeText={setGestationalAge}
            keyboardType="numeric"
            helperText="Current estimated pregnancy progress in weeks"
          />

          <Input
            label="Blood Group"
            placeholder="e.g. O+, A+, B-"
            value={bloodGroup}
            onChangeText={setBloodGroup}
            autoCapitalize="characters"
          />

          <Input
            label="Medical Notes / Complications"
            placeholder="e.g. Hypertensive monitoring, previous C-section"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            helperText="Essential clinical history for hospital triage"
          />
        </Card>

        {/* SECTION 3: EMERGENCY CONTACTS */}
        <Card style={styles.card}>
          <View style={styles.contactHeaderRow}>
            <Text style={styles.cardSectionHeading}>Emergency Contacts</Text>
            <TouchableOpacity
              onPress={() => setShowAddContact(!showAddContact)}
              style={styles.addContactLink}
            >
              <Text style={styles.addContactLinkText}>
                {showAddContact ? 'Cancel' : '+ Add Contact'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* CONTACTS LIST */}
          {patient?.emergencyContacts && patient.emergencyContacts.length > 0 ? (
            patient.emergencyContacts.map((contact) => (
              <View key={contact.id} style={styles.contactItemRow}>
                <View style={styles.contactDetails}>
                  <View style={styles.contactNamePillRow}>
                    <Text style={styles.contactItemName}>{contact.name}</Text>
                    {contact.isPrimary ? (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.contactItemMeta}>
                    {contact.relationship} • {contact.phoneNumber}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleRemoveContact(contact.id)}
                  style={styles.deleteContactBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteContactText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.noContactsNotice}>
              No emergency contacts added. Please add a spouse, sibling, or neighbor who can be alerted during labor.
            </Text>
          )}

          {/* COLLAPSIBLE ADD CONTACT FORM */}
          {showAddContact ? (
            <View style={styles.addContactForm}>
              <Text style={styles.formTitle}>New Emergency Contact</Text>
              <Input
                label="Contact Full Name"
                placeholder="e.g. Amina Garba"
                value={newContactName}
                onChangeText={setNewContactName}
                required
              />
              <Input
                label="Phone Number"
                placeholder="e.g. 08098765432"
                value={newContactPhone}
                onChangeText={setNewContactPhone}
                keyboardType="phone-pad"
                required
              />
              <Input
                label="Relationship"
                placeholder="e.g. Husband, Sister, Mother, Neighbor"
                value={newContactRelation}
                onChangeText={setNewContactRelation}
              />
              <TouchableOpacity
                onPress={() => setNewContactIsPrimary(!newContactIsPrimary)}
                style={styles.primaryCheckRow}
              >
                <View style={[styles.checkbox, newContactIsPrimary && styles.checkboxChecked]}>
                  {newContactIsPrimary ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text style={styles.primaryCheckText}>Set as primary emergency contact</Text>
              </TouchableOpacity>
              <Button
                title="Save Emergency Contact"
                variant="secondary"
                size="md"
                onPress={handleAddContact}
                style={styles.saveContactBtn}
              />
            </View>
          ) : null}
        </Card>

        <SafetyBanner />

        <Button
          title="Save Profile Updates"
          variant="primary"
          size="lg"
          loading={saving}
          onPress={handleSaveProfile}
          style={styles.saveProfileBtn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
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
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.healthcare.light,
    borderWidth: 2,
    borderColor: colors.healthcare.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarEmoji: {
    fontSize: 30,
  },
  headerDetails: {
    flex: 1,
  },
  patientName: {
    ...typography.h2,
    color: colors.neutral.textPrimary,
  },
  patientPhone: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  maternalPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.healthcare.light,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.healthcare.border,
    marginTop: 6,
  },
  maternalPillText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: colors.healthcare.primary,
  },
  successBox: {
    backgroundColor: colors.semantic.emeraldBg,
    borderColor: colors.semantic.emeraldBorder,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  successText: {
    ...typography.body,
    color: colors.semantic.emerald,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: colors.emergency.light,
    borderColor: colors.emergency.border,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.emergency.dark,
    fontWeight: '700',
  },
  card: {
    marginBottom: spacing.md,
  },
  cardSectionHeading: {
    ...typography.label,
    color: colors.neutral.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardSectionSub: {
    ...typography.caption,
    color: colors.neutral.textMuted,
    marginBottom: spacing.md,
  },
  contactHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addContactLink: {
    paddingVertical: 2,
  },
  addContactLinkText: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.healthcare.primary,
  },
  contactItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  contactDetails: {
    flex: 1,
  },
  contactNamePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactItemName: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.neutral.textPrimary,
  },
  primaryBadge: {
    backgroundColor: colors.healthcare.light,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  primaryBadgeText: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '800',
    color: colors.healthcare.primary,
  },
  contactItemMeta: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  deleteContactBtn: {
    padding: spacing.sm,
  },
  deleteContactText: {
    color: colors.emergency.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  noContactsNotice: {
    ...typography.body,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
  },
  addContactForm: {
    backgroundColor: colors.neutral.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  formTitle: {
    ...typography.h3,
    fontSize: 15,
    color: colors.neutral.textPrimary,
    marginBottom: spacing.sm,
  },
  primaryCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.healthcare.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: colors.healthcare.primary,
  },
  checkmark: {
    color: colors.neutral.white,
    fontSize: 12,
    fontWeight: '900',
  },
  primaryCheckText: {
    ...typography.caption,
    color: colors.neutral.textPrimary,
    fontWeight: '600',
  },
  saveContactBtn: {
    marginTop: spacing.xs,
  },
  saveProfileBtn: {
    marginVertical: spacing.md,
  },
});
