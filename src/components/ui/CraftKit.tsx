import { AlertCircle, ArrowLeft, ChevronRight, X } from 'lucide-react-native';
import React, { ReactNode, useEffect, useRef } from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleProp,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
    ViewStyle
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotionColors } from '@/constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CORE TOKENS & PRIMITIVES (UNIFIED WITH NOTION/OASIS DESIGN SYSTEM)
// ─────────────────────────────────────────────────────────────────────────────

export const CRAFT_TOKENS = {
    colors: {
        // Core Surfaces (Paper + Ink) -> Aligned with canonical NotionColors
        canvas: NotionColors.canvas,
        card: '#ffffff',
        surface: NotionColors.surface,
        ink: NotionColors.ink,
        inkSoft: NotionColors.charcoal,
        inkFaint: NotionColors.slate,
        inkMuted: NotionColors.steel,

        // Structural
        hairline: NotionColors.hairline,
        hairlineSoft: NotionColors.hairlineSoft,

        // Semantic
        error: NotionColors.semanticError,
        errorBg: NotionColors.cardTintRose,
        warning: NotionColors.semanticWarning,
        warningBg: NotionColors.cardTintYellow,
        success: NotionColors.semanticSuccess,
        successBg: NotionColors.cardTintMint,
        linkBlue: NotionColors.linkBlue,

        // Pastel Block Tints -> Aligned with canonical NotionColors
        mint: NotionColors.cardTintMint,
        mintDeep: NotionColors.semanticSuccess,
        amber: NotionColors.cardTintYellow,
        amberDeep: NotionColors.brandOrangeDeep,
        periwinkle: NotionColors.cardTintLavender,
        periwinkleDeep: NotionColors.brandPurple800,
        sky: NotionColors.cardTintSky,
        skyDeep: NotionColors.linkBluePressed,
        peach: NotionColors.cardTintPeach,
        peachDeep: NotionColors.brandOrangeDeep,

        // Compatibility Aliases
        primary: NotionColors.primary,
        onPrimary: NotionColors.onPrimary,
        surfaceSoft: NotionColors.surfaceSoft,
        steel: NotionColors.steel,
        muted: NotionColors.muted,
        charcoal: NotionColors.charcoal,
        tintMint: NotionColors.cardTintMint,
        mintSoft: NotionColors.cardTintMint,
        forest: NotionColors.semanticSuccess,
        periwinkleSoft: NotionColors.cardTintLavender,
        tintRose: NotionColors.cardTintRose,
        semanticError: NotionColors.semanticError,
    },

    fonts: {
        serif: Platform.select({
            ios: 'Georgia',
            android: 'serif',
            web: '"Tiempos Headline", "Source Serif Pro", Georgia, serif',
        }) as string,
        sans: Platform.select({
            ios: 'System',
            android: 'sans-serif',
            web: '"Inter", system-ui, -apple-system, sans-serif',
        }) as string,
        mono: Platform.select({
            ios: 'Courier',
            android: 'monospace',
            web: '"JetBrains Mono", monospace',
        }) as string,
    },

    radius: {
        xs: 4,
        sm: 8,
        md: 14,
        lg: 24,
        xl: 32,
        full: 9999,
    },

    spacing: {
        xxs: 4,
        xs: 6,
        sm: 8,
        md: 12,
        base: 16,
        lg: 20,
        xl: 24,
        xxl: 32,
        section: 60,
    },
} as const;

export const T = CRAFT_TOKENS.colors;
export const F = CRAFT_TOKENS.fonts;
export const R = CRAFT_TOKENS.radius;
export const S = CRAFT_TOKENS.spacing;

// ─────────────────────────────────────────────────────────────────────────────
// 2. TYPOGRAPHY STYLES
// ─────────────────────────────────────────────────────────────────────────────

