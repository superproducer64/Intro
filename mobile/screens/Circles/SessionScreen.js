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
  liveRedFaint: '#FCEAEA',
};

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === 'live') {
    return (
      <View style={styles.liveBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.liveBadgeText}>LIVE</Text>
      </View>
    );
  }
  if (status === 'upcoming') {
    return (
      <View style={styles.upcomingBadge}>
        <Text style={styles.upcomingBadgeText}>UPCOMING</Text>
      </View>
    );
  }
  return (
    <View style={styles.endedBadge}>
      <Text style={styles.endedBadgeText}>ENDED</Text>
    </View>
  );
}

// ─── Post bubble ─────────────────────────────────────────────────────────────
function PostBubble({ post, isMine }) {
  return (
    <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, isMine && styles.bubbleMine]}>
        <Text style={[styles.bubbleBody, isMine && styles.bubbleBodyMine]}>{post.body}</Text>
        <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>{timeAgo(post.created_at)}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SessionScreen({ route, navigation }) {
  const { sessionId, session: sessionParam, circle } = route.params;
  const { user } = useAuth();

  const [session, setSession] = useState(sessionParam || null);
  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState('');
  const [loading, setLoading] = useState(!sessionParam);
  const [posting, setPosting] = useState(false);
  const scrollRef = useRef(null);

  // ── Fetch session + posts ──────────────────────────────────────────────────
  const fetchSession = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, title, host_prompt, scheduled_at, started_at, ended_at, status, circle_id')
        .eq('id', sessionId)
        .single();
      if (error) throw error;
      setSession(data);
    } catch (err) {
      console.error('[SessionScreen] fetchSession:', err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const fetchPosts = useCallback(async () => {
    try {
      // Session posts = circle posts created while session was live (or all circle posts for simplicity)
      const { data, error } = await supabase
        .from('posts')
        .select('id, body, user_id, created_at')
        .eq('circle_id', session?.circle_id || circle?.id)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('[SessionScreen] fetchPosts:', err.message);
    }
  }, [session?.circle_id, circle?.id]);

  useEffect(() => {
    if (!sessionParam) fetchSession();
  }, [sessionParam, fetchSession]);

  useEffect(() => {
    if (session) fetchPosts();
  }, [session, fetchPosts]);

  // ── Realtime — session status + posts ─────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const circleId = session.circle_id || circle?.id;

    const channel = supabase
      .channel(`session-${sessionId}`)
      // Session status changes (upcoming → live → ended) — REPLICA IDENTITY FULL
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        setSession((prev) => ({ ...prev, ...payload.new }));
      })
      // New posts in this circle
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'posts',
        filter: `circle_id=eq.${circleId}`,
      }, (payload) => {
        setPosts((prev) => [...prev, payload.new]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [session, sessionId, circle?.id]);

  // Auto-scroll when posts load
  useEffect(() => {
    if (posts.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [posts.length]);

  // ── Post action ───────────────────────────────────────────────────────────
  const handlePost = useCallback(async () => {
    if (!postText.trim() || session?.status === 'ended') return;
    setPosting(true);
    const body = postText.trim();
    setPostText('');
    const circleId = session?.circle_id || circle?.id;
    try {
      const { error } = await supabase.from('posts').insert({
        circle_id: circleId,
        user_id: user.id,
        body,
      });
      if (error) throw error;
    } catch (err) {
      Alert.alert('Could not send', err.message);
      setPostText(body);
    } finally {
      setPosting(false);
    }
  }, [postText, session, circle, user]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.quietSkyDeep} />
      </View>
    );
  }

  const coverColor = circle?.cover_color || COLORS.quietSky;
  const isLive = session?.status === 'live';
  const isEnded = session?.status === 'ended';
  const canPost = isLive && !isEnded;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar barStyle="light-content" backgroundColor={coverColor} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: coverColor }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerCircle}>{circle?.name || 'Circle'}</Text>
            <StatusBadge status={session?.status} />
          </View>
          <Text style={styles.headerSessionTitle} numberOfLines={1}>
            {session?.title}
          </Text>
        </View>
        <View style={styles.closeBtn} />
      </View>

      {/* Host prompt card */}
      {session?.host_prompt && (
        <View style={[styles.hostPromptBar, { borderLeftColor: coverColor }]}>
          <Text style={styles.hostPromptLabel}>Opening prompt</Text>
          <Text style={styles.hostPromptBody}>"{session.host_prompt}"</Text>
        </View>
      )}

      {/* Upcoming state */}
      {session?.status === 'upcoming' && (
        <View style={styles.upcomingState}>
          <Text style={styles.upcomingIcon}>🕐</Text>
          <Text style={styles.upcomingTitle}>Session hasn't started yet</Text>
          <Text style={styles.upcomingBody}>
            Come back when it goes live — you'll see the conversation here in real time.
          </Text>
        </View>
      )}

      {/* Posts feed */}
      {session?.status !== 'upcoming' && (
        <ScrollView
          ref={scrollRef}
          style={styles.feed}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {posts.length === 0 ? (
            <View style={styles.feedEmpty}>
              <Text style={styles.feedEmptyText}>
                {isLive ? 'Be the first to share something.' : 'Nothing was posted.'}
              </Text>
            </View>
          ) : (
            posts.map((post) => (
              <PostBubble
                key={post.id}
                post={post}
                isMine={post.user_id === user?.id}
              />
            ))
          )}

          {isEnded && (
            <View style={styles.endedBanner}>
              <Text style={styles.endedBannerText}>This session has ended.</Text>
            </View>
          )}

          <View style={{ height: 16 }} />
        </ScrollView>
      )}

      {/* Composer — only during live sessions */}
      {canPost && (
        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            placeholder="Share something…"
            placeholderTextColor={COLORS.textMuted}
            value={postText}
            onChangeText={setPostText}
            multiline
            maxLength={300}
            returnKeyType="send"
            onSubmitEditing={handlePost}
            blurOnSubmit={false}
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
      )}
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
  closeBtn: { width: 36, alignItems: 'center' },
  closeBtnText: { fontSize: 18, color: COLORS.white },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCircle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  headerSessionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.white, marginTop: 3, textAlign: 'center' },

  // Status badges
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.liveRedFaint, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.liveRed },
  liveBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.liveRed, letterSpacing: 0.5 },
  upcomingBadge: {
    backgroundColor: COLORS.quietSkyFaint, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  upcomingBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.quietSkyDeep, letterSpacing: 0.5 },
  endedBadge: {
    backgroundColor: COLORS.linenLight, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  endedBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5 },

  // Host prompt bar
  hostPromptBar: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 14,
    shadowColor: '#2C2825',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  hostPromptLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  hostPromptBody: { fontSize: 15, color: COLORS.textPrimary, fontStyle: 'italic', lineHeight: 21 },

  // Upcoming state
  upcomingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  upcomingIcon: { fontSize: 48, marginBottom: 16 },
  upcomingTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' },
  upcomingBody: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },

  // Feed
  feed: { flex: 1 },
  feedContent: { paddingHorizontal: 16, paddingTop: 12 },
  feedEmpty: { paddingVertical: 32, alignItems: 'center' },
  feedEmptyText: { fontSize: 14, color: COLORS.textMuted, fontStyle: 'italic' },

  // Bubbles
  bubbleRow: { marginBottom: 8, alignItems: 'flex-start' },
  bubbleRowMine: { alignItems: 'flex-end' },
  bubble: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 12,
    maxWidth: '78%',
    shadowColor: '#2C2825',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleMine: {
    backgroundColor: COLORS.quietSkyFaint,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleBody: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  bubbleBodyMine: {},
  bubbleTime: { fontSize: 10, color: COLORS.textMuted, marginTop: 4 },
  bubbleTimeMine: { textAlign: 'right' },

  // Ended banner
  endedBanner: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  endedBannerText: { fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic' },

  // Composer
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 32 : 10,
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
