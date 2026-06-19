import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';

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

      <Text style={styles.updated}>Last updated: April 8, 2026</Text>

      <Text style={styles.body}>
        Welcome to Intro. By using this app you agree to these Terms. You must be 18 or older to use Intro.
      </Text>

      <View style={styles.guidelinesBox}>
        <Text style={styles.guidelinesTitle}>Community Guidelines</Text>
        <Text style={styles.guidelinesSubtitle}>
          Intro is a respectful space. The following are strictly prohibited:
        </Text>
        {[
          'Harassment, threats, or abusive language toward any user',
          'Fake, misleading, or impersonated profiles',
          'Explicit, graphic, or illegal content of any kind',
          'Soliciting money, financial information, or personal data',
          'Spam, scams, or commercial solicitation',
          'Content involving minors in any inappropriate context',
          'Hate speech targeting any group or individual',
        ].map((item, i) => (
          <View key={i} style={styles.guidelineRow}>
            <Text style={styles.guidelineBullet}>✕</Text>
            <Text style={styles.guidelineText}>{item}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Reporting & Moderation</Text>
      <View style={styles.moderationBox}>
        <Text style={styles.moderationHeading}>How to report a user</Text>
        <Text style={styles.body}>
          Tap the <Text style={styles.bold}>•••</Text> button on any profile card in the Discover tab, then select <Text style={styles.bold}>Report User</Text>. Choose a category and add any details. Your report is kept confidential.
        </Text>
        <Text style={styles.moderationHeading}>How to block a user</Text>
        <Text style={styles.body}>
          Tap <Text style={styles.bold}>•••</Text> on a profile card, then tap <Text style={styles.bold}>Block User</Text>. The user is immediately removed from your feed, matches, and messages. They are not notified.
        </Text>
        <Text style={styles.moderationHeading}>Our commitment</Text>
        <Text style={styles.body}>
          All reports are reviewed by the Intro team within <Text style={styles.bold}>24 hours</Text> of receipt. Accounts that violate these guidelines are warned, suspended, or permanently removed depending on severity.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Your Account</Text>
      <Text style={styles.body}>
        You are responsible for keeping your login credentials confidential and for all activity under your account. Provide accurate, truthful information on your profile.
      </Text>

      <Text style={styles.sectionTitle}>Matchmaking</Text>
      <Text style={styles.body}>
        Intro offers algorithmic matching. The Intro team may review profiles to improve match quality. Any in-app outreach from Intro staff will clearly identify itself as coming from the Intro team — not a fellow user.
      </Text>

      <Text style={styles.sectionTitle}>Virtual Experiences</Text>
      <Text style={styles.body}>
        Shared experiences such as Movie Night may be powered by third-party providers. Intro is not responsible for third-party content or service availability.
      </Text>

      <Text style={styles.sectionTitle}>Termination</Text>
      <Text style={styles.body}>
        We may suspend or terminate your account at any time for violations of these Terms or conduct that is harmful to our community. You may delete your own account at any time in Settings.
      </Text>

      <Text style={styles.sectionTitle}>Disclaimer</Text>
      <Text style={styles.body}>
        Intro is provided "as is" without warranties. We do not guarantee matches, the accuracy of other users' profiles, or uninterrupted service availability.
      </Text>

      <Text style={styles.sectionTitle}>Contact Us</Text>
      <Text style={styles.body}>
        For support, abuse reports, or questions about these Terms:
      </Text>
      <TouchableOpacity onPress={() => Linking.openURL('mailto:privacy@bgpstudios.com')}>
        <Text style={styles.emailLink}>privacy@bgpstudios.com</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>© 2026 Intro / BGP Studios. All rights reserved.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.xxl, paddingBottom: SPACING.xxl },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SPACING.lg,
  },
  backBtn: { fontSize: 18, color: COLORS.primary, width: 60 },
  header: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  updated: { color: COLORS.textMuted, fontSize: 13, marginBottom: SPACING.lg },
  sectionTitle: {
    fontSize: 17, fontWeight: '600', color: COLORS.text,
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  body: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 22, marginBottom: SPACING.sm },
  bold: { color: COLORS.text, fontWeight: '600' },
  emailLink: { fontSize: 15, color: COLORS.primary, marginBottom: SPACING.lg },
  footer: { marginTop: SPACING.xxl, color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },

  guidelinesBox: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    padding: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  guidelinesTitle: {
    fontSize: 16, fontWeight: '700', color: COLORS.danger, marginBottom: SPACING.xs,
  },
  guidelinesSubtitle: {
    fontSize: 14, color: COLORS.textSecondary, marginBottom: SPACING.md,
  },
  guidelineRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.xs },
  guidelineBullet: { color: COLORS.danger, fontWeight: '700', fontSize: 14, marginTop: 2 },
  guidelineText: { flex: 1, fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },

  moderationBox: {
    backgroundColor: COLORS.bgLight,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  moderationHeading: {
    fontSize: 14, fontWeight: '600', color: COLORS.primary,
    marginBottom: SPACING.xs, marginTop: SPACING.sm,
  },
});