export const Typography = StyleSheet.create({
    // Display Serif (Always 400 weight, negative tracking)
    displayHero: { fontFamily: F.serif, fontSize: 66, fontWeight: '400', letterSpacing: -1.98, lineHeight: 68, color: T.ink },
    displayLg: { fontFamily: F.serif, fontSize: 54, fontWeight: '400', letterSpacing: -1.08, lineHeight: 60, color: T.ink },
    displayMd: { fontFamily: F.serif, fontSize: 46, fontWeight: '400', letterSpacing: -1.38, lineHeight: 54, color: T.ink },
    displaySm: { fontFamily: F.serif, fontSize: 32, fontWeight: '400', letterSpacing: -1.28, lineHeight: 40, color: T.ink },
    displayXs: { fontFamily: F.serif, fontSize: 24, fontWeight: '400', letterSpacing: -0.72, lineHeight: 32, color: T.ink },

    // UI Sans (Weights 400/500)
    bodyLg: { fontFamily: F.sans, fontSize: 20, fontWeight: '400', letterSpacing: -0.6, lineHeight: 28, color: T.ink },
    bodyMd: { fontFamily: F.sans, fontSize: 18, fontWeight: '500', letterSpacing: -0.36, lineHeight: 26, color: T.ink },
    bodySm: { fontFamily: F.sans, fontSize: 16, fontWeight: '400', letterSpacing: -0.32, lineHeight: 24, color: T.ink },
    bodySmMedium: { fontFamily: F.sans, fontSize: 16, fontWeight: '500', letterSpacing: -0.32, lineHeight: 24, color: T.ink },

    // Chrome / UI Elements
    uiMd: { fontFamily: F.sans, fontSize: 14, fontWeight: '400', lineHeight: 20, color: T.ink },
    uiMdMedium: { fontFamily: F.sans, fontSize: 14, fontWeight: '500', lineHeight: 20, color: T.ink },
    uiSm: { fontFamily: F.sans, fontSize: 13, fontWeight: '400', lineHeight: 18, color: T.inkFaint },
    uiSmMedium: { fontFamily: F.sans, fontSize: 13, fontWeight: '500', lineHeight: 18, color: T.ink },
    caption: { fontFamily: F.sans, fontSize: 12, fontWeight: '400', lineHeight: 16, color: T.inkFaint },
    captionMedium: { fontFamily: F.sans, fontSize: 12, fontWeight: '500', lineHeight: 16, color: T.ink },
    micro: { fontFamily: F.sans, fontSize: 11, fontWeight: '500', lineHeight: 14, color: T.inkFaint },

    // Specialized
    eyebrow: { fontFamily: F.sans, fontSize: 12, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', color: T.inkFaint },
    buttonLabel: { fontFamily: F.sans, fontSize: 15, fontWeight: '500', letterSpacing: -0.2 },
    buttonLabelSm: { fontFamily: F.sans, fontSize: 13, fontWeight: '500', letterSpacing: -0.1 },
    mono: { fontFamily: F.mono, fontSize: 13, fontWeight: '400', letterSpacing: 0.5, color: T.ink },
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const getPastelTextColor = (bgColor: string) => {
    switch (bgColor) {
        case T.mint: return T.mintDeep;
        case T.amber: return T.amberDeep;
        case T.periwinkle: return T.periwinkleDeep;
        case T.sky: return T.skyDeep;
        case T.peach: return T.peachDeep;
        default: return T.ink;
    }
};

export const getPastelTintFromHex = (hex: string) => {
    if (hex === T.mintDeep) return T.mint;
    if (hex === T.amberDeep) return T.amber;
    if (hex === T.periwinkleDeep) return T.periwinkle;
    if (hex === T.skyDeep) return T.sky;
    if (hex === T.peachDeep) return T.peach;
    return T.canvas;
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. LAYOUT COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export const CraftDivider = ({ style }: { style?: StyleProp<ViewStyle> }) => (
    <View style={[{ height: 1, backgroundColor: T.hairline, width: '100%' }, style]} />
);

export const CraftSpacer = ({ height = 16, width = 0 }: { height?: number; width?: number }) => (
    <View style={{ height, width }} />
);

export interface CraftHeaderProps {
    title: string;
    subtitle?: string;
    eyebrow?: string;
    onBack?: () => void;
    right?: ReactNode;
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
    topInset?: number;
    transparent?: boolean;
}

export const CraftHeader = ({
    title,
    subtitle,
    eyebrow,
    onBack,
    right,
    children,
    style,
    topInset,
    transparent = false,
}: CraftHeaderProps) => {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;
    const computedTop = topInset !== undefined ? topInset : Math.max(insets.top, 12);

    return (
        <View
            style={[
                {
                    backgroundColor: transparent ? 'transparent' : T.canvas,
                    paddingTop: computedTop + (isDesktop ? 12 : 6),
                    paddingHorizontal: isDesktop ? 32 : 16,
                    paddingBottom: 16,
                    borderBottomWidth: transparent ? 0 : 1,
                    borderBottomColor: T.hairlineSoft,
                },
                style,
            ]}
        >
            {onBack && (
                <TouchableOpacity
                    onPress={onBack}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 10,
                        alignSelf: 'flex-start',
                    }}
                >
                    <ArrowLeft size={16} color={T.ink} strokeWidth={2} />
                    <Text style={[Typography.uiSmMedium, { color: T.ink }]}>Back</Text>
                </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
                <View style={{ flex: 1 }}>
                    {eyebrow && (
                        <Text style={[Typography.eyebrow, { color: T.inkMuted, marginBottom: 4 }]}>
                            {eyebrow.toUpperCase()}
                        </Text>
                    )}
                    <Text
                        style={[
                            isDesktop ? Typography.displayMd : Typography.displaySm,
                            { color: T.ink },
                        ]}
                    >
                        {title}
                    </Text>
                    {subtitle && (
                        <Text style={[Typography.uiSm, { color: T.inkFaint, marginTop: 4, maxWidth: 680 }]}>
                            {subtitle}
                        </Text>
                    )}
                </View>
                {right && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {right}
                    </View>
                )}
            </View>

            {children && <View style={{ marginTop: 12 }}>{children}</View>}
        </View>
    );
};

export const PageHeader = CraftHeader;

// ─────────────────────────────────────────────────────────────────────────────
// 5. CORE UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// --- Buttons ---
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'pastel' | 'pill';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface CraftButtonProps {
    title: string;
    onPress?: () => void;
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: ReactNode;
    rightIcon?: ReactNode;
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    style?: StyleProp<ViewStyle>;
    pastelColor?: string;
}

export const CraftButton = ({
    title, onPress, variant = 'primary', size = 'md', icon, rightIcon,
    loading = false, disabled = false, fullWidth = false, style, pastelColor
}: CraftButtonProps) => {
    const isDisabled = disabled || loading;

    const getVariantStyles = (): { bg: string; text: string; border: string } => {
        switch (variant) {
            case 'primary':
                return { bg: T.ink, text: T.card, border: T.ink };
            case 'secondary':
                return { bg: 'transparent', text: T.ink, border: T.hairline };
            case 'ghost':
                return { bg: 'transparent', text: T.ink, border: 'transparent' };
            case 'danger':
                return { bg: T.error, text: T.card, border: T.error };
            case 'pastel':
                const bg = pastelColor || T.mint;
                return { bg, text: getPastelTextColor(bg), border: bg };
            case 'pill':
                return { bg: T.ink, text: T.card, border: T.ink };
            default:
                return { bg: T.ink, text: T.card, border: T.ink };
        }
    };

    const vs = getVariantStyles();

    const heights = { sm: 32, md: 40, lg: 48 };
    const paddings = { sm: '6px 12px', md: '8px 16px', lg: '12px 20px' };
    const textStyle = size === 'sm' ? Typography.buttonLabelSm : Typography.buttonLabel;
    const radius = variant === 'pill' ? R.full : R.sm;

    return (
        <TouchableOpacity
            onPress={isDisabled ? undefined : onPress}
            activeOpacity={0.75}
            style={[
                {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    height: heights[size],
                    paddingHorizontal: size === 'sm' ? 12 : (size === 'md' ? 16 : 20),
                    backgroundColor: vs.bg,
                    borderColor: vs.border,
                    borderWidth: variant === 'ghost' ? 0 : 1,
                    borderRadius: radius,
                    opacity: isDisabled ? 0.5 : 1,
                    width: fullWidth ? '100%' : undefined,
                },
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator size="small" color={vs.text} />
            ) : (
                <>
                    {icon}
                    <Text style={[textStyle, { color: vs.text }]}>{title}</Text>
                    {rightIcon}
                </>
            )}
        </TouchableOpacity>
    );
};

// --- Cards ---
interface CraftCardProps {
    children: ReactNode;
    variant?: 'base' | 'elevated' | 'pastel' | 'hero';
    pastelTint?: string;
    padding?: number;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
}

export const CraftCard = ({
    children, variant = 'base', pastelTint, padding = S.xl, style, onPress
}: CraftCardProps) => {
    const getCardStyle = (): ViewStyle => {
        switch (variant) {
            case 'elevated':
                return {
                    backgroundColor: T.card,
                    borderRadius: R.lg,
                    borderWidth: 1,
                    borderColor: T.hairline,
                    padding,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.05,
                    shadowRadius: 12,
                    elevation: 2,
                };
            case 'pastel':
                return {
                    backgroundColor: pastelTint || T.mint,
                    borderRadius: R.lg,
                    borderWidth: 0,
                    padding,
                };
            case 'hero':
                return {
                    backgroundColor: T.ink,
                    borderRadius: R.lg,
                    padding,
                };
            case 'base':
            default:
                return {
                    backgroundColor: T.card,
                    borderRadius: R.lg,
                    borderWidth: 1,
                    borderColor: T.hairline,
                    padding,
                };
        }
    };

    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[getCardStyle(), style]}>
                {children}
            </TouchableOpacity>
        );
    }

    return <View style={[getCardStyle(), style]}>{children}</View>;
};

