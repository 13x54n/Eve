import { type ReactNode, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

type ActionButtonProps = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  loadingLabel?: string;
  icon?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  spinnerColor?: string;
  compact?: boolean;
  replaceContentOnLoading?: boolean;
  accessibilityLabel?: string;
};

export function ActionButton({
  onPress,
  loading = false,
  disabled = false,
  label,
  loadingLabel,
  icon,
  children,
  style,
  contentStyle,
  textStyle,
  spinnerColor = '#FFFFFF',
  compact = false,
  replaceContentOnLoading = true,
  accessibilityLabel,
}: ActionButtonProps) {
  const [pressed, setPressed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const blocked = disabled || loading;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const scaled = pressed && !blocked && !reduceMotion;
  const busyLabel = loadingLabel ?? label;
  const content =
    loading && replaceContentOnLoading ? (
      <>
        <ActivityIndicator color={spinnerColor} />
        {!compact && busyLabel ? <Text style={textStyle}>{busyLabel}</Text> : null}
      </>
    ) : (
      (children ?? (
        <>
          {icon}
          {label ? <Text style={textStyle}>{label}</Text> : null}
        </>
      ))
    );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label ?? loadingLabel}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.base, style, contentStyle, scaled && styles.pressed, loading && styles.loading]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transform: [{ scale: 1 }],
  } as any,
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  loading: {
    opacity: 0.7,
  },
});
