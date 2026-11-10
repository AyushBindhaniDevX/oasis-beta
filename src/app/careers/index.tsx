import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Briefcase,
  MapPin,
  Clock,
  Search,
  Building2,
  ChevronRight,
  CheckCircle2,
  X,
  FileText,
  Mail,
  Phone,
  User,
  ArrowRight,
  Sparkles,
  Award,
  DollarSign,
  Share2,
  Calendar,
  Layers,
  Filter,
  Check,
  Send,
  HelpCircle,
  Shield,
  Zap,
} from 'lucide-react-native';
import { getJobs, submitJobApplication, getCandidates } from '@/lib/services/recruitment';
import type { JobOpening, Candidate, CandidateStage } from '@/types/database';

export default function PublicCareersPortal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [selectedUnit, setSelectedUnit] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');

  // Selected Job for Detailed View / Application
  const [selectedJob, setSelectedJob] = useState<JobOpening | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [appReferenceCode, setAppReferenceCode] = useState('');

  // Application Form Fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formExperience, setFormExperience] = useState('3');
  const [formNoticePeriod, setFormNoticePeriod] = useState('30');
  const [formExpectedSalary, setFormExpectedSalary] = useState('');
  const [formResumeUrl, setFormResumeUrl] = useState('');
  const [formLinkedinUrl, setFormLinkedinUrl] = useState('');
  const [formPortfolioUrl, setFormPortfolioUrl] = useState('');
  const [formCoverNote, setFormCoverNote] = useState('');
  const [formError, setFormError] = useState('');

  // Track Application Modal
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [trackQuery, setTrackQuery] = useState('');
  const [trackedCandidate, setTrackedCandidate] = useState<Candidate | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackError, setTrackError] = useState('');

  useEffect(() => {
    async function loadPublishedJobs() {
      try {
        const data = await getJobs();
        const publishedOnly = data.filter((j) => j.status === 'published');
        setJobs(publishedOnly.length > 0 ? publishedOnly : data);
      } catch (err) {
        console.error('Failed to load published jobs:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPublishedJobs();
  }, []);

  // Department List
  const departments = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.department) set.add(j.department);
    });
    return ['All', ...Array.from(set)];
  }, [jobs]);

  // Unit / Location List
  const locations = useMemo(() => {
    return [
      'All',
      'Shanti Memorial Hospital - Cuttack',
      'Chikitsa',
      'Gopal Trust',
      'Bengaluru Tech Hub',
      'Remote',
    ];
  }, []);

  // Filtered Job Openings
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        job.title.toLowerCase().includes(q) ||
        job.department.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q) ||
        (job.skills || []).some((s) => s.toLowerCase().includes(q));

      const matchDept = selectedDept === 'All' || job.department.toLowerCase() === selectedDept.toLowerCase();

      const matchUnit =
        selectedUnit === 'All' ||
        job.location.toLowerCase().includes(selectedUnit.toLowerCase()) ||
        (selectedUnit === 'Remote' && (job.type === 'remote' || job.location.toLowerCase().includes('remote')));

      const matchType =
        selectedType === 'All' ||
        (selectedType === 'Full-Time' && (job.type === 'full-time' || (job as any).employment_type === 'Regular')) ||
        (selectedType === 'Contractual' && (job.type === 'contract' || (job as any).employment_type === 'Contractual')) ||
        (selectedType === 'Remote' && (job.type === 'remote' || job.type === 'hybrid'));

      return matchSearch && matchDept && matchUnit && matchType;
    });
  }, [jobs, search, selectedDept, selectedUnit, selectedType]);

  const handleOpenJob = (job: JobOpening) => {
    setSelectedJob(job);
    setIsApplying(false);
    setSubmitSuccess(false);
    setFormError('');
  };

  const handleStartApply = () => {
    setIsApplying(true);
    setSubmitSuccess(false);
    setFormError('');
  };

  const handleSubmitApplication = async () => {
    if (!formName.trim() || !formEmail.trim() || !formPhone.trim()) {
      setFormError('Please enter your Name, Email Address, and Phone Number.');
      return;
    }
    if (!formEmail.includes('@') || !formEmail.includes('.')) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (!selectedJob) return;

    setSubmitting(true);
    setFormError('');

    try {
      const refCode = `APP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      setAppReferenceCode(refCode);

      await submitJobApplication({
        job_id: selectedJob.id,
        organization_id: selectedJob.organization_id || 'shanti-memorial-hospital',
        full_name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        phone: formPhone.trim(),
        current_location: formLocation.trim() || undefined,
        current_company: formCompany.trim() || 'Confidential',
        experience_years: parseFloat(formExperience) || 2,
        notice_period_days: parseInt(formNoticePeriod, 10) || 30,
        expected_salary: formExpectedSalary.trim() || 'Negotiable',
        resume_url: formResumeUrl.trim() || undefined,
        linkedin_url: formLinkedinUrl.trim() || undefined,
        portfolio_url: formPortfolioUrl.trim() || undefined,
        skills: selectedJob.skills || [],
        source: 'Public Careers Portal',
        knockout_passed: true,
        scorecard_notes: formCoverNote.trim() || undefined,
      });

      setSubmitSuccess(true);
      setIsApplying(false);
    } catch (err: any) {
      console.error('Failed to submit application:', err);
      setFormError(err.message || 'Could not submit your application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackApplication = async () => {
    if (!trackQuery.trim()) {
      setTrackError('Please enter your Application Reference Code or registered Email.');
      return;
    }
    setTrackingLoading(true);
    setTrackError('');
    setTrackedCandidate(null);

    try {
      const allCandidates = await getCandidates();
      const q = trackQuery.trim().toLowerCase();
      const found = allCandidates.find(
        (c) =>
          c.id.toLowerCase() === q ||
          c.email.toLowerCase() === q ||
          (c.phone && c.phone.replace(/\D/g, '').includes(q))
      );

      if (found) {
        setTrackedCandidate(found);
      } else {
        setTrackError('No active application found matching that reference code or email address.');
      }
    } catch (err: any) {
      setTrackError('Failed to lookup application. Please try again.');
    } finally {
      setTrackingLoading(false);
    }
  };

  const getStageDisplay = (stage: CandidateStage) => {
    switch (stage) {
      case 'applied':
        return { label: 'Application Received', step: 1, color: '#3B82F6', desc: 'Your profile has been received and queued for initial recruiter review.' };
      case 'screening':
        return { label: 'In Profile Screening', step: 2, color: '#D97706', desc: 'Our talent team is verifying qualification criteria and role alignment.' };
      case 'assessment':
      case 'interview':
      case 'hr_round':
        return { label: 'Interview Scheduled', step: 3, color: '#0D7377', desc: 'You have been shortlisted for technical and managerial interview rounds.' };
      case 'offer':
      case 'pre_joining':
        return { label: 'Offer Extended', step: 4, color: '#8B5CF6', desc: 'Congratulations! An official offer letter has been generated for your review.' };
      case 'hired':
        return { label: 'Successfully Onboarded', step: 5, color: '#10B981', desc: 'Welcome aboard! Your employee profile and system access are active.' };
      case 'rejected':
      case 'talent_pool':
        return { label: 'Archived for Future Roles', step: 2, color: '#64748B', desc: 'This requisition has concluded. Your credentials are saved in our talent pool for upcoming openings.' };
      default:
        return { label: 'Under Review', step: 1, color: '#3B82F6', desc: 'Application is being processed by the hiring team.' };
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
      <View style={[styles.navBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.navContent}>
          <TouchableOpacity
            style={styles.brandRow}
            onPress={() => {
              setSelectedJob(null);
              setIsApplying(false);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.logoBadge}>
              <Sparkles size={18} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.brandTitle}>Oasis Careers</Text>
              <Text style={styles.brandSub}>Talent & Operational Hiring Portal</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.navActions}>
            <TouchableOpacity
              style={styles.trackNavBtn}
              onPress={() => {
                setShowTrackModal(true);
                setTrackError('');
                setTrackedCandidate(null);
              }}
              activeOpacity={0.8}
            >
              <Search size={14} color="#0D7377" />
              <Text style={styles.trackNavText}>Track Application</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.portalLoginBtn}
              onPress={() => router.push('/(auth)/login' as never)}
              activeOpacity={0.8}
            >
              <User size={14} color="#FFFFFF" />
              <Text style={styles.portalLoginText}>Staff Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Banner ──────────────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <View style={styles.heroTagPill}>
            <View style={styles.heroPulseDot} />
            <Text style={styles.heroTagText}>NOW HIRING · {jobs.length} ACTIVE REQUISITIONS</Text>
          </View>

          <Text style={styles.heroHeading}>
            Build Your Career With Purpose.
          </Text>
          <Text style={styles.heroSubtitle}>
            Join our mission across Shanti Memorial Hospital, Chikitsa, Gopal Trust, and Subedge Technology hubs. Explore clinical, operational, and software roles.
          </Text>

          {/* Quick Stats Strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statBox}>
              <Award size={18} color="#0D7377" />
              <View>
                <Text style={styles.statNumber}>Top Benefits</Text>
                <Text style={styles.statLabel}>Health Cover & PF</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Building2 size={18} color="#0D7377" />
              <View>
                <Text style={styles.statNumber}>3 Operational Units</Text>
                <Text style={styles.statLabel}>Cuttack & Bengaluru</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Zap size={18} color="#0D7377" />
              <View>
                <Text style={styles.statNumber}>Fast Review</Text>
                <Text style={styles.statLabel}>48h HR Feedback</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Search & Filter Controls ─────────────────────────────────── */}
        <View style={styles.filterSection}>
          {/* Search Box */}
          <View style={styles.searchContainer}>
            <Search size={18} color="#64748B" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by job title, department, or required skill (e.g., React, Clinical, Nurse)..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearchBtn}>
                <X size={15} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>

          {/* Location / Unit Pills */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>LOCATION & UNIT:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
              {locations.map((loc) => (
                <TouchableOpacity
                  key={loc}
                  style={[
                    styles.filterPill,
                    selectedUnit === loc && styles.filterPillActive,
                  ]}
                  onPress={() => setSelectedUnit(loc)}
                  activeOpacity={0.8}
                >
                  <MapPin size={12} color={selectedUnit === loc ? '#FFFFFF' : '#475569'} />
                  <Text style={[styles.filterPillText, selectedUnit === loc && styles.filterPillTextActive]}>
                    {loc}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Department Pills */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>DEPARTMENT:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
              {departments.map((dept) => (
                <TouchableOpacity
                  key={dept}
                  style={[
                    styles.filterPill,
                    selectedDept === dept && styles.filterPillActive,
                  ]}
                  onPress={() => setSelectedDept(dept)}
                  activeOpacity={0.8}
                >
                  <Briefcase size={12} color={selectedDept === dept ? '#FFFFFF' : '#475569'} />
                  <Text style={[styles.filterPillText, selectedDept === dept && styles.filterPillTextActive]}>
                    {dept}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* ── Job Openings Count Header ────────────────────────────────── */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCountText}>
            Showing <Text style={{ fontWeight: '800', color: '#0F172A' }}>{filteredJobs.length}</Text> open opportunities
          </Text>
          <View style={styles.typeSelectorRow}>
            {['All', 'Full-Time', 'Contractual', 'Remote'].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setSelectedType(t)}
                style={[styles.typePill, selectedType === t && styles.typePillActive]}
              >
                <Text style={[styles.typePillText, selectedType === t && styles.typePillTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Job Cards Grid ───────────────────────────────────────────── */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0D7377" />
            <Text style={styles.loadingText}>Fetching available career opportunities...</Text>
          </View>
        ) : filteredJobs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Briefcase size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No positions match your search</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your search terms or filters to see more open roles.
            </Text>
            <TouchableOpacity
              style={styles.resetFilterBtn}
              onPress={() => {
                setSearch('');
                setSelectedDept('All');
                setSelectedUnit('All');
                setSelectedType('All');
              }}
            >
              <Text style={styles.resetFilterText}>Reset All Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.jobGrid, isDesktop && styles.jobGridDesktop]}>
            {filteredJobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                style={styles.jobCard}
                onPress={() => handleOpenJob(job)}
                activeOpacity={0.88}
              >
                {/* Top Row: Department & Priority */}
                <View style={styles.jobCardTop}>
                  <View style={styles.deptBadge}>
                    <Text style={styles.deptBadgeText}>{job.department}</Text>
                  </View>
                  {job.priority === 'urgent' && (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.urgentBadgeText}>URGENT HIRING</Text>
                    </View>
                  )}
                </View>

                {/* Job Title */}
                <Text style={styles.jobTitleText} numberOfLines={2}>
                  {job.title}
                </Text>

                {/* Location & Experience Row */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <MapPin size={13} color="#64748B" />
                    <Text style={styles.metaItemText} numberOfLines={1}>
                      {job.location}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Clock size={13} color="#64748B" />
                    <Text style={styles.metaItemText}>
                      {job.experience_level || '2+ Yrs'}
                    </Text>
                  </View>
                </View>

                {/* Salary Package */}
                {job.salary_range ? (
                  <View style={styles.salaryBadge}>
                    <Text style={styles.salaryBadgeText}>
                      {job.salary_range}
                    </Text>
                  </View>
                ) : null}

                {/* Description Snippet */}
                <Text style={styles.jobDescSnippet} numberOfLines={2}>
                  {job.description}
                </Text>

                {/* Skills Tags */}
                {job.skills && job.skills.length > 0 && (
                  <View style={styles.skillsTagRow}>
                    {job.skills.slice(0, 3).map((sk) => (
                      <View key={sk} style={styles.skillChip}>
                        <Text style={styles.skillChipText}>{sk}</Text>
                      </View>
                    ))}
                    {job.skills.length > 3 && (
                      <View style={styles.skillChipMore}>
                        <Text style={styles.skillChipMoreText}>+{job.skills.length - 3}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Card Footer: Apply Action */}
                <View style={styles.jobCardFooter}>
                  <View style={styles.positionsPill}>
                    <Text style={styles.positionsText}>
                      {job.positions_count ? `${job.positions_count} Openings` : 'Immediate Opening'}
                    </Text>
                  </View>

                  <View style={styles.applyArrowBtn}>
                    <Text style={styles.applyArrowText}>View & Apply</Text>
                    <ArrowRight size={14} color="#0D7377" />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Footer Branding ──────────────────────────────────────────── */}
        <View style={styles.footerSection}>
          <Text style={styles.footerBrand}>Oasis Talent Acquisition & HRMS</Text>
          <Text style={styles.footerSub}>
            Operating under Shanti Memorial Hospital, Chikitsa, Gopal Trust & Subedge Technology Pvt Ltd.
          </Text>
          <Text style={styles.footerCopyright}>
            © 2026 Oasis Platform. All Rights Reserved. Equal Opportunity Employer.
          </Text>
        </View>
      </ScrollView>

      {/* ── Job Details & Application Modal ────────────────────────────── */}
      <Modal
        visible={Boolean(selectedJob)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedJob(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.jobModalCard, isDesktop && styles.jobModalCardDesktop]}>
            {/* Modal Header */}
            <View style={styles.jobModalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <View style={styles.deptBadge}>
                    <Text style={styles.deptBadgeText}>{selectedJob?.department}</Text>
                  </View>
                  <View style={[styles.deptBadge, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 0.5 }]}>
                    <Text style={[styles.deptBadgeText, { color: '#15803D' }]}>{selectedJob?.type}</Text>
                  </View>
                </View>
                <Text style={styles.jobModalTitle}>{selectedJob?.title}</Text>
                <Text style={styles.jobModalSubtitle}>
                  {selectedJob?.location} · {selectedJob?.experience_level}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedJob(null)}
                style={styles.modalCloseCircle}
                activeOpacity={0.7}
              >
                <X size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView style={styles.jobModalScroll} showsVerticalScrollIndicator={false}>
              {submitSuccess ? (
                <View style={styles.successWrapper}>
                  <View style={styles.successIconCircle}>
                    <CheckCircle2 size={52} color="#059669" />
                  </View>
                  <Text style={styles.successTitle}>Application Submitted Successfully!</Text>
                  <Text style={styles.successSub}>
                    Thank you for applying to <Text style={{ fontWeight: '700' }}>{selectedJob?.title}</Text>. Your application has been logged into our talent database.
                  </Text>

                  <View style={styles.refCodeBox}>
                    <Text style={styles.refCodeLabel}>APPLICATION REFERENCE CODE</Text>
                    <Text style={styles.refCodeValue}>{appReferenceCode}</Text>
                    <Text style={styles.refCodeHelp}>
                      Save this reference code to track your interview stage progression.
                    </Text>
                  </View>

                  <View style={styles.successTimelineBox}>
                    <Text style={styles.timelineBoxTitle}>Next Steps:</Text>
                    <Text style={styles.timelineStepText}>1. Recruiter credential and resume verification (within 48 hours).</Text>
                    <Text style={styles.timelineStepText}>2. Live technical or clinical discovery round invitation via Google Meet.</Text>
                    <Text style={styles.timelineStepText}>3. You will receive email notifications at <Text style={{ fontWeight: '700' }}>{formEmail}</Text>.</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => setSelectedJob(null)}
                  >
                    <Text style={styles.doneBtnText}>Return to Career Portal</Text>
                  </TouchableOpacity>
                </View>
              ) : isApplying ? (
                /* ── Application Form ─────────────────────────────────── */
                <View style={styles.formContainer}>
                  <Text style={styles.formSectionHeading}>Candidate Information</Text>
                  <Text style={styles.formSectionSub}>
                    Fill out your profile details. Our hiring panel reviews all submissions directly.
                  </Text>

                  {formError ? (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorBannerText}>{formError}</Text>
                    </View>
                  ) : null}

                  {/* Name & Email */}
                  <View style={styles.formRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Full Name *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. Dr. Ramesh Mohapatra"
                        value={formName}
                        onChangeText={setFormName}
                      />
                    </View>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Email Address *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="ramesh@example.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={formEmail}
                        onChangeText={setFormEmail}
                      />
                    </View>
                  </View>

                  {/* Phone & Location */}
                  <View style={styles.formRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Mobile Phone *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="+91 98765 43210"
                        keyboardType="phone-pad"
                        value={formPhone}
                        onChangeText={setFormPhone}
                      />
                    </View>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Current City / Location</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. Cuttack, Odisha"
                        value={formLocation}
                        onChangeText={setFormLocation}
                      />
                    </View>
                  </View>

                  {/* Experience & Notice Period */}
                  <View style={styles.formRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Total Experience (Years)</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. 5"
                        keyboardType="numeric"
                        value={formExperience}
                        onChangeText={setFormExperience}
                      />
                    </View>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Notice Period (Days)</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. 15 or 30"
                        keyboardType="numeric"
                        value={formNoticePeriod}
                        onChangeText={setFormNoticePeriod}
                      />
                    </View>
                  </View>

                  {/* Current Company & Expected CTC */}
                  <View style={styles.formRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Current Employer / Hospital</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. Apollo Hospital or TCS"
                        value={formCompany}
                        onChangeText={setFormCompany}
                      />
                    </View>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Expected CTC / Compensation</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. ₹12,00,000 / year"
                        value={formExpectedSalary}
                        onChangeText={setFormExpectedSalary}
                      />
                    </View>
                  </View>

                  {/* Resume URL / Cloud Drive */}
                  <View style={{ marginBottom: 14 }}>
                    <Text style={styles.inputLabel}>Resume / CV Link (Google Drive / Dropbox / Cloud URL)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="https://drive.google.com/file/d/your-resume-link"
                      autoCapitalize="none"
                      value={formResumeUrl}
                      onChangeText={setFormResumeUrl}
                    />
                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                      Ensure file link sharing is set to "Anyone with the link can view".
                    </Text>
                  </View>

                  {/* LinkedIn & Portfolio */}
                  <View style={styles.formRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>LinkedIn Profile</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="https://linkedin.com/in/username"
                        autoCapitalize="none"
                        value={formLinkedinUrl}
                        onChangeText={setFormLinkedinUrl}
                      />
                    </View>
                    <View style={styles.formCol}>
                      <Text style={styles.inputLabel}>Portfolio / GitHub / Publications</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="https://github.com/username"
                        autoCapitalize="none"
                        value={formPortfolioUrl}
                        onChangeText={setFormPortfolioUrl}
                      />
                    </View>
                  </View>

                  {/* Cover Note */}
                  <View style={{ marginBottom: 18 }}>
                    <Text style={styles.inputLabel}>Why are you interested in this position?</Text>
                    <TextInput
                      style={[styles.textInput, { height: 90, textAlignVertical: 'top', paddingTop: 10 }]}
                      placeholder="Share a brief overview of your background, key achievements, and role alignment..."
                      multiline
                      value={formCoverNote}
                      onChangeText={setFormCoverNote}
                    />
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.formActionsRow}>
                    <TouchableOpacity
                      style={styles.cancelApplyBtn}
                      onPress={() => setIsApplying(false)}
                      disabled={submitting}
                    >
                      <Text style={styles.cancelApplyText}>Back to Role Overview</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.submitApplyBtn}
                      onPress={handleSubmitApplication}
                      disabled={submitting}
                      activeOpacity={0.85}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <Send size={15} color="#FFFFFF" />
                          <Text style={styles.submitApplyText}>Submit Application</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* ── Job Details Overview ──────────────────────────────── */
                <View style={styles.jobDetailsContent}>
                  {/* Salary & Positions Box */}
                  <View style={styles.highlightBanner}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.highlightLabel}>COMPENSATION PACKAGE</Text>
                      <Text style={styles.highlightValue}>
                        {selectedJob?.salary_range || 'Competitive Industry Compensation'}
                      </Text>
                    </View>
                    <View style={styles.highlightDivider} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.highlightLabel}>HIRING TARGET</Text>
                      <Text style={styles.highlightValue}>
                        {selectedJob?.positions_count ? `${selectedJob.positions_count} Vacancies` : 'Immediate Placement'}
                      </Text>
                    </View>
                  </View>

                  {/* About the Role */}
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionHeading}>About the Opportunity</Text>
                    <Text style={styles.bodyText}>{selectedJob?.description}</Text>
                  </View>

                  {/* Responsibilities */}
                  {selectedJob?.responsibilities && selectedJob.responsibilities.length > 0 && (
                    <View style={styles.detailSection}>
                      <Text style={styles.sectionHeading}>Key Responsibilities</Text>
                      {selectedJob.responsibilities.map((resp, i) => (
                        <View key={i} style={styles.bulletItem}>
                          <View style={styles.bulletDot} />
                          <Text style={styles.bulletText}>{resp}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Requirements */}
                  {selectedJob?.requirements && selectedJob.requirements.length > 0 && (
                    <View style={styles.detailSection}>
                      <Text style={styles.sectionHeading}>Candidate Requirements & Qualifications</Text>
                      {selectedJob.requirements.map((req, i) => (
                        <View key={i} style={styles.bulletItem}>
                          <CheckCircle2 size={16} color="#0D7377" style={{ marginTop: 2, marginRight: 8 }} />
                          <Text style={styles.bulletText}>{req}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Benefits */}
                  {selectedJob?.perks_and_benefits && selectedJob.perks_and_benefits.length > 0 && (
                    <View style={styles.detailSection}>
                      <Text style={styles.sectionHeading}>Perks, Benefits & Insurance</Text>
                      {selectedJob.perks_and_benefits.map((perk, i) => (
                        <View key={i} style={styles.bulletItem}>
                          <Award size={16} color="#15803D" style={{ marginTop: 2, marginRight: 8 }} />
                          <Text style={styles.bulletText}>{perk}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Bottom Apply CTA */}
                  <View style={styles.applyStickyBottom}>
                    <TouchableOpacity
                      style={styles.primaryApplyBtn}
                      onPress={handleStartApply}
                      activeOpacity={0.88}
                    >
                      <Text style={styles.primaryApplyText}>Apply For This Position</Text>
                      <ArrowRight size={17} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Track Application Modal ────────────────────────────────────── */}
      <Modal
        visible={showTrackModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowTrackModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.trackModalCard}>
            <View style={styles.trackModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Search size={18} color="#0D7377" />
                <Text style={styles.trackModalTitle}>Track Application Status</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTrackModal(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.trackModalSub}>
              Enter your Application Reference Code (e.g., APP-2026-XXXX) or registered email address to check your interview status.
            </Text>

            <View style={styles.trackInputRow}>
              <TextInput
                style={styles.trackTextInput}
                placeholder="APP-2026-XXXX or email@domain.com"
                value={trackQuery}
                onChangeText={setTrackQuery}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.trackSubmitBtn}
                onPress={handleTrackApplication}
                disabled={trackingLoading}
              >
                {trackingLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.trackSubmitText}>Track</Text>
                )}
              </TouchableOpacity>
            </View>

            {trackError ? (
              <View style={styles.trackErrorBox}>
                <Text style={styles.trackErrorText}>{trackError}</Text>
              </View>
            ) : null}

            {trackedCandidate ? (
              <View style={styles.trackedResultBox}>
                <View style={styles.trackedHeader}>
                  <Text style={styles.trackedName}>{trackedCandidate.full_name}</Text>
                  <View style={[styles.stageBadge, { backgroundColor: getStageDisplay(trackedCandidate.stage).color + '20' }]}>
                    <Text style={[styles.stageBadgeText, { color: getStageDisplay(trackedCandidate.stage).color }]}>
                      {getStageDisplay(trackedCandidate.stage).label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.trackedDesc}>
                  {getStageDisplay(trackedCandidate.stage).desc}
                </Text>

                {/* Progress Stepper */}
                <View style={styles.stepperContainer}>
                  {['Received', 'Screening', 'Interview', 'Offer', 'Onboarded'].map((stName, idx) => {
                    const currentStep = getStageDisplay(trackedCandidate.stage).step;
                    const isCompleted = idx + 1 <= currentStep;
                    const isCurrent = idx + 1 === currentStep;

                    return (
                      <View key={stName} style={styles.stepItem}>
                        <View
                          style={[
                            styles.stepCircle,
                            isCompleted && { backgroundColor: '#0D7377', borderColor: '#0D7377' },
                            isCurrent && { backgroundColor: '#0D7377', transform: [{ scale: 1.1 }] },
                          ]}
                        >
                          <Text style={[styles.stepNumber, isCompleted && { color: '#FFF' }]}>
                            {idx + 1}
                          </Text>
                        </View>
                        <Text style={[styles.stepLabel, isCurrent && { fontWeight: '700', color: '#0D7377' }]}>
                          {stName}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {trackedCandidate.timeline && trackedCandidate.timeline.length > 0 && (
                  <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 6 }}>
                      RECENT TIMELINE UPDATE:
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#0F172A' }}>
                      {trackedCandidate.timeline[0]?.title}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      {trackedCandidate.timeline[0]?.description}
                    </Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ── Stylesheet ─────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  navBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 14,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  navContent: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0D7377',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trackNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  trackNavText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D7377',
  },
  portalLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  portalLoginText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  heroSection: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 28,
  },
  heroTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#99F6E4',
    marginBottom: 14,
  },
  heroPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0D7377',
  },
  heroTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D7377',
    letterSpacing: 0.5,
  },
  heroHeading: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.8,
    lineHeight: 42,
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 23,
    maxWidth: 720,
    marginBottom: 24,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexWrap: 'wrap',
    gap: 14,
  },
  statBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  filterSection: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  clearSearchBtn: {
    padding: 6,
  },
  filterGroup: {
    gap: 6,
  },
  filterLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  pillScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  filterPillActive: {
    backgroundColor: '#0D7377',
    borderColor: '#0D7377',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  resultsHeader: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  resultsCountText: {
    fontSize: 14,
    color: '#475569',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  typePillActive: {
    backgroundColor: '#0F172A',
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  typePillTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 400,
  },
  resetFilterBtn: {
    marginTop: 8,
    backgroundColor: '#0D7377',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetFilterText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  jobGrid: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  jobGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    width: '100%',
    ...Platform.select({
      web: {
        transition: 'all 0.18s ease-in-out',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      },
      default: {
        elevation: 1,
      },
    }),
  },
  jobCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  deptBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deptBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  urgentBadge: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgentBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  jobTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 23,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaItemText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  salaryBadge: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#CBD5E1',
  },
  salaryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D7377',
  },
  jobDescSnippet: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  skillsTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  skillChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  skillChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  skillChipMore: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  skillChipMoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  jobCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  positionsPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  positionsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  applyArrowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  applyArrowText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D7377',
  },
  footerSection: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    marginTop: 48,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
    gap: 6,
  },
  footerBrand: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  footerSub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  footerCopyright: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },

  /* Modal Styles */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  jobModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxHeight: '92%',
    overflow: 'hidden',
  },
  jobModalCardDesktop: {
    maxWidth: 780,
  },
  jobModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  jobModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  jobModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  modalCloseCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobModalScroll: {
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  jobDetailsContent: {
    gap: 18,
  },
  highlightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 20,
  },
  highlightDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 14,
  },
  highlightLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  highlightValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D7377',
  },
  detailSection: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0D7377',
    marginTop: 7,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 20,
  },
  applyStickyBottom: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 10,
  },
  primaryApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D7377',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  primaryApplyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Form Styles */
  formContainer: {
    paddingBottom: 24,
  },
  formSectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  formSectionSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorBannerText: {
    fontSize: 12.5,
    color: '#DC2626',
    fontWeight: '600',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  formCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#0F172A',
  },
  formActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  cancelApplyBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cancelApplyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  submitApplyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D7377',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 6,
  },
  submitApplyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Success Screen */
  successWrapper: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#065F46',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
    maxWidth: 480,
  },
  refCodeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  refCodeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 4,
    letterSpacing: 0.8,
  },
  refCodeValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0D7377',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  refCodeHelp: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  successTimelineBox: {
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#99F6E4',
    padding: 14,
    width: '100%',
    marginBottom: 24,
    gap: 6,
  },
  timelineBoxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D7377',
    marginBottom: 2,
  },
  timelineStepText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  doneBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  /* Track Modal */
  trackModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 520,
  },
  trackModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  trackModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  trackModalSub: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 16,
  },
  trackInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  trackTextInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: '#0F172A',
    height: 44,
  },
  trackSubmitBtn: {
    backgroundColor: '#0D7377',
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackSubmitText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  trackErrorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  trackErrorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  trackedResultBox: {
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  trackedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  trackedName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  trackedDesc: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  stepLabel: {
    fontSize: 9.5,
    color: '#64748B',
    textAlign: 'center',
  },
});
