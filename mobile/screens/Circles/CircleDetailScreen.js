import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ─── Palette ─────────────────────────────────────────────────────────────────
const COLORS = {
  warmLinen: '#EFE9E4',
  linenLight: '#F7F3EF',
  quietSky: '#A8C8E8',
  quietSkyDeep: '#7AAED4',
  quietSkyFaint: '#D6EAF5',
  textPrimary: '#2C2825',
  textSecondary: '#7A6E68',
  textMuted: '#B0A49E',
  white: '#FFFFFF',
  divider: '#E0D9D3',
  liveRed: '#E05C5C',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatSessionTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Tonight · ${timeStr}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${timeStr}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${timeStr}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PromptCard({ prompt, hasResponded, onRespond }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    await onRespond(prompt.id, text.trim());
    setText('');
    setSubmitting(false);
  };

  return (
    <View style={styles.promptCard}>
      <View style={styles.promptHeader}>
        <Text style={styles.promptLabel}>Today's prompt</Text>
        {prompt.response_count > 0 && (
          <Text style={styles.promptResponseCount}>
            {prompt.response_count} {prompt.response_count === 1 ? 'response' : 'responses'}
          </Text>
        )}
      </View>
      <Text style={styles.promptBody}>"{prompt.body}"</Text>

      {hasResponded ? (
        <View style={styles.promptAnswered}>
          <Text style={styles.promptAnsweredText}>✓ You responded</Text>
        </View>
      ) : (
        <View style={styles.promptInputRow}>
          <TextInput
            style={styles.promptInput}
            placeholder="Share your take…"
            placeholderTextColor={COLORS.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.promptSend, (!text.trim() || submitting) && styles.promptSendDisabled]}
            onPress={handleSubmit}
            disabled={!text.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={COLORS.textPrimary} />
            ) : (
              <Text style={styles.promptSendText}>→</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function SessionBanner({ session, onJoin }) {
  const isLive = session.status === 'live';
  return (
    <TouchableOpacity
      style={[styles.sessionBanner, isLive && styles.sessionBannerLive]}
      onPress={() => onJoin(session)}
      activeOpacity={0.85}
    >
      <View style={styles.sessionBannerLeft}>
        {isLive && <View style={styles.liveDot} />}
        <View>
          <Text style={[styles.sessionBannerTitle, isLive && styles.sessionBannerTitleLive]}>
            {isLive ? 'Live now' : formatSessionTime(session.scheduled_at)}
          </Text>
          <Text style={styles.sessionBannerSub} numberOfLines={1}>{session.title}</Text>
        </View>
      </View>
      <Text style={[styles.sessionBannerCta, isLive && styles.sessionBannerCtaLive]}>
        {isLive ? 'Join →' : 'View →'}
      </Text>
    </TouchableOpacity>
  );
}

function PostRow({ post, currentUserId, onReact }) {
  const isMine = post.user_id === currentUserId;
  const myReaction = post.post_reactions?.find((r) => r.user_id === currentUserId);
  const feltCount = post.post_reactions?.filter((r) => r.type === 'felt_this').length || 0;
  const heartCount = post.post_reactions?.filter((r) => r.type === 'heart').length || 0;

  return (
    <View style={[styles.postRow, isMine && styles.postRowMine]}>
      <View style={[styles.postBubble, isMine && styles.postBubbleMine]}>
        <Text style={[styles.postBody, isMine && styles.postBodyMine]}>{post.body}</Text>
        <Text style={[styles.postTime, isMine && styles.postTimeMine]}>{timeAgo(post.created_at)}</Text>
      </View>
      {!isMine && (
        <View style={styles.reactionRow}>
          <TouchableOpacity
            style={[styles.reactionBtn, myReaction?.type === 'felt_this' && styles.reactionBtnActive]}
            onPress={() => onReact(post.id, 'felt_this', myReaction)}
          >
            <Text style={styles.reactionEmoji}>💙</Text>
            {feltCount > 0 && <Text style={styles.reactionCount}>{feltCount}</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reactionBtn, myReaction?.type === 'heart' && styles.reactionBtnActive]}
            onPress={() => onReact(post.id, 'heart', myReaction)}
          >
            <Text style={styles.reactionEmoji}>🤍</Text>
            {heartCount > 0 && <Text style={styles.reactionCount}>{heartCount}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CircleDetailScreen({ route, navigation }) {
  const { circleId, circle: circleParam } = route.params;
  const { user } = useAuth();

  const [circle, setCircle] = useState(circleParam || null);
  const [prompt, setPrompt] = useState(null);
  const [hasResponded, setHasResponded] = useState(false);
  const [upcomingSession, setUpcomingSession] = useState(null);
  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const scrollRef = useRef(null);

  // ── Fetch everything ────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      const [circleRes, promptRes, sessionRes, postsRes] = await Promise.all([
        supabase
          .from('circles')
          .select('id, name, description, topic_tag, cover_color, member_count')
          .eq('id', circleId)
          .single(),
        supabase
          .from('prompts')
          .select('id, body, response_count, active_date')
          .eq('circle_id', circleId)
          .order('active_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('sessions')
          .select('id, title, host_prompt, scheduled_at, status')
          .eq('circle_id', circleId)
          .in('status', ['upcoming', 'live'])
          .order('scheduled_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('posts')
          .select(`
            id, body, user_id, created_at,
            post_reactions ( id, user_id, type )
          `)
          .eq('circle_id', circleId)
          .order('created_at', { ascending: true })
          .limit(50),
      ]);

      if (circleRes.data) setCircle(circleRes.data);
      setPrompt(promptRes.data || null);
      setUpcomingSession(sessionRes.data || null);
      setPosts(postsRes.data || []);

      // Check if user already responded to today's prompt
      if (promptRes.data) {
        const { data: myResponse } = await supabase
          .from('prompt_responses')
          .select('id')
          .eq('prompt_id', promptRes.data.id)
          .eq('user_id', user.id)
          .maybeSingle();
        setHasResponded(!!myResponse);
      }
    } catch (err) {
      console.error('[CircleDetail] fetchAll error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId, user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Realtime — posts + reactions ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`circle-detail-${circleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `circle_id=eq.${circleId}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions' }, () => fetchAll())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [circleId, user, fetchAll]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleRespond = useCallback(async (promptId, body) => {
    try {
      const { error } = await supabase.from('prompt_responses').insert({
        prompt_id: promptId,
        user_id: user.id,
        body,
      });
      if (error && error.code !== '23505') throw error;
      setHasResponded(true);
      setPrompt((p) => p ? { ...p, response_count: p.response_count + 1 } : p);
    } catch (err) {
      Alert.alert('Could not save response', err.message);
    }
  }, [user]);

  const handlePost = useCallback(async () => {
    if (!postText.trim()) return;
    setPosting(true);
    const body = postText.trim();
    setPostText('');
    try {
      const { error } = await supabase.from('posts').insert({
        circle_id: circleId,
        user_id: user.id,
        body,
      });
      if (error) throw error;
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    } catch (err) {
      Alert.alert('Could not post', err.message);
      setPostText(body); // restore on failure
    } finally {
      setPosting(false);
    }
  }, [postText, circleId, user]);

  const handleReact = useCallback(async (postId, type, existing) => {
    try {
      if (existing) {
        if (existing.type === type) {
          // toggle off
          await supabase.from('post_reactions').delete().eq('id', existing.id);
        } else {
          // switch type
          await supabase.from('post_reactions').update({ type }).eq('id', existing.id);
        }
      } else {
        await supabase.from('post_reactions').insert({ post_id: postId, user_id: user.id, type });
      }
    } catch (err) {
      console.error('[CircleDetail] react error:', err.message);
    }
  }, [user]);

  const handleJoinSession = useCallback((session) => {
    navigation.navigate('SessionScreen', { sessionId: session.id, session, circle });
  }, [navigation, circle]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.quietSkyDeep} />
      </View>
    );
  }

  const coverColor = circle?.cover_color || COLORS.quietSky;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <StatusBar barStyle="light-content" backgroundColor={coverColor} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: coverColor }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{circle?.name}</Text>
          <Text style={styles.headerSub}>
            #{circle?.topic_tag} · {circle?.member_count} members
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Session banner */}
        {upcomingSession && (
          <View style={styles.bannerWrap}>
            <SessionBanner session={upcomingSession} onJoin={handleJoinSession} />
          </View>
        )}

        {/* Today's prompt */}
        {prompt && (
          <View style={styles.section}>
            <PromptCard
              prompt={prompt}
              hasResponded={hasResponded}
              onRespond={handleRespond}
            />
          </View>
        )}

        {/* Posts feed */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Circle feed</Text>
          {posts.length === 0 ? (
            <View style={styles.feedEmpty}>
              <Text style={styles.feedEmptyText}>No posts yet. Say something quiet.</Text>
            </View>
          ) : (
            posts.map((post) => (
              <PostRow
                key={post.id}
                post={post}
                currentUserId={user?.id}
                onReact={handleReact}
              />
            ))
          )}
        </View>

        {/* Bottom spacing for input bar */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Post composer */}
      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          placeholder="Share something with the circle…"
          placeholderTextColor={COLORS.textMuted}
          value={postText}
          onChangeText={setPostText}
          multiline
          maxLength={300}
        />
        <TouchableOpacity
          style={[styles.composerSend, (!postText.trim() || posting) && styles.composerSendDisabled]}
          onPress={handlePost}
          disabled={!postText.trim() || posting}
        >
          {posting ? (
            <ActivityIndicator size="small" color={COLORS.textPrimary} />
          ) : (
            <Text style={styles.composerSendText}>→</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.warmLinen },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.warmLinen },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 54 : 20,
    paddingBottom: 14,
  },
  backBtn: { width: 36, alignItems: 'center' },
  backBtnText: { fontSize: 22, color: COLORS.white },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 12, paddingBottom: 16 },

  // Session banner
  bannerWrap: { paddingHorizontal: 16, marginBottom: 12 },
  sessionBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.quietSkyFaint,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.quietSkyDeep,
  },
  sessionBannerLive: {
    backgroundColor: '#FCEAEA',
    borderLeftColor: COLORS.liveRed,
  },
  sessionBannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.liveRed },
  sessionBannerTitle: { fontSize: 12, fontWeight: '600', color: COLORS.quietSkyDeep },
  sessionBannerTitleLive: { color: COLORS.liveRed },
  sessionBannerSub: { fontSize: 14, color: COLORS.textPrimary, marginTop: 1, flex: 1 },
  sessionBannerCta: { fontSize: 13, fontWeight: '600', color: COLORS.quietSkyDeep },
  sessionBannerCtaLive: { color: COLORS.liveRed },

  // Sections
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  // Prompt card
  promptCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#2C2825',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  promptHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  promptLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  promptResponseCount: { fontSize: 11, color: COLORS.textMuted },
  promptBody: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 22, marginBottom: 14, fontStyle: 'italic' },
  promptAnswered: { backgroundColor: COLORS.quietSkyFaint, borderRadius: 8, padding: 10, alignItems: 'center' },
  promptAnsweredText: { fontSize: 13, color: COLORS.quietSkyDeep, fontWeight: '600' },
  promptInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  promptInput: {
    flex: 1,
    backgroundColor: COLORS.linenLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
    maxHeight: 80,
  },
  promptSend: {
    width: 40, height: 40,
    backgroundColor: COLORS.quietSky,
    borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  promptSendDisabled: { opacity: 0.4 },
  promptSendText: { fontSize: 18, color: COLORS.textPrimary, fontWeight: '600' },

  // Posts
  feedEmpty: { paddingVertical: 24, alignItems: 'center' },
  feedEmptyText: { fontSize: 14, color: COLORS.textMuted, fontStyle: 'italic' },
  postRow: { marginBottom: 10, alignItems: 'flex-start' },
  postRowMine: { alignItems: 'flex-end' },
  postBubble: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    padding: 12,
    maxWidth: '80%',
    shadowColor: '#2C2825',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  postBubbleMine: {
    backgroundColor: COLORS.quietSkyFaint,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 4,
  },
  postBody: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  postBodyMine: { color: COLORS.textPrimary },
  postTime: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  postTimeMine: { textAlign: 'right' },
  reactionRow: { flexDirection: 'row', gap: 6, marginTop: 4, paddingLeft: 4 },
  reactionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: COLORS.linenLight, borderRadius: 20,
  },
  reactionBtnActive: { backgroundColor: COLORS.quietSkyFaint },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },

  // Composer
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    gap: 8,
  },
  composerInput: {
    flex: 1,
    backgroundColor: COLORS.linenLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
    maxHeight: 100,
  },
  composerSend: {
    width: 42, height: 42,
    backgroundColor: COLORS.quietSky,
    borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  composerSendDisabled: { opacity: 0.4 },
  composerSendText: { fontSize: 18, color: COLORS.textPrimary, fontWeight: '600' },
});
