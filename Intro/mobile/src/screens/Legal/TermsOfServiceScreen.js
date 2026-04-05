import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS, SPACING } from '../../constants/theme';

export default function TermsOfServiceScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Terms of Service</Text>
        <View style={{ width: 60 }} />
      </View>

      <Text style={styles.updated}>Last updated: March 1, 2026</Text>

      <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
      <Text style={styles.body}>By using Intro, you agree to these Terms of Service. If you do not agree, please do not use the app.</Text>

      <Text style={styles.sectionTitle}>2. Eligibility</Text>
      <Text style={styles.body}>You must be at least 18 years old to use Intro. By creating an account, you confirm that you are at least 18 years of age.</Text>

      <Text style={styles.sectionTitle}>3. User Conduct</Text>
      <Text style={styles.body}>You agree to treat all users with respect. Harassment, hate speech, spam, and inappropriate content are strictly prohibited. Violation of these guidelines may result in account suspension or termination.</Text>

      <Text style={styles.sectionTitle}>4. Content</Text>
      <Text style={styles.body}>You are responsible for the content you share on Intro. Do not share content that is illegal, harmful, or violates the rights of others.</Text>

      <Text style={styles.sectionTitle}>5. Safety</Text>
      <Text style={styles.body}>Intro provides reporting and blocking features to help maintain a safe community. We encourage users to report any concerning behavior.</Text>

      <Text style={styles.sectionTitle}>6. Account Termination</Text>
      <Text style={styles.body}>You may delete your account at any time through Settings. We reserve the right to suspend or terminate accounts that violate these terms.</Text>

      <Text style={styles.sectionTitle}>7. Disclaimer</Text>
      <Text style={styles.body}>Intro is provided "as is" without warranties. We are not responsible for user interactions that occur outside of the app.</Text>

      <Text style={styles.sectionTitle}>8. Contact</Text>
      <Text style={styles.body}>For questions about these terms, contact us at legal@bgpstudios.com.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 24, paddingTop: 48, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  backBtn: { fontSize: 18, color: COLORS.primary, width: 60 },
  header: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  updated: { color: COLORS.textMuted, fontSize: 13, marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginTop: 24, marginBottom: 8 },
  body: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 },
});