// --- Avatars ---
interface CraftAvatarProps {
    name?: string;
    url?: string;
    size?: number;
    variant?: 'circle' | 'square';
}

export const CraftAvatar = ({ name, url, size = 40, variant = 'circle' }: CraftAvatarProps) => {
    const initials = name
        ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        : 'U';

    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: variant === 'circle' ? size / 2 : R.sm,
                backgroundColor: T.periwinkle,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
            }}
        >
            {url ? (
                <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} />
            ) : (
                <Text style={{ fontFamily: F.sans, fontSize: size * 0.35, fontWeight: '600', color: T.periwinkleDeep }}>
                    {initials}
                </Text>
            )}
        </View>
    );
};

// --- Badges & Chips ---
interface CraftBadgeProps {
    label: string;
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'pastel';
    pastelTint?: string;
    size?: 'sm' | 'md';
}

export const CraftBadge = ({ label, variant = 'default', pastelTint, size = 'sm' }: CraftBadgeProps) => {
    const getStyle = () => {
        switch (variant) {
            case 'success': return { bg: T.successBg, text: T.success };
            case 'warning': return { bg: T.warningBg, text: T.amberDeep };
            case 'error': return { bg: T.errorBg, text: T.error };
            case 'info': return { bg: T.sky, text: T.skyDeep };
            case 'pastel':
                const bg = pastelTint || T.mint;
                return { bg, text: getPastelTextColor(bg) };
            case 'default':
            default: return { bg: T.hairlineSoft, text: T.inkFaint };
        }
    };

    const s = getStyle();
    const py = size === 'sm' ? 2 : 4;
    const px = size === 'sm' ? 6 : 10;
    const fs = size === 'sm' ? 10 : 12;

    return (
        <View style={{ backgroundColor: s.bg, paddingVertical: py, paddingHorizontal: px, borderRadius: R.xs, alignSelf: 'flex-start' }}>
            <Text style={{ fontFamily: F.sans, fontSize: fs, fontWeight: '600', color: s.text, letterSpacing: 0.2 }}>
                {label}
            </Text>
        </View>
    );
};

