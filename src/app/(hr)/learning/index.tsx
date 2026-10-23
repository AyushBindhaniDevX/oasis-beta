import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { useTheme } from '@/hooks/use-theme';
import { LoadingState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import {
  getCourses,
  getEnrollments,
  createCourse,
  addLessonToCourse,
} from '@/lib/services/learning';
import {
  TrainingCourse,
  CourseEnrollment,
  LessonType,
} from '@/types/database';
import {
  GraduationCap,
  Award,
  BookOpen,
  Users,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Plus,
  Video,
  FileText,
  HelpCircle,
  Paperclip,
  X,
  Layers,
  Sparkles,
  Play,
  CornerDownRight,
} from 'lucide-react-native';

export default function HRLearningScreen() {
  const colors = useTheme();
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [selectedCourseForLesson, setSelectedCourseForLesson] = useState<TrainingCourse | null>(null);
  const [selectedCourseDetail, setSelectedCourseDetail] = useState<TrainingCourse | null>(null);

  // Course Form
  const [courseTitle, setCourseTitle] = useState('');
  const [courseCategory, setCourseCategory] = useState('Engineering & Architecture');
  const [courseDesc, setCourseDesc] = useState('');
  const [courseDuration, setCourseDuration] = useState('90');
  const [courseInstructor, setCourseInstructor] = useState('Ayush B. (Principal Architect)');
  const [courseCertTitle, setCourseCertTitle] = useState('Certified Subedge Specialist');
  const [isMandatory, setIsMandatory] = useState(false);

  // Lesson Form
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonType, setLessonType] = useState<LessonType>('video');
  const [lessonDuration, setLessonDuration] = useState('15');
  const [lessonVideoUrl, setLessonVideoUrl] = useState('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
  const [lessonMarkdown, setLessonMarkdown] = useState('');
  const [lessonAttachmentName, setLessonAttachmentName] = useState('');
  const [lessonAttachmentUrl, setLessonAttachmentUrl] = useState('');

  const loadData = async () => {
    try {
      const [c, e] = await Promise.all([getCourses(), getEnrollments()]);
      setCourses(c);
      setEnrollments(e);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCourse = async () => {
    if (!courseTitle.trim()) return;
    await createCourse({
      organization_id: 'subedge_org',
      title: courseTitle,
      category: courseCategory,
      description: courseDesc || 'Enterprise training curriculum.',
      duration_minutes: parseInt(courseDuration) || 60,
      modules_count: 1,
      is_mandatory: isMandatory,
      instructor: courseInstructor,
      rating: 4.9,
      enrolled_count: 1,
      certificate_title: courseCertTitle,
      pass_percentage: 80,
      curriculum: [
        {
          id: `mod_${Date.now()}`,
          title: 'Section 1: Core Fundamentals & Directives',
          description: 'Introductory concepts and foundational architecture.',
          lessons: [
            {
              id: `les_${Date.now()}`,
              title: 'Welcome & Curriculum Overview',
              type: 'article',
              duration_minutes: 10,
              content_markdown: '### Overview\nWelcome to this professional course at Subedge Technology.',
              order: 1,
            },
          ],
        },
      ],
    });

    setCourseTitle('');
    setCourseDesc('');
    setShowCourseModal(false);
    loadData();
  };

  const handleAddLessonSubmit = async () => {
    if (!selectedCourseForLesson || !lessonTitle.trim()) return;
    const modId = selectedCourseForLesson.curriculum?.[0]?.id || `mod_${Date.now()}`;
    await addLessonToCourse(selectedCourseForLesson.id, modId, {
      title: lessonTitle,
      type: lessonType,
      duration_minutes: parseInt(lessonDuration) || 15,
      video_url: lessonType === 'video' ? lessonVideoUrl : undefined,
      content_markdown: lessonMarkdown || '### Lesson Content\nFollow the instructions and guidelines outlined.',
      attachment_name: lessonAttachmentName || undefined,
      attachment_url: lessonAttachmentUrl || undefined,
      order: 2,
    });

    setLessonTitle('');
    setLessonMarkdown('');
    setLessonAttachmentName('');
    setLessonAttachmentUrl('');
    setSelectedCourseForLesson(null);
    loadData();
  };

  if (loading) return <LoadingState />;

  const completedCount = enrollments.filter((e) => e.is_completed).length;

  return (
    <SidebarLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.title, { color: colors.text }]}>Corporate Academy & L&D Management</Text>
              <View style={styles.proBadge}>
                <Sparkles size={11} color="#0D7377" />
                <Text style={styles.proBadgeText}>MOODLE / LMS BUILDER</Text>
              </View>
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Author Video Lectures, Rich Articles, PDF Handbooks, Quizzes & Issue Certificates
            </Text>
          </View>

          <Button
            title="+ Author New Course"
            onPress={() => setShowCourseModal(true)}
            style={{ backgroundColor: '#0D7377' }}
            size="sm"
          />
        </View>

        <ScrollView
          style={{ flex: 1, padding: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
        >
          {/* Stats Bar */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Academy Courses</Text>
              <Text style={styles.statNumber}>{courses.length}</Text>
              <Text style={styles.statSub}>Rich Video & Reading Tracks</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Active Learners</Text>
              <Text style={[styles.statNumber, { color: '#0D7377' }]}>58</Text>
              <Text style={styles.statSub}>Enrolled team members</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Accreditations Awarded</Text>
              <Text style={[styles.statNumber, { color: '#10B981' }]}>{completedCount + 48}</Text>
              <Text style={styles.statSub}>Verifiable Certificates</Text>
            </View>
          </View>

          {/* Courses List */}
          <Text style={styles.sectionTitle}>Curated Course Catalog ({courses.length})</Text>
          <View style={styles.courseGrid}>
            {courses.map((course) => {
              const totalLessons = course.curriculum?.reduce((acc, m) => acc + (m.lessons?.length || 0), 0) || course.modules_count;
              return (
                <View key={course.id} style={styles.courseCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={styles.courseIconBox}>
                      {course.is_mandatory ? (
                        <ShieldCheck size={24} color="#0D7377" />
                      ) : (
                        <GraduationCap size={24} color="#0D7377" />
                      )}
                    </View>
                    {course.is_mandatory && (
                      <View style={styles.mandatoryBadge}>
                        <Text style={styles.mandatoryText}>MANDATORY</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.courseTitle}>{course.title}</Text>
                  <Text style={styles.courseCategory}>{course.category}</Text>
                  <Text style={styles.courseDesc}>{course.description}</Text>

                  {/* Modules & Lessons Count */}
                  <View style={styles.metaRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} color="#64748B" />
                      <Text style={styles.metaText}>{course.duration_minutes} mins</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <BookOpen size={13} color="#64748B" />
                      <Text style={styles.metaText}>{totalLessons} Lessons</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Users size={13} color="#64748B" />
                      <Text style={styles.metaText}>{course.enrolled_count} Enrolled</Text>
                    </View>
                  </View>

                  {/* Curriculum Preview Accordion */}
                  {course.curriculum && (
                    <View style={styles.curriculumPreview}>
                      <Text style={styles.curriculumHeading}>Curriculum Modules:</Text>
                      {course.curriculum.map((mod) => (
                        <View key={mod.id} style={{ marginTop: 4 }}>
                          <Text style={styles.modTitle}>• {mod.title}</Text>
                          {mod.lessons.map((les) => (
                            <View key={les.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 16 }}>
                              <CornerDownRight size={12} color="#64748B" />
                              <Text style={styles.lesTitle}>
                                [{les.type.toUpperCase()}] {les.title} ({les.duration_minutes}m)
                              </Text>
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => setSelectedCourseForLesson(course)}
                      style={styles.addLessonBtn}
                    >
                      <Plus size={13} color="#0D7377" />
                      <Text style={styles.addLessonText}>+ Add Material / Video / Quiz</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Modal 1: Create Course */}
        <Modal visible={showCourseModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Author New LMS Course Track</Text>
                <TouchableOpacity onPress={() => setShowCourseModal(false)}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ padding: 20 }}>
                <Text style={styles.label}>Course Title *</Text>
                <TextInput style={styles.input} placeholder="e.g. Advanced TypeScript & Clean Architecture" value={courseTitle} onChangeText={setCourseTitle} />

                <Text style={styles.label}>Category</Text>
                <TextInput style={styles.input} value={courseCategory} onChangeText={setCourseCategory} />

                <Text style={styles.label}>Course Description & Learning Outcomes</Text>
                <TextInput style={[styles.input, { height: 75 }]} multiline value={courseDesc} onChangeText={setCourseDesc} />

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Total Minutes</Text>
                    <TextInput style={styles.input} value={courseDuration} onChangeText={setCourseDuration} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Instructor</Text>
                    <TextInput style={styles.input} value={courseInstructor} onChangeText={setCourseInstructor} />
                  </View>
                </View>

                <Text style={styles.label}>Completion Certificate Title</Text>
                <TextInput style={styles.input} value={courseCertTitle} onChangeText={setCourseCertTitle} />

                <TouchableOpacity
                  onPress={() => setIsMandatory(!isMandatory)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}
                >
                  <View style={[styles.checkSquare, isMandatory && { backgroundColor: '#0D7377' }]}>
                    {isMandatory && <CheckCircle2 size={14} color="#FFF" />}
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A2E' }}>Mark as Mandatory Compliance Training</Text>
                </TouchableOpacity>

                <Button title="Publish Course to LMS Academy" onPress={handleCreateCourse} style={{ backgroundColor: '#0D7377', marginTop: 20 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Modal 2: Add Lesson / Video / Material */}
        {selectedCourseForLesson && (
          <Modal visible={!!selectedCourseForLesson} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add Lesson to: {selectedCourseForLesson.title}</Text>
                  <TouchableOpacity onPress={() => setSelectedCourseForLesson(null)}>
                    <X size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ padding: 20 }}>
                  <Text style={styles.label}>Lesson Title *</Text>
                  <TextInput style={styles.input} placeholder="e.g. Masterclass: Event Streams & WebSockets" value={lessonTitle} onChangeText={setLessonTitle} />

                  <Text style={styles.label}>Material Type</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    {(['video', 'article', 'document', 'quiz'] as LessonType[]).map((t) => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setLessonType(t)}
                        style={[styles.typeChip, lessonType === t && styles.typeChipActive]}
                      >
                        <Text style={[styles.typeChipText, lessonType === t && { color: '#FFF' }]}>{t.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {lessonType === 'video' && (
                    <View>
                      <Text style={styles.label}>Video Embed / MP4 Cloud Stream URL</Text>
                      <TextInput style={styles.input} value={lessonVideoUrl} onChangeText={setLessonVideoUrl} />
                    </View>
                  )}

                  {lessonType === 'document' && (
                    <View>
                      <Text style={styles.label}>Attachment Name (PDF / Slide)</Text>
                      <TextInput style={styles.input} placeholder="e.g. Architecture_Slides_2026.pdf" value={lessonAttachmentName} onChangeText={setLessonAttachmentName} />
                      <Text style={styles.label}>Cloud Download URL</Text>
                      <TextInput style={styles.input} placeholder="https://..." value={lessonAttachmentUrl} onChangeText={setLessonAttachmentUrl} />
                    </View>
                  )}

                  <Text style={styles.label}>Lesson Reading Content / Handbook Markdown</Text>
                  <TextInput
                    style={[styles.input, { height: 90 }]}
                    multiline
                    placeholder="### Overview&#10;Key directives, takeaways, and source code..."
                    value={lessonMarkdown}
                    onChangeText={setLessonMarkdown}
                  />

                  <Button title="Save Lesson to Course" onPress={handleAddLessonSubmit} style={{ backgroundColor: '#0D7377', marginTop: 18 }} />
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  proBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0F7F7', borderWidth: 1, borderColor: '#CCECEC', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  proBadgeText: { color: '#0D7377', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', padding: 18, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  statNumber: { fontSize: 26, fontWeight: '800', marginVertical: 4, color: '#1A1A2E' },
  statSub: { fontSize: 11, color: '#94A3B8' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 14 },
  courseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  courseCard: { width: '48%', minWidth: 320, backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  courseIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0F7F7', alignItems: 'center', justifyContent: 'center' },
  mandatoryBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  mandatoryText: { fontSize: 10, fontWeight: '800', color: '#DC2626' },
  courseTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginTop: 14 },
  courseCategory: { fontSize: 12, color: '#0D7377', fontWeight: '700', marginTop: 2 },
  courseDesc: { fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 18 },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  metaText: { fontSize: 12, color: '#64748B' },
  curriculumPreview: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  curriculumHeading: { fontSize: 12, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  modTitle: { fontSize: 12, fontWeight: '700', color: '#0D7377', marginTop: 2 },
  lesTitle: { fontSize: 11, color: '#475569', marginTop: 2 },
  cardActions: { marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  addLessonBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F0F7F7', paddingVertical: 8, borderRadius: 8 },
  addLessonText: { fontSize: 12, fontWeight: '700', color: '#0D7377' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 520, maxHeight: '90%', backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A2E' },
  label: { fontSize: 12, fontWeight: '700', color: '#1A1A2E', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1A1A2E', backgroundColor: '#F8FAFC' },
  checkSquare: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  typeChip: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center' },
  typeChipActive: { backgroundColor: '#0D7377' },
  typeChipText: { fontSize: 10, fontWeight: '800', color: '#64748B' },
});
