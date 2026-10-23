import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { useTheme } from '@/hooks/use-theme';
import { LoadingState } from '@/components/ui/States';
import { getSurveys, submitSurveyResponse } from '@/lib/services/surveys';
import { PulseSurvey } from '@/types/database';
import {
  BarChart3,
  Smile,
  Heart,
  TrendingUp,
  Users,
  CheckCircle,
  Star,
} from 'lucide-react-native';

export default function SurveysScreen() {
  const colors = useTheme();
  const [surveys, setSurveys] = useState<PulseSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await getSurveys();
      setSurveys(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVote = async (id: string, score: number) => {
    await submitSurveyResponse(id, score);
    loadData();
  };

  if (loading) return <LoadingState />;

  return (
    <SidebarLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Pulse Surveys & eNPS</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Anonymous Employee Sentiment, Workplace Pulse & Engagement
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1, padding: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
        >
          <View style={{ gap: 16 }}>
            {surveys.map((survey) => (
              <View key={survey.id} style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{survey.type.toUpperCase()}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Users size={14} color="#64748B" />
                    <Text style={styles.subText}>{survey.responses_count} Responses</Text>
                  </View>
                </View>

                <Text style={styles.surveyTitle}>{survey.title}</Text>
                <Text style={styles.questionText}>{survey.question}</Text>

                <View style={styles.scoreRow}>
                  <Text style={styles.scoreNumber}>{survey.average_score}</Text>
                  <Text style={styles.scoreSub}>
                    {survey.type === 'enps_1_10' ? 'eNPS Score (Out of 10)' : 'Average Score (Out of 5.0)'}
                  </Text>
                </View>

                {survey.status === 'active' && (
                  <View style={styles.votingRow}>
                    <Text style={styles.votePrompt}>Submit Your Vote:</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <TouchableOpacity
                          key={n}
                          onPress={() => handleVote(survey.id, n)}
                          style={[styles.voteBtn, { flexDirection: 'row', alignItems: 'center', gap: 3 }]}
                        >
                          <Text style={styles.voteBtnText}>{n}</Text>
                          <Star size={12} color="#0D7377" fill="#0D7377" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  card: { backgroundColor: '#FFFFFF', padding: 22, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  badge: { backgroundColor: '#F0F7F7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#0D7377' },
  subText: { fontSize: 12, color: '#64748B' },
  surveyTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginTop: 12 },
  questionText: { fontSize: 14, color: '#475569', marginTop: 4, fontStyle: 'italic' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 14 },
  scoreNumber: { fontSize: 32, fontWeight: '800', color: '#0D7377' },
  scoreSub: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  votingRow: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  votePrompt: { fontSize: 12, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  voteBtn: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  voteBtnText: { fontSize: 12, fontWeight: '700', color: '#0D7377' },
});
