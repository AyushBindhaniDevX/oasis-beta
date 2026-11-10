import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { X } from 'lucide-react-native';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalAction {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'danger' | 'success' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface ModalBadge {
  text: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  icon?: React.ReactNode;
  iconBgColor?: string;
  iconBorderColor?: string;
  badge?: ModalBadge | React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  primaryAction?: ModalAction;
  secondaryAction?: ModalAction;
  size?: ModalSize;
  maxWidth?: number;
  maxHeight?: number | string;
  scrollable?: boolean;
  bodyStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  overlayStyle?: StyleProp<ViewStyle>;
  headerStyle?: StyleProp<ViewStyle>;
  footerStyle?: StyleProp<ViewStyle>;
  hideCloseButton?: boolean;
  dismissible?: boolean;
  animationType?: 'fade' | 'slide' | 'none';
  variant?: 'default' | 'danger' | 'success' | 'warning';
}

const SIZE_MAP: Record<ModalSize, number> = {
  sm: 440,
  md: 560,
  lg: 720,
  xl: 920,
  full: 1180,
};

export function Modal({
  visible,
  onClose,
  title,
  subtitle,
  icon,
  iconBgColor,
  iconBorderColor,
  badge,
  headerRight,
  children,
  footer,
  primaryAction,
  secondaryAction,
  size = 'md',
  maxWidth,
  maxHeight,
  scrollable = true,
  bodyStyle,
  contentStyle,
  overlayStyle,
  headerStyle,
  footerStyle,
  hideCloseButton = false,
  dismissible = true,
  animationType = 'fade',
}: ModalProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  React.useEffect(() => {
    if (visible && Platform.OS === 'web' && typeof document !== 'undefined') {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && typeof activeEl.blur === 'function') {
        activeEl.blur();
      }
    }
  }, [visible]);

  if (!visible) return null;

  const resolvedMaxWidth = maxWidth ?? SIZE_MAP[size] ?? 560;

  const handleBackdropPress = () => {
    if (dismissible) {
      onClose();
    }
  };

  const renderBadge = () => {
    if (!badge) return null;
    if (React.isValidElement(badge)) return badge;
    const b = badge as ModalBadge;
    const badgeColors = {
      primary: { bg: '#F0F7F7', text: '#0D7377', border: 'rgba(13, 115, 119, 0.2)' },
      success: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
      warning: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
      danger: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
      neutral: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
    }[b.variant || 'primary'];

    return (
      <View
        style={[
          styles.badge,
          {
            backgroundColor: badgeColors.bg,
            borderColor: badgeColors.border,
          },
        ]}
      >
        <Text style={[styles.badgeText, { color: badgeColors.text }]}>{b.text}</Text>
      </View>
    );
  };

  const hasHeader = Boolean(title || icon || subtitle || headerRight || !hideCloseButton);
  const hasActions = Boolean(primaryAction || secondaryAction);
  const hasFooter = Boolean(footer || hasActions);

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={[styles.overlay, isMobile && styles.overlayMobile, overlayStyle]}
          onPress={handleBackdropPress}
        >
          <Pressable
            style={[
              styles.content,
              isMobile && styles.contentMobile,
              {
                maxWidth: isMobile ? '100%' : resolvedMaxWidth,
                maxHeight: maxHeight ?? (isMobile ? '92%' : '88%'),
              },
              contentStyle,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Mobile Sheet Pull Indicator */}
            {isMobile && (
              <View style={styles.sheetHandleWrap}>
                <View style={styles.sheetHandle} />
              </View>
            )}

            {/* Header */}
            {hasHeader && (
              <View style={[styles.header, headerStyle]}>
                <View style={styles.headerLeft}>
                  {icon && (
                    <View
                      style={[
                        styles.iconBox,
                        iconBgColor ? { backgroundColor: iconBgColor } : null,
                        iconBorderColor ? { borderColor: iconBorderColor } : null,
                      ]}
                    >
                      {icon}
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      {typeof title === 'string' ? (
                        <Text style={styles.title} numberOfLines={2}>
                          {title}
                        </Text>
                      ) : (
                        title
                      )}
                      {renderBadge()}
                    </View>

                    {subtitle && (
                      <View style={{ marginTop: 2 }}>
                        {typeof subtitle === 'string' ? (
                          <Text style={styles.subtitle} numberOfLines={2}>
                            {subtitle}
                          </Text>
                        ) : (
                          subtitle
                        )}
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.headerRight}>
                  {headerRight}

                  {!hideCloseButton && (
                    <TouchableOpacity
                      onPress={onClose}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={styles.closeBtn}
                      activeOpacity={0.7}
                    >
                      <X size={16} color="#64748B" strokeWidth={2.2} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Body */}
            {scrollable ? (
              <ScrollView
                style={styles.body}
                contentContainerStyle={[styles.bodyContent, bodyStyle]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            ) : (
              <View style={[styles.bodyNonScrollable, bodyStyle]}>{children}</View>
            )}

            {/* Footer */}
            {hasFooter && (
              <View style={[styles.footer, footerStyle]}>
                {footer ? (
                  footer
                ) : (
                  <View style={styles.actionRow}>
                    {secondaryAction && (
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          styles.secondaryBtn,
                          secondaryAction.disabled && styles.actionBtnDisabled,
                        ]}
                        onPress={secondaryAction.onPress}
                        disabled={secondaryAction.disabled}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.secondaryBtnText}>{secondaryAction.label}</Text>
                      </TouchableOpacity>
                    )}

                    {primaryAction && (
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          primaryAction.variant === 'danger'
                            ? styles.dangerBtn
                            : primaryAction.variant === 'success'
                            ? styles.successBtn
                            : styles.primaryBtn,
                          (primaryAction.disabled || primaryAction.loading) && styles.actionBtnDisabled,
                        ]}
                        onPress={primaryAction.onPress}
                        disabled={primaryAction.disabled || primaryAction.loading}
                        activeOpacity={0.85}
                      >
                        {primaryAction.loading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {primaryAction.icon}
                            <Text style={styles.primaryBtnText}>{primaryAction.label}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

// Compound components for advanced flexibility
Modal.Header = function ModalHeader({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.header, style]}>{children}</View>;
};

Modal.Body = function ModalBody({
  children,
  style,
  scrollable = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scrollable?: boolean;
}) {
  if (scrollable) {
    return (
      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, style]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.bodyNonScrollable, style]}>{children}</View>;
};

Modal.Footer = function ModalFooter({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.footer, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      },
    }),
  },
  overlayMobile: {
    justifyContent: 'flex-end',
    padding: 0,
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.05)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  contentMobile: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  sheetHandleWrap: {
    paddingTop: 10,
    paddingBottom: 4,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F7F7',
    borderWidth: 1,
    borderColor: 'rgba(13, 115, 119, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 100,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    padding: 22,
  },
  bodyNonScrollable: {
    flexShrink: 1,
    padding: 22,
  },
  footer: {
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFCFC',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  primaryBtn: {
    backgroundColor: '#0D7377',
    minWidth: 100,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dangerBtn: {
    backgroundColor: '#DC2626',
    minWidth: 100,
  },
  successBtn: {
    backgroundColor: '#10B981',
    minWidth: 100,
  },
});
