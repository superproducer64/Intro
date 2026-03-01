import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';

export default function PrivacyPolicyScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Privacy Policy</Text>
        <View style={{ width: 60 }} />
      </View>

      <Text style={styles.updated}>Last updated: March 1, 2026</Text>

      <Text style={styles.sectionTitle}>1. Information We Collect</Text>
      <Text style={styles.body}>We collect information you provide directly, including your name, email address, age, location, bio, interests, and profile prompts. We also collect messages you send through the app.</Text>

      <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
      <Text style={styles.body}>We use your information to provide and improve the Intro dating service, including matching you with compatible users, enabling messaging, and personalizing your experience.</Text>

      <Text style={styles.sectionTitle}>3. Data Sharing</Text>
      <Text style={styles.body}>We do not sell your personal information. Your profile information is visible to other users of the app. We may share data with service providers who help operate our platform.</Text>

      <Text style={styles.sectionTitle}>4. Data Security</Text>
      <Text style={styles.body}>We implement industry-standard security measures to protect your data, including encrypted passwords and secure data transmission.</Text>

      <Text style={styles.sectionTitle}>5. Your Rights</Text>
      <Text style={styles.body}>You can access, update, or delete your personal information at any time through the app settings. Deleting your account will permanently remove all your data from our servers.</Text>

      <Text style={styles.sectionTitle}>6. Data Retention</Text>
      <Text style={styles.body}>We retain your data only for as long as your account is active. When you delete your account, all associated data is permanently removed.</Text>

      <Text style={styles.sectionTitle}>7. Contact</Text>
      <Text style={styles.body}>For privacy-related questions, contact us at privacy@bgpstudios.com.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.xxl, paddingBottom: SPACING.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  backBtn: { fontSize: 18, color: COLORS.primary, width: 60 },
  header: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  updated: { color: COLORS.textMuted, fontSize: 13, marginBottom: SPACING.lg },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  body: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 },
});
