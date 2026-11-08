/**
 * PromptsScreen.js
 * Intro — pivot/circles
 *
 * Today's prompt for each circle the user belongs to. Answer first, then
 * see what everyone else said (introvert-safe reveal).
 *
 * Tables: circle_members, circles, prompts, prompt_responses, profiles.
 * prompts.response_count is maintained by the trg_prompt_response_count
 * trigger — the client never writes it.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const COLORS = {
  accent:   '#AA2246',
  bg:       '#F7F3EF',
  card:     '#FFFFFF',
  fg:       '#1E1A1D',
  muted:    '#6B6168',
  line:     '#ECE5DF',
  chipBg:   '#EFE7E1',
  accentFg: '#FFFFFF',
};

const MAX_LEN = 500;

// ─── Sub-components ───────────────────────────────────────────────────────────

function PromptCard({ item, userId, draft, onChangeDraft, submitting, onSend }) {
  const { circle, prompt, responses } = item;
  const mine = responses.find((r) => r.user_id === userId);
  const others = responses.filter((r) => r.user_id !== userId);
  const color = circle.cover_color || COLORS.accent;
  const trimmed = (draft || '').trim();

  return (
    <View style={styles.card}>
      <View style={styles.circleRow}>
        <View style={[styles.circleDot, { backgroundColor: color }]} />
        <Text style={[styles.circleName, { color }]} numberOfLines={1}>{circle.name}</Text>
      </View>

      <Text style={styles.promptText}>{prompt.body}</Text>

      {mine ? (
        <>
          <View style={[styles.myAnswer, { borderColor: color }]}>
            <Text style={styles.myAnswerLabel}>Your answer</Text>
            <Text style={styles.answerBody}>{mine.body}</Text>
          </View>

          <Text style={styles.othersLabel}>
            {others.length === 0
              ? 'No one else has answered yet'
              : `${others.length} other ${others.length === 1 ? 'answer' : 'answers'}`}
          </Text>
          {others.map((r) => (
            <View key={r.id} style={styles.otherAnswer}>
              <Text style={styles.otherName}>{r.name}</Text>
              <Text style={styles.answerBody}>{r.body}</Text>
            </View>
          ))}
        </>
      ) : (
        <View style={styles.inputBox}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={onChangeDraft}
            placeholder="Take your time…"
            placeholderTextColor={COLORS.muted}
            multiline
            maxLength={MAX_LEN}
            editable={!submitting}
            textAlignVertical="top"
          />
          <View style={styles.inputFooter}>
            <Text style={styles.hint}>Answer to see what others said.</Text>
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: color }, (!trimmed || submitting) && styles.sendBtnDisabled]}
              onPress={onSend}
              disabled={!trimmed || submitting}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Send answer"
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.accentFg} />
              ) : (
                <Text style={styles.sendBtnText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PromptsScreen({ navigation }) {
  const [userId, setUserId]         = useState(null);
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drafts, setDrafts]         = useState({});
  const [submittingId, setSubmittingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) return;
      setUserId(uid);

      // 1. Circles I belong to
      const { data: memberships, error: mErr } = await supabase
        .from('circle_members')
        .select('circle_id, circles ( id, name, cover_color )')
        .eq('user_id', uid);
      if (mErr) throw mErr;

      const circles = (memberships || []).map((m) => m.circles).filter(Boolean);
      if (circles.length === 0) { setItems([]); return; }

      // 2. Today's prompts for those circles
      const today = new Date().toISOString().slice(0, 10);
      const { data: prompts, error: pErr } = await supabase
        .from('prompts')
        .select('id, circle_id, body, active_date, response_count')
        .in('circle_id', circles.map((c) => c.id))
        .eq('active_date', today)
        .order('created_at', { ascending: false });
      if (pErr) throw pErr;

      // One prompt per circle (newest wins)
      const promptByCircle = new Map();
      (prompts || []).forEach((p) => {
        if (!promptByCircle.has(p.circle_id)) promptByCircle.set(p.circle_id, p);
      });
      const active = circles.filter((c) => promptByCircle.has(c.id));
      if (active.length === 0) { setItems([]); return; }

      // 3. Responses for those prompts
      const promptIds = active.map((c) => promptByCircle.get(c.id).id);
      const { data: responses, error: rErr } = await supabase
        .from('prompt_responses')
        .select('id, prompt_id, user_id, body, created_at')
        .in('prompt_id', promptIds)
        .order('created_at', { ascending: true });
      if (rErr) throw rErr;

      // 4. Names (no FK from prompt_responses to profiles, so look up separately)
      const userIds = [...new Set((responses || []).map((r) => r.user_id))];
      const names = new Map();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);
        (profiles || []).forEach((p) => names.set(p.id, p.name));
      }

      setItems(
        active.map((circle) => {
          const prompt = promptByCircle.get(circle.id);
          return {
            circle,
            prompt,
            responses: (responses || [])
              .filter((r) => r.prompt_id === prompt.id)
              .map((r) => ({ ...r, name: names.get(r.user_id) || 'Someone' })),
          };
        })
      );
    } catch (e) {
      console.warn('PromptsScreen load:', e?.message || e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const sendAnswer = useCallback(async (promptId) => {
    const text = (drafts[promptId] || '').trim();
    if (!userId || !text || submittingId) return;
    setSubmittingId(promptId);
    try {
      const { error } = await supabase
        .from('prompt_responses')
        .insert({ prompt_id: promptId, user_id: userId, body: text });
      // 23505 = already answered (unique prompt_id,user_id): just refresh to show it
      if (error && error.code !== '23505') throw error;
      setDrafts((d) => ({ ...d, [promptId]: '' }));
      await load();
    } catch (e) {
      console.warn('sendAnswer:', e?.message || e);
      Alert.alert('Could not send', 'Something went wrong. Please try again.');
    } finally {
      setSubmittingId(null);
    }
  }, [drafts, userId, submittingId, load]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
          }
        >
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => navigation?.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Today's prompts</Text>

          {items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No prompts today — check back tomorrow</Text>
            </View>
          ) : (
            items.map((item) => (
              <PromptCard
                key={item.prompt.id}
                item={item}
                userId={userId}
                draft={drafts[item.prompt.id] || ''}
                onChangeDraft={(t) => setDrafts((d) => ({ ...d, [item.prompt.id]: t }))}
                submitting={submittingId === item.prompt.id}
                onSend={() => sendAnswer(item.prompt.id)}
              />
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: COLORS.bg },
  flex:     { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 56 },

  backRow: {
    flexDirection: 'row',
    alignItems:    'center',
    alignSelf:     'flex-start',
    gap:           6,
    paddingTop:    12,
    paddingBottom: 4,
  },
  backArrow: { fontSize: 20, color: COLORS.accent },
  backLabel: { fontSize: 15, color: COLORS.accent, fontWeight: '500' },

  title: {
    fontSize:      28,
    fontWeight:    '700',
    color:         COLORS.fg,
    letterSpacing: -0.5,
    paddingTop:    12,
    paddingBottom: 20,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius:    24,
    borderWidth:     1,
    borderColor:     COLORS.line,
    padding:         20,
    gap:             14,
    marginBottom:    20,
  },
  circleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  circleDot:  { width: 10, height: 10, borderRadius: 5 },
  circleName: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', flex: 1 },
  promptText: {
    fontSize:      22,
    fontWeight:    '700',
    color:         COLORS.fg,
    lineHeight:    29,
    letterSpacing: -0.3,
  },

  // Input
  inputBox: {
    backgroundColor: COLORS.bg,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     COLORS.line,
    padding:         12,
    gap:             10,
  },
  input: {
    minHeight: 90,
    fontSize:  16,
    color:     COLORS.fg,
    lineHeight: 22,
  },
  inputFooter: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            12,
  },
  hint: { flex: 1, fontSize: 13, color: COLORS.muted },
  sendBtn: {
    minWidth:       88,
    height:         40,
    borderRadius:   20,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.accentFg },

  // Answers
  myAnswer: {
    borderRadius:    16,
    borderWidth:     2,
    backgroundColor: COLORS.chipBg,
    padding:         14,
    gap:             6,
  },
  myAnswerLabel: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color:         COLORS.muted,
  },
  answerBody: { fontSize: 15, color: COLORS.fg, lineHeight: 22 },
  othersLabel: { fontSize: 13, fontWeight: '600', color: COLORS.muted, marginTop: 4 },
  otherAnswer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingTop:     12,
    gap:            4,
  },
  otherName: { fontSize: 13, fontWeight: '700', color: COLORS.fg },

  // Empty
  empty: {
    backgroundColor: COLORS.card,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     COLORS.line,
    padding:         24,
    alignItems:      'center',
  },
  emptyText: { fontSize: 15, color: COLORS.muted, textAlign: 'center' },
});
