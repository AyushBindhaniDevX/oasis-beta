import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import {
  GraduationCap,
  BookOpen,
  Award,
  CheckCircle2,
  Clock,
  PlayCircle,
  FileText,
  ChevronRight,
  TrendingUp,
} from 'lucide-react-native';

import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { getEmployeeByProfileId } from '@/lib/services/employee';
import {
  getCourses,
  getEnrollments,
  completeLesson,
} from '@/lib/services/learning';
import type {
  TrainingCourse,
  CourseEnrollment,
  CourseLesson,
} from '@/types/database';
import { InteractiveTile } from '@/components/ui/InteractiveTile';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/States';
import {
  STOCK_10_SVG,
} from '@/constants/workManagementSvgs';
import type { Employee } from '@/types';

const FONT = Platform.select({
  ios: 'System',
  android: 'Roboto',
  web: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}) as string;

export default function EmployeeLearningScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization, employee: tenantEmp } = useTenant();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'in_progress' | 'completed'>('all');

  // Lesson Viewer Modal
  const [activeCourse, setActiveCourse] = useState<TrainingCourse | null>(null);
  const [activeLesson, setActiveLesson] = useState<CourseLesson | null>(null);
  const [completingLesson, setCompletingLesson] = useState(false);
  const [certNotice, setCertNotice] = useState<string | null>(null);

  const activeOrgId = organization?.id || tenantEmp?.organization_id || profile?.organization_id;

  const loadData = async () => {
    if (!profile) return;
    try {
      const emp = tenantEmp || (await getEmployeeByProfileId(profile.id, activeOrgId));
      setEmployee(emp);

      const empId = emp?.id || profile.id;
      const [fetchedCourses, fetchedEnrollments] = await Promise.all([
        getCourses(activeOrgId),
        getEnrollments(empId),
      ]);

      setCourses(fetchedCourses);
      setEnrollments(fetchedEnrollments);
    } catch (e) {
      console.error('Error loading employee learning:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile, activeOrgId, tenantEmp]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const enrollmentMap = useMemo(() => {
    const map = new Map<string, CourseEnrollment>();
    enrollments.forEach((e) => map.set(e.course_id, e));
    return map;
  }, [enrollments]);

  const completedCount = useMemo(() => {
    return enrollments.filter((e) => e.is_completed || (e.progress_percent || 0) >= 100).length;
  }, [enrollments]);

  const inProgressCount = useMemo(() => {
    return enrollments.filter((e) => !e.is_completed && (e.progress_percent || 0) < 100).length;
  }, [enrollments]);

  const averageProgress = useMemo(() => {
    if (enrollments.length === 0) return 0;
    const total = enrollments.reduce((acc, e) => acc + (e.progress_percent || 0), 0);
    return Math.round(total / enrollments.length);
  }, [enrollments]);

  const filteredCourses = useMemo(() => {
    if (activeTab === 'in_progress') {
      return courses.filter((c) => {
        const enr = enrollmentMap.get(c.id);
        return enr && !enr.is_completed && (enr.progress_percent || 0) < 100;
      });
    }
    if (activeTab === 'completed') {
      return courses.filter((c) => {
        const enr = enrollmentMap.get(c.id);
        return enr && (enr.is_completed || (enr.progress_percent || 0) >= 100);
      });
    }
    return courses;
  }, [courses, activeTab, enrollmentMap]);

  const handleOpenCourse = (course: TrainingCourse) => {
    setActiveCourse(course);
    const firstLesson = course.curriculum?.[0]?.lessons?.[0];
    if (firstLesson) {
      setActiveLesson(firstLesson);
    }
  };

  const handleCompleteCurrentLesson = async () => {
    if (!activeCourse || !activeLesson) return;
    const enr = enrollmentMap.get(activeCourse.id);
    const enrollmentId = enr?.id || `enr_${Date.now()}`;

    let totalLessons = 0;
    activeCourse.curriculum?.forEach((mod: any) => {
      totalLessons += mod.lessons?.length || 0;
    });

    setCompletingLesson(true);
    try {
      const res = await completeLesson(enrollmentId, activeLesson.id, totalLessons || 1);
      if (res.isCompleted) {
        setCertNotice(`Congratulations! You completed ${activeCourse.title} and earned your certificate.`);
        setTimeout(() => setCertNotice(null), 5000);
      }
      await loadData();
    } catch (e) {
      console.error('Error completing lesson:', e);
      Alert.alert('Error', 'Unable to record lesson completion.');
    } finally {
      setCompletingLesson(false);
    }
  };

  if (loading) return <LoadingState />;

  const kpiCardWidth = isDesktop ? undefined : (width - 40 - 12) / 2;

  return (
    <ScrollView
      style={s.canvas}
      contentContainerStyle={[s.contentContainer, isDesktop && s.desktopContainer]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#7C3AED"
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header with STOCK 10 SVG ─────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(280)} style={s.headerRow}>
        <View style={{ flex: 1, minWidth: 260 }}>
          <View style={s.headerBadge}>
            <GraduationCap size={13} color="#7C3AED" />
            <Text style={s.headerBadgeText}>Enterprise LMS & Upskilling</Text>
          </View>
          <Text style={s.title}>Learning & Development</Text>
          <Text style={s.subtitle}>
            Compliance curricula, corporate training, certifications, and professional skills development.
          </Text>
        </View>

        <View style={{ opacity: 0.95 }}>
          <SvgXml xml={STOCK_10_SVG} width={isDesktop ? 120 : 90} height={isDesktop ? 86 : 64} />
        </View>
      </Animated.View>

      {/* Certificate Notice */}
      {certNotice ? (
        <View style={s.certNoticeBanner}>
          <Award size={18} color="#D97706" />
          <Text style={s.certNoticeText}>{certNotice}</Text>
        </View>
      ) : null}

      {/* ── 3 Pastel KPI Metric Cards ───────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(50).duration(280)} style={s.metricsGrid}>
        {/* Tile 1: Courses In Progress */}
        <InteractiveTile
          style={[
            s.metricCard,
            {
              backgroundColor: '#F3EEFE',
              borderColor: '#E4DCFD',
              flex: isDesktop ? 1 : undefined,
              width: kpiCardWidth,
            },
          ]}
          onPress={() => setActiveTab('in_progress')}
        >
          <View style={s.cardTopRow}>
            <View style={[s.iconBox, { backgroundColor: '#EDE9FE' }]}>
              <BookOpen size={18} color="#7C3AED" />
            </View>
            <Text style={[s.metricValueText, { color: '#1E1B4B' }]}>{inProgressCount}</Text>
          </View>
          <Text style={s.metricLabelText}>In Progress</Text>
          <Text style={s.metricSubText}>Active training tracks</Text>
        </InteractiveTile>

        {/* Tile 2: Certifications Earned */}
        <InteractiveTile
          style={[
            s.metricCard,
            {
              backgroundColor: '#EDFAF2',
              borderColor: '#CEF2DE',
              flex: isDesktop ? 1 : undefined,
              width: kpiCardWidth,
            },
          ]}
          onPress={() => setActiveTab('completed')}
        >
          <View style={s.cardTopRow}>
            <View style={[s.iconBox, { backgroundColor: '#D1FAE5' }]}>
              <Award size={18} color="#059669" />
            </View>
            <Text style={[s.metricValueText, { color: '#064E3B' }]}>{completedCount}</Text>
          </View>
          <Text style={s.metricLabelText}>Completed Certifications</Text>
          <Text style={s.metricSubText}>Verified achievements</Text>
        </InteractiveTile>

        {/* Tile 3: Average Completion */}
        <InteractiveTile
          style={[
            s.metricCard,
            {
              backgroundColor: '#EFF6FF',
              borderColor: '#DBEAFE',
              flex: isDesktop ? 1 : undefined,
              width: kpiCardWidth,
            },
          ]}
        >
          <View style={s.cardTopRow}>
            <View style={[s.iconBox, { backgroundColor: '#DBEAFE' }]}>
              <TrendingUp size={18} color="#2563EB" />
            </View>
            <Text style={[s.metricValueText, { color: '#1E3A8A' }]}>{averageProgress}%</Text>
          </View>
          <Text style={s.metricLabelText}>Curriculum Completion</Text>
          <Text style={s.metricSubText}>Across all enrolled courses</Text>
        </InteractiveTile>
      </Animated.View>

      {/* ── Filter Tabs ──────────────────────────────────────────────── */}
      <View style={s.tabsRow}>
        {[
          { id: 'all', label: `All Modules (${courses.length})` },
          { id: 'in_progress', label: `In Progress (${inProgressCount})` },
          { id: 'completed', label: `Completed (${completedCount})` },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[s.tabBtn, activeTab === tab.id && s.tabBtnActive]}
            onPress={() => setActiveTab(tab.id as any)}
          >
            <Text style={[s.tabBtnText, activeTab === tab.id && s.tabBtnTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Course Grid ──────────────────────────────────────────────── */}
      <View style={s.courseGrid}>
        {filteredCourses.map((course) => {
          const enr = enrollmentMap.get(course.id);
          const progress = enr?.progress_percent || 0;
          const isFinished = enr?.is_completed || progress >= 100;

          return (
            <View key={course.id} style={s.courseCard}>
              <View style={s.courseCardHeader}>
                <View style={s.categoryBadge}>
                  <Text style={s.categoryBadgeText}>{course.category.toUpperCase()}</Text>
                </View>
                {course.is_mandatory && (
                  <View style={s.mandatoryBadge}>
                    <Text style={s.mandatoryBadgeText}>MANDATORY</Text>
                  </View>
                )}
              </View>

              <Text style={s.courseTitle}>{course.title}</Text>
              <Text style={s.courseDesc} numberOfLines={3}>
                {course.description}
              </Text>

              {/* Course Meta */}
              <View style={s.courseMetaRow}>
                <View style={s.metaItem}>
                  <Clock size={13} color="#64748B" />
                  <Text style={s.metaText}>{course.duration_minutes || 60} mins</Text>
                </View>
                <View style={s.metaItem}>
                  <BookOpen size={13} color="#64748B" />
                  <Text style={s.metaText}>{course.modules_count || 1} Modules</Text>
                </View>
                {course.certificate_title && (
                  <View style={s.metaItem}>
                    <Award size={13} color="#7C3AED" />
                    <Text style={[s.metaText, { color: '#7C3AED', fontWeight: '700' }]}>
                      Certificate
                    </Text>
                  </View>
                )}
              </View>

              {/* Progress Bar */}
              <View style={s.progressSection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={s.progressLabel}>
                    {isFinished ? 'Completed' : progress > 0 ? 'Progress' : 'Not Started'}
                  </Text>
                  <Text style={s.progressPercent}>{progress}%</Text>
                </View>
                <View style={s.progressBarTrack}>
                  <View
                    style={[
                      s.progressBarFill,
                      { width: `${progress}%`, backgroundColor: isFinished ? '#10B981' : '#7C3AED' },
                    ]}
                  />
                </View>
              </View>

              {/* Action Button */}
              <TouchableOpacity
                style={[
                  s.launchCourseBtn,
                  isFinished ? { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' } : { backgroundColor: '#7C3AED' },
                ]}
                onPress={() => handleOpenCourse(course)}
                activeOpacity={0.85}
              >
                {isFinished ? (
                  <>
                    <CheckCircle2 size={15} color="#15803D" />
                    <Text style={[s.launchBtnText, { color: '#15803D' }]}>Review Curriculum</Text>
                  </>
                ) : (
                  <>
                    <PlayCircle size={15} color="#FFFFFF" />
                    <Text style={[s.launchBtnText, { color: '#FFFFFF' }]}>
                      {progress > 0 ? 'Continue Learning' : 'Start Course'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* ── MODAL: Lesson Content Viewer ────────────────────────────── */}
      <Modal
        visible={!!activeCourse}
        onClose={() => {
          setActiveCourse(null);
          setActiveLesson(null);
        }}
        title={activeCourse?.title || 'Course Player'}
        subtitle={activeCourse?.category || 'Curriculum'}
        size="lg"
        primaryAction={{
          label: completingLesson ? 'Saving...' : 'Mark Lesson Complete',
          onPress: handleCompleteCurrentLesson,
          loading: completingLesson,
          variant: 'primary',
        }}
        secondaryAction={{
          label: 'Close',
          onPress: () => {
            setActiveCourse(null);
            setActiveLesson(null);
          },
        }}
      >
        <View style={{ gap: 14 }}>
          {/* Active Lesson Header */}
          <View style={s.activeLessonCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {activeLesson?.type === 'video' ? (
                <PlayCircle size={20} color="#7C3AED" />
              ) : (
                <FileText size={20} color="#2563EB" />
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.activeLessonTitle}>{activeLesson?.title || 'Lesson Overview'}</Text>
                <Text style={s.activeLessonMeta}>
                  {activeLesson?.type?.toUpperCase()} · {activeLesson?.duration_minutes || 15} minutes
                </Text>
              </View>
            </View>
          </View>

          {/* Lesson Content Body */}
          <View style={s.lessonBodyBox}>
            <Text style={s.lessonBodyHeading}>Curriculum Material & Instructions</Text>
            <Text style={s.lessonBodyText}>
              {activeLesson?.content_markdown ||
                'This comprehensive lesson covers core operational frameworks, statutory compliance guidelines, and enterprise best practices. Please review all materials and click Mark Lesson Complete to update your progress.'}
            </Text>
          </View>

          {/* Curriculum Index */}
          <View>
            <Text style={s.curriculumIndexTitle}>Curriculum Lessons</Text>
            <View style={{ gap: 6, marginTop: 6 }}>
              {activeCourse?.curriculum?.map((mod: any, modIdx: number) => (
                <View key={mod.id || modIdx} style={s.curriculumModBox}>
                  <Text style={s.modHeaderTitle}>{mod.title}</Text>
                  {mod.lessons?.map((les: any, lesIdx: number) => {
                    const isSelected = activeLesson?.id === les.id;
                    return (
                      <TouchableOpacity
                        key={les.id || lesIdx}
                        style={[s.lessonItemBtn, isSelected && s.lessonItemBtnActive]}
                        onPress={() => setActiveLesson(les)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          {les.type === 'video' ? (
                            <PlayCircle size={14} color={isSelected ? '#7C3AED' : '#64748B'} />
                          ) : (
                            <FileText size={14} color={isSelected ? '#7C3AED' : '#64748B'} />
                          )}
                          <Text
                            style={[
                              s.lessonItemText,
                              isSelected && { color: '#7C3AED', fontWeight: '700' },
                            ]}
                            numberOfLines={1}
                          >
                            {les.title}
                          </Text>
                        </View>
                        <ChevronRight size={14} color={isSelected ? '#7C3AED' : '#94A3B8'} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: '#FAF9FD',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 110,
  },
  desktopContainer: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 28,
  },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    flexWrap: 'wrap',
    gap: 12,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3EEFE',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4DCFD',
    marginBottom: 6,
  },
  headerBadgeText: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  title: {
    fontFamily: FONT,
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 18,
  },

  /* Cert Notice */
  certNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  certNoticeText: {
    fontFamily: FONT,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },

  /* KPI Grid */
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  metricCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    minWidth: 160,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValueText: {
    fontFamily: FONT,
    fontSize: 24,
    fontWeight: '800',
  },
  metricLabelText: {
    fontFamily: FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8,
  },
  metricSubText: {
    fontFamily: FONT,
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  /* Filter Tabs */
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  tabBtnText: {
    fontFamily: FONT,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },

  /* Course Grid */
  courseGrid: {
    gap: 14,
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  courseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontFamily: FONT,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  mandatoryBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mandatoryBadgeText: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  courseTitle: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 22,
  },
  courseDesc: {
    fontFamily: FONT,
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  courseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontFamily: FONT,
    fontSize: 12,
    color: '#64748B',
  },
  progressSection: {
    marginTop: 14,
  },
  progressLabel: {
    fontFamily: FONT,
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  progressPercent: {
    fontFamily: FONT,
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  launchCourseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  launchBtnText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '700',
  },

  /* Modal */
  activeLessonCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeLessonTitle: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  activeLessonMeta: {
    fontFamily: FONT,
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  lessonBodyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  lessonBodyHeading: {
    fontFamily: FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  lessonBodyText: {
    fontFamily: FONT,
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },
  curriculumIndexTitle: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  curriculumModBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  modHeaderTitle: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  lessonItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lessonItemBtnActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F3EEFE',
  },
  lessonItemText: {
    fontFamily: FONT,
    fontSize: 12,
    color: '#334155',
  },
});