interface CraftChipProps {
    label: string;
    active?: boolean;
    onPress?: () => void;
    icon?: ReactNode;
}

export const CraftChip = ({ label, active, onPress, icon }: CraftChipProps) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: R.full,
                backgroundColor: active ? T.ink : T.card,
                borderWidth: 1,
                borderColor: active ? T.ink : T.hairline,
            }}
        >
            {icon}
            <Text style={[Typography.captionMedium, { color: active ? T.card : T.inkFaint }]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
};

// --- Inputs ---
interface CraftInputProps extends React.ComponentProps<typeof TextInput> {
    label?: string;
    error?: string;
    hint?: string;
    icon?: ReactNode;
    rightIcon?: ReactNode;
}

export const CraftInput = ({ label, error, hint, icon, rightIcon, style, ...props }: CraftInputProps) => {
    return (
        <View style={{ gap: 6 }}>
            {label && (
                <Text style={[Typography.uiSmMedium, { color: T.ink }]}>{label}</Text>
            )}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: T.card,
                    borderWidth: 1,
                    borderColor: error ? T.error : T.hairline,
                    borderRadius: R.md,
                    paddingHorizontal: 12,
                    height: 44,
                    gap: 8,
                }}
            >
                {icon}
                <TextInput
                    placeholderTextColor={T.inkMuted}
                    style={[
                        Typography.bodySm,
                        { flex: 1, height: '100%', color: T.ink },
                        style,
                    ]}
                    {...props}
                />
                {rightIcon}
            </View>
            {error ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={12} color={T.error} />
                    <Text style={[Typography.caption, { color: T.error }]}>{error}</Text>
                </View>
            ) : hint ? (
                <Text style={[Typography.caption, { color: T.inkMuted }]}>{hint}</Text>
            ) : null}
        </View>
    );
};

