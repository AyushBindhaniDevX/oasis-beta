import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Building2,
  MapPin,
  Clock,
  Briefcase,
  ChevronLeft,
  Share2,
  CheckCircle2,
  IndianRupee,
  ShieldCheck,
  Send,
  Sparkles,
  Award,
  HeartHandshake,
  GraduationCap,
  FileText,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react-native';
import { getJobById, submitJobApplication } from '@/lib/services/recruitment';
import type { JobOpening } from '@/types/database';

export default function JobDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [job, setJob] = useState<JobOpening | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Application Form States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentCity, setCurrentCity] = useState('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('Immediate / 15 Days');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [coverNote, setCoverNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (id) {
      setLoading(true);
      getJobById(id)
        .then((found) => {
          if (isMounted) {
            setJob(found || null);
            setLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleCopyLink = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } else {
      Alert.alert('Link Copied', 'Job link copied to clipboard.');
    }
  };

  const handleSubmitApplication = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
      Alert.alert('Validation Error', 'Please enter a valid contact phone number.');
      return;
    }
    if (!resumeUrl.trim()) {
      Alert.alert('Resume Required', 'Please provide a link to your resume or Google Drive/LinkedIn profile.');
      return;
    }

    setSubmitting(true);
    try {
      const expNum = parseFloat(experienceYears) || 0;
      const refCode = `APP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      await submitJobApplication({
        job_id: job?.id || id || 'general',
        organization_id: job?.organization_id || 'shanti-memorial-hospital',
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        current_location: currentCity.trim() || 'Cuttack, Odisha',
        current_company: currentCompany.trim() || 'Independent Professional',
        experience_years: expNum,
        notice_period_days: noticePeriod.includes('Immediate') ? 0 : 30,
        expected_salary: expectedSalary.trim() ? `₹${expectedSalary.trim()}` : 'Not disclosed',
        resume_url: resumeUrl.trim(),
        linkedin_url: linkedinUrl.trim() || undefined,
        scorecard_notes: coverNote.trim() ? `${coverNote.trim()} (Ref: ${refCode})` : `Ref: ${refCode}`,
        source: 'careers_portal',
      });

      setSubmittedRef(refCode);
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Could not submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={s.centerContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={s.loadingText}>Loading role details…</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={s.centerContainer}>
        <Building2 size={48} color="#94A3B8" />
        <Text style={s.notFoundTitle}>Position Not Found</Text>
        <Text style={s.notFoundSub}>This role may have been filled or the link has expired.</Text>
        <TouchableOpacity style={s.backBtnPrimary} onPress={() => router.push('/careers' as never)}>
          <ChevronLeft size={16} color="#FFF" />
          <Text style={s.backBtnPrimaryText}>Browse All Open Roles</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Submitted Success Screen
  if (submittedRef) {
    return (
      <ScrollView style={s.canvas} contentContainerStyle={s.successContainer}>
        <View style={s.successCard}>
          <View style={s.successIconBox}>
            <CheckCircle2 size={54} color="#10B981" />
          </View>
          <Text style={s.successTitle}>Application Submitted!</Text>
          <Text style={s.successSub}>
            Thank you for applying to <Text style={{ fontWeight: '700', color: '#1E293B' }}>{job.title}</Text> at{' '}
            <Text style={{ fontWeight: '700', color: '#7C3AED' }}>{job.location || 'Shanti Enterprise Group'}</Text>.
          </Text>

          <View style={s.refBox}>
            <Text style={s.refLabel}>APPLICATION REFERENCE</Text>
            <Text style={s.refValue}>{submittedRef}</Text>
            <Text style={s.refNote}>A confirmation email will be sent to {email}.</Text>
          </View>

          <View style={s.timelineInfoBox}>
            <Text style={s.timelineInfoTitle}>What happens next?</Text>
            <Text style={s.timelineInfoText}>
              1. Our clinical talent team reviews your credentials within 48-72 hours.{'\n'}
              2. If shortlisted, you will receive an invitation for initial HR screening.{'\n'}
              3. Track your status by referencing code <Text style={{ fontWeight: '700' }}>{submittedRef}</Text>.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' }}>
            <TouchableOpacity
              style={[s.btnPrimary, { flex: 1 }]}
              onPress={() => router.push('/careers' as never)}
            >
              <Text style={s.btnPrimaryText}>Explore More Roles</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.canvas} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Top Navigation Bar */}
      <View style={s.topNav}>
        <TouchableOpacity style={s.backLink} onPress={() => router.push('/careers' as never)} activeOpacity={0.7}>
          <ChevronLeft size={16} color="#6D28D9" />
          <Text style={s.backLinkText}>All Careers & Positions</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.shareBtn} onPress={handleCopyLink} activeOpacity={0.7}>
          {copiedLink ? <Check size={14} color="#10B981" /> : <Copy size={14} color="#6D28D9" />}
          <Text style={[s.shareBtnText, copiedLink && { color: '#10B981' }]}>
            {copiedLink ? 'Link Copied!' : 'Share Opening'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Header Hero Card */}
      <View style={s.heroCard}>
        <View style={s.badgeRow}>
          <View style={s.orgBadge}>
            <Building2 size={13} color="#7C3AED" />
            <Text style={s.orgBadgeText}>
              {job.location?.includes('Chikitsa')
                ? 'Chikitsa Unit'
                : job.location?.includes('Gopal')
                ? 'Gopal Trust Unit'
                : 'Shanti Memorial Hospital'}
            </Text>
          </View>

          <View style={s.verifiedBadge}>
            <ShieldCheck size={13} color="#059669" />
            <Text style={s.verifiedBadgeText}>Verified Employer</Text>
          </View>

          <View style={s.typeBadge}>
            <Clock size={12} color="#475569" />
            <Text style={s.typeBadgeText}>{job.type}</Text>
          </View>
        </View>

        <Text style={s.jobTitle}>{job.title}</Text>

        <View style={s.metaChipsRow}>
          <View style={s.metaChip}>
            <Briefcase size={14} color="#64748B" />
            <Text style={s.metaChipText}>{job.department}</Text>
          </View>

          <View style={s.metaChip}>
            <MapPin size={14} color="#64748B" />
            <Text style={s.metaChipText}>{job.location || 'Cuttack, Odisha'}</Text>
          </View>

          {job.experience_level && (
            <View style={s.metaChip}>
              <Award size={14} color="#64748B" />
              <Text style={s.metaChipText}>{job.experience_level} Experience</Text>
            </View>
          )}

          {job.salary_range && (
            <View style={[s.metaChip, s.salaryChip]}>
              <IndianRupee size={14} color="#059669" />
              <Text style={s.salaryChipText}>{job.salary_range}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Content Layout (Desktop = 2 Columns: Description & Form) */}
      <View style={[s.contentGrid, isDesktop && s.contentGridDesktop]}>
        {/* Left Column: Role Details & Perks */}
        <View style={[s.leftCol, isDesktop && { flex: 3 }]}>
          {/* About the Position */}
          <View style={s.sectionCard}>
            <Text style={s.sectionHeading}>About the Opportunity</Text>
            <Text style={s.bodyText}>
              {job.description ||
                'Join our dedicated healthcare team delivering patient-first medical excellence. In this role, you will work alongside esteemed clinicians, state-of-the-art diagnostic facilities, and multidisciplinary care protocols.'}
            </Text>
          </View>

          {/* Key Responsibilities */}
          {job.responsibilities && job.responsibilities.length > 0 && (
            <View style={s.sectionCard}>
              <Text style={s.sectionHeading}>Core Clinical Responsibilities</Text>
              <View style={{ gap: 8, marginTop: 4 }}>
                {job.responsibilities.map((resp: string, idx: number) => (
                  <View key={idx} style={s.bulletRow}>
                    <View style={s.bulletDot} />
                    <Text style={s.bulletText}>{resp}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Qualifications & Requirements */}
          {job.requirements && job.requirements.length > 0 && (
            <View style={s.sectionCard}>
              <Text style={s.sectionHeading}>Required Qualifications & Clinical Skills</Text>
              <View style={{ gap: 8, marginTop: 4 }}>
                {job.requirements.map((req: string, idx: number) => (
                  <View key={idx} style={s.bulletRow}>
                    <CheckCircle2 size={15} color="#7C3AED" style={{ marginTop: 2 }} />
                    <Text style={s.bulletText}>{req}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Perks & Benefits */}
          <View style={s.sectionCard}>
            <Text style={s.sectionHeading}>Perks & Comprehensive Hospital Benefits</Text>
            <View style={s.perksGrid}>
              <View style={s.perkItem}>
                <HeartHandshake size={20} color="#7C3AED" />
                <View>
                  <Text style={s.perkTitle}>Medical Cover</Text>
                  <Text style={s.perkSub}>Hospitalisation benefits for self & family</Text>
                </View>
              </View>

              <View style={s.perkItem}>
                <Clock size={20} color="#7C3AED" />
                <View>
                  <Text style={s.perkTitle}>Balanced Rotas</Text>
                  <Text style={s.perkSub}>Transparent shift planning & off-rotations</Text>
                </View>
              </View>

              <View style={s.perkItem}>
                <GraduationCap size={20} color="#7C3AED" />
                <View>
                  <Text style={s.perkTitle}>CME Allowance</Text>
                  <Text style={s.perkSub}>Conferences, training & certifications</Text>
                </View>
              </View>

              <View style={s.perkItem}>
                <Sparkles size={20} color="#7C3AED" />
                <View>
                  <Text style={s.perkTitle}>Provident Fund & Gratuity</Text>
                  <Text style={s.perkSub}>Statutory retirement savings & tenure bonus</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Right Column: Candidate Application Form */}
        <View style={[s.rightCol, isDesktop && { flex: 2.2 }]}>
          <View style={s.applyFormCard}>
            <View style={s.formHeader}>
              <Text style={s.formTitle}>Direct Application</Text>
              <Text style={s.formSub}>Takes under 2 minutes · No account required</Text>
            </View>

            <View style={{ gap: 14 }}>
              <View>
                <Text style={s.fieldLabel}>Full Name *</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="e.g. Dr. Ramesh Pattnaik"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View>
                <Text style={s.fieldLabel}>Email Address *</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="ramesh@gmail.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View>
                <Text style={s.fieldLabel}>Contact Phone *</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="+91 98765 43210"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Current City</Text>
                  <TextInput
                    style={s.textInput}
                    placeholder="Cuttack / Bhubaneswar"
                    value={currentCity}
                    onChangeText={setCurrentCity}
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Experience (Yrs)</Text>
                  <TextInput
                    style={s.textInput}
                    placeholder="3.5"
                    keyboardType="numeric"
                    value={experienceYears}
                    onChangeText={setExperienceYears}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View>
                <Text style={s.fieldLabel}>Current Hospital / Workplace</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="Apollo Hospitals / Private Clinic"
                  value={currentCompany}
                  onChangeText={setCurrentCompany}
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View>
                <Text style={s.fieldLabel}>Notice Period</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="Immediate / 15 Days / 1 Month"
                  value={noticePeriod}
                  onChangeText={setNoticePeriod}
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View>
                <Text style={s.fieldLabel}>Expected Monthly CTC (₹)</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="e.g. 75,000"
                  keyboardType="numeric"
                  value={expectedSalary}
                  onChangeText={setExpectedSalary}
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View>
                <Text style={s.fieldLabel}>Resume / CV Link *</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="https://drive.google.com/... or DropBox"
                  autoCapitalize="none"
                  value={resumeUrl}
                  onChangeText={setResumeUrl}
                  placeholderTextColor="#94A3B8"
                />
                <Text style={s.fieldHelp}>Paste Google Drive / Dropbox / PDF cloud share link</Text>
              </View>

              <View>
                <Text style={s.fieldLabel}>LinkedIn / Professional Profile</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="https://linkedin.com/in/username"
                  autoCapitalize="none"
                  value={linkedinUrl}
                  onChangeText={setLinkedinUrl}
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View>
                <Text style={s.fieldLabel}>Brief Note / Why You Fit</Text>
                <TextInput
                  style={[s.textInput, { height: 72, textAlignVertical: 'top' }]}
                  placeholder="Highlight key registrations, MCI status, or availability..."
                  multiline
                  numberOfLines={3}
                  value={coverNote}
                  onChangeText={setCoverNote}
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <TouchableOpacity
                style={[s.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSubmitApplication}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Send size={16} color="#FFF" />
                    <Text style={s.submitBtnText}>Submit Candidacy</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={s.privacyNote}>
                🔒 Your confidential information is securely submitted directly to the HR directorate.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 14,
  },
  notFoundSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
  },
  backBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 20,
  },
  backBtnPrimaryText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F3EEFE',
  },
  backLinkText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#6D28D9',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6D28D9',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  orgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  orgBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6D28D9',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  jobTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
    letterSpacing: -0.4,
  },
  metaChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  salaryChip: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  salaryChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  contentGrid: {
    gap: 20,
  },
  contentGridDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  leftCol: {
    gap: 16,
  },
  rightCol: {},
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7C3AED',
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },
  perksGrid: {
    gap: 12,
    marginTop: 6,
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  perkTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  perkSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  applyFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  formHeader: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  formSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 5,
  },
  fieldHelp: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 3,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  privacyNote: {
    fontSize: 10.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    maxWidth: 540,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  successIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  successSub: {
    fontSize: 13.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  refBox: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 18,
    width: '100%',
  },
  refLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.8,
  },
  refValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4C1D95',
    marginTop: 3,
    letterSpacing: 1,
  },
  refNote: {
    fontSize: 11,
    color: '#6D28D9',
    marginTop: 4,
  },
  timelineInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineInfoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  timelineInfoText: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 18,
  },
  btnPrimary: {
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