export const CraftTextarea = ({ label, error, style, ...props }: CraftInputProps) => {
    return (
        <View style={{ gap: 6 }}>
            {label && <Text style={[Typography.uiSmMedium, { color: T.ink }]}>{label}</Text>}
            <TextInput
                multiline
                numberOfLines={4}
                placeholderTextColor={T.inkMuted}
                style={[
                    Typography.bodySm,
                    {
                        backgroundColor: T.card,
                        borderWidth: 1,
                        borderColor: error ? T.error : T.hairline,
                        borderRadius: R.md,
                        padding: 12,
                        minHeight: 100,
                        textAlignVertical: 'top',
                        color: T.ink,
                    },
                    style,
                ]}
                {...props}
            />
            {error && <Text style={[Typography.caption, { color: T.error }]}>{error}</Text>}
        </View>
    );
};

// --- Switch ---
export const CraftSwitch = ({ value, onValueChange, label, description }: { value: boolean; onValueChange: (v: boolean) => void; label?: string; description?: string }) => {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <View style={{ flex: 1 }}>
                {label && <Text style={[Typography.bodySmMedium, { color: T.ink }]}>{label}</Text>}
                {description && <Text style={[Typography.caption, { color: T.inkFaint, marginTop: 2 }]}>{description}</Text>}
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: T.hairline, true: T.ink }}
                thumbColor={T.card}
                ios_backgroundColor={T.hairline}
            />
        </View>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. MODALS & BOTTOM SHEETS
// ─────────────────────────────────────────────────────────────────────────────

interface CraftModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    children: ReactNode;
    footer?: ReactNode;
    maxWidth?: number;
}

export const CraftModal = ({ visible, onClose, title, subtitle, children, footer, maxWidth = 440 }: CraftModalProps) => {
    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
            >
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(3, 3, 2, 0.4)' }} />
                </Pressable>

                <View
                    style={{
                        width: '92%',
                        maxWidth,
                        backgroundColor: T.card,
                        borderRadius: R.lg,
                        borderWidth: 1,
                        borderColor: T.hairline,
                        overflow: 'hidden',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 16 },
                        shadowOpacity: 0.16,
                        shadowRadius: 48,
                        elevation: 24,
                    }}
                >
                    {(title || subtitle) && (
                        <View style={{ padding: S.xl, borderBottomWidth: 1, borderBottomColor: T.hairline, gap: 4 }}>
                            {title && <Text style={Typography.displayXs}>{title}</Text>}
                            {subtitle && <Text style={[Typography.uiMd, { color: T.inkFaint }]}>{subtitle}</Text>}
                        </View>
                    )}

                    <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={{ padding: S.xl, gap: S.base }}>
                        {children}
                    </ScrollView>

                    {footer && (
                        <View style={{ padding: S.xl, borderTopWidth: 1, borderTopColor: T.hairline, flexDirection: 'row', gap: S.md, justifyContent: 'flex-end' }}>
                            {footer}
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

interface CraftBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
}

export const CraftBottomSheet = ({ visible, onClose, title, children }: CraftBottomSheetProps) => {
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(500)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(translateY, { toValue: 0, useNativeDriver: Platform.OS !== 'web', damping: 20, stiffness: 200 }).start();
        } else {
            Animated.timing(translateY, { toValue: 500, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start();
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(3, 3, 2, 0.4)' }} />
                </Pressable>

                <Animated.View
                    style={{
                        transform: [{ translateY }],
                        backgroundColor: T.card,
                        borderTopLeftRadius: R.xl,
                        borderTopRightRadius: R.xl,
                        paddingBottom: Math.max(insets.bottom, S.xl),
                        maxHeight: '85%',
                    }}
                >
                    <View style={{ alignItems: 'center', paddingTop: S.md, paddingBottom: S.sm }}>
                        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: T.hairline }} />
                    </View>

                    {title && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.xl, paddingBottom: S.base, borderBottomWidth: 1, borderBottomColor: T.hairline }}>
                            <Text style={Typography.displayXs}>{title}</Text>
                            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                                <X size={20} color={T.inkFaint} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <ScrollView contentContainerStyle={{ padding: S.xl }}>
                        {children}
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. FEEDBACK & LOADING STATES
// ─────────────────────────────────────────────────────────────────────────────

export const CraftLoader = ({ text = 'Loading...' }: { text?: string }) => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl, gap: S.md, backgroundColor: T.canvas }}>
        <ActivityIndicator size="large" color={T.ink} />
        {text && <Text style={[Typography.uiMd, { color: T.inkFaint }]}>{text}</Text>}
    </View>
);

export const CraftEmptyState = ({
    icon,
    title,
    description,
    actionLabel,
    onAction,
}: {
    icon?: ReactNode;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
}) => (
    <View style={{ padding: S.xxl, alignItems: 'center', justifyContent: 'center', backgroundColor: T.card, borderRadius: R.lg, borderWidth: 1, borderColor: T.hairline, borderStyle: 'dashed' }}>
        {icon && <View style={{ marginBottom: S.md, opacity: 0.5 }}>{icon}</View>}
        <Text style={[Typography.bodySmMedium, { color: T.ink, textAlign: 'center' }]}>{title}</Text>
        {description && <Text style={[Typography.caption, { color: T.inkFaint, textAlign: 'center', marginTop: 4 }]}>{description}</Text>}
        {actionLabel && onAction && (
            <CraftButton title={actionLabel} onPress={onAction} variant="secondary" size="sm" style={{ marginTop: S.base }} />
        )}
    </View>
);

export const CraftSkeleton = ({ width = '100%', height = 20, radius = R.xs, style }: { width?: number | string; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) => {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View
            style={[
                { width: width as any, height, borderRadius: radius, backgroundColor: T.hairline, opacity },
                style,
            ]}
        />
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. LAYOUT HELPERS (Headers, Rows, Lists)
// ─────────────────────────────────────────────────────────────────────────────

export const CraftListItem = ({
    icon,
    title,
    subtitle,
    right,
    onPress,
    showChevron,
}: {
    icon?: ReactNode;
    title: string;
    subtitle?: string;
    right?: ReactNode;
    onPress?: () => void;
    showChevron?: boolean;
}) => {
    const content = (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: S.md, paddingHorizontal: S.base, gap: S.md }}>
            {icon && (
                <View style={{ width: 40, height: 40, borderRadius: R.sm, backgroundColor: T.canvas, alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                </View>
            )}
            <View style={{ flex: 1 }}>
                <Text style={[Typography.bodySmMedium, { color: T.ink }]}>{title}</Text>
                {subtitle && <Text style={[Typography.caption, { color: T.inkFaint, marginTop: 2 }]}>{subtitle}</Text>}
            </View>
            {right}
            {showChevron && <ChevronRight size={16} color={T.inkMuted} />}
        </View>
    );

    if (onPress) {
        return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{content}</TouchableOpacity>;
    }

    return content;
};

export const CraftSectionHeader = ({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingVertical: S.md, paddingHorizontal: S.base }}>
        <Text style={Typography.displayXs}>{title}</Text>
        {actionLabel && onAction && (
            <TouchableOpacity onPress={onAction}>
                <Text style={[Typography.uiSmMedium, { color: T.linkBlue }]}>{actionLabel}</Text>
            </TouchableOpacity>
        )}
    </View>
);

export const CraftAlert = ({
    variant = 'info',
    title,
    message,
    icon,
}: {
    variant?: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message?: string;
    icon?: ReactNode;
}) => {
    const getStyle = () => {
        switch (variant) {
            case 'success': return { bg: T.successBg, text: T.success, iconColor: T.success };
            case 'warning': return { bg: T.warningBg, text: T.amberDeep, iconColor: T.amberDeep };
            case 'error': return { bg: T.errorBg, text: T.error, iconColor: T.error };
            case 'info': default: return { bg: T.sky, text: T.skyDeep, iconColor: T.skyDeep };
        }
    };

    const s = getStyle();

    return (
        <View style={{ flexDirection: 'row', gap: S.md, padding: S.base, borderRadius: R.md, backgroundColor: s.bg }}>
            {icon || <AlertCircle size={20} color={s.iconColor} />}
            <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={[Typography.bodySmMedium, { color: s.text }]}>{title}</Text>
                {message && <Text style={[Typography.caption, { color: s.text, marginTop: 2, opacity: 0.8 }]}>{message}</Text>}
            </View>
        </View>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. DATA GRID & CHARTS COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export const CraftProgressBar = ({ value, max = 100, color = T.ink, height = 8 }: { value: number; max?: number; color?: string; height?: number }) => {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <View style={{ height, borderRadius: height / 2, backgroundColor: T.hairline, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: height / 2 }} />
        </View>
    );
};

export const CraftStatCard = ({
    label,
    value,
    subtext,
    trend,
    tint = T.card,
}: {
    label: string;
    value: string;
    subtext?: string;
    trend?: 'up' | 'down' | 'neutral';
    tint?: string;
}) => {
    const textColor = tint === T.card ? T.ink : getPastelTextColor(tint);

    return (
        <View style={{ flex: 1, backgroundColor: tint, borderRadius: R.lg, padding: S.base, gap: S.xs, borderWidth: tint === T.card ? 1 : 0, borderColor: T.hairline }}>
            <Text style={[Typography.eyebrow, { color: tint === T.card ? T.inkFaint : getPastelTextColor(tint), opacity: 0.8 }]}>{label}</Text>
            <Text style={[Typography.displayXs, { color: textColor }]}>{value}</Text>
            {subtext && <Text style={[Typography.caption, { color: textColor, opacity: 0.7 }]}>{subtext}</Text>}
        </View>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// 10. UTILITIES & EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const useCraftTokens = () => {
    return {
        colors: T,
        fonts: F,
        radius: R,
        spacing: S,
        typography: Typography,
    };
};

export default {
    T,
    F,
    R,
    S,
    Typography,
    CraftButton,
    CraftCard,
    CraftAvatar,
    CraftBadge,
    CraftChip,
    CraftInput,
    CraftTextarea,
    CraftSwitch,
    CraftModal,
    CraftBottomSheet,
    CraftLoader,
    CraftEmptyState,
    CraftSkeleton,
    CraftListItem,
    CraftSectionHeader,
    CraftAlert,
    CraftProgressBar,
    CraftStatCard,
    CraftDivider,
    CraftSpacer,
    getPastelTextColor,
    getPastelTintFromHex,
    useCraftTokens,
};