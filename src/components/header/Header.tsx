/**
 * Header — 顶部栏
 *
 * - 左侧：皮卡丘动画图标 + 标题（点击可滚动到顶）
 * - 中间：拖动区（仅 Tauri 桌面壳，把 data-tauri-drag-region 撑满中间空白）
 * - 右侧：中/EN 切换 + 快捷键 + 设置 + 窗口控件（仅 Tauri：最小/最大/关）
 *
 * Tauri 集成说明：
 * - tauri.conf.json 设了 decorations: false（无原生标题栏）
 * - 这里用 data-tauri-drag-region 属性 + getCurrentWindow() 的 minimize/maximize/close
 *   实现自定义标题栏，纯 web/移动端无影响（isTauri() false 时不渲染）
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../i18n/I18nProvider';
import { useSettingsStore } from '../../state/settingsStore';
import { useAnimatedPress } from '../../hooks/useAnimatedPress';
import { colors, fontSize, spacing, radius } from '../../theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// 检测 Tauri 运行时（只在 Tauri WebView 里才有 window.__TAURI_INTERNALS__）
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

interface HeaderProps {
  title?: string;     // 可选副标题（默认 'appTitle'）
  onShortcuts?: () => void;
  onSettings?: () => void;
}

export default function Header({ title, onShortcuts, onSettings }: HeaderProps) {
  const { t } = useTranslation();
  const lang = useSettingsStore(s => s.language);
  const setLang = useSettingsStore(s => s.setLanguage);
  const insets = useSafeAreaInsets();
  const tauri = isTauri();

  // 皮卡丘图标呼吸动画
  const breath = useSharedValue(1);
  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }],
  }));
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [breath]);

  return (
    <View
      // 关键：flex 布局用 inline style，不能走 StyleSheet.create
      // Tauri WebView2 下 react-native-web 编出的 .r-* 类注入不可靠
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
        backgroundColor: colors.bgElevated,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingTop: insets.top + 8,
      }}
      // Tauri 2：data-tauri-drag-region 让此 View 成为 OS 级拖动区
      // react-native-web 用 dataSet 转成 data-* 属性
      {...(tauri ? { dataSet: { 'tauri-drag-region': '' } } : {})}
    >
      {/* 左侧：logo + 标题（拖动区已通过 data 属性覆盖整个 bar） */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          flexShrink: 1,
        }}
      >
        <Animated.View
          style={[
            {
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: colors.accent,
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            },
            breathStyle,
          ]}
        >
          <Image
            source={require('../../../assets/pikachu.gif')}
            style={{ width: 32, height: 32 }}
            resizeMode="contain"
          />
        </Animated.View>
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' }}>
            {t('appTitle')}
          </Text>
          {title ? (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
              {title}
            </Text>
          ) : null}
        </View>
      </View>

      {/* 右侧：语言切换 + 快捷键 + 设置 + 窗口控件（仅 Tauri） */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.bg,
            borderRadius: radius.full,
            padding: 2,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <LangBtn label="中" active={lang === 'zh'} onPress={() => setLang('zh')} />
          <LangBtn label="EN" active={lang === 'en'} onPress={() => setLang('en')} />
        </View>
        {onShortcuts && (
          <IconBtn icon="⌨️" onPress={onShortcuts} />
        )}
        {onSettings && (
          <IconBtn icon="⚙" onPress={onSettings} />
        )}
        {tauri && <WindowControls />}
      </View>
    </View>
  );
}

/**
 * WindowControls — Tauri 桌面壳的窗口最小化/最大化/关闭按钮
 *
 * - 仅当 isTauri() 时被渲染
 * - 动态 import @tauri-apps/api/window：避免 pure web 环境打包时把 tauri 包拽进去
 * - 按钮独立 onPress，不受 drag-region 影响（Tauri 2 按钮区域默认不响应 drag）
 */
function WindowControls() {
  const [mod, setMod] = useState<{
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<void>;
    close: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    import('@tauri-apps/api/window').then((m) => {
      if (!mounted) return;
      const win = m.getCurrentWindow();
      setMod({
        minimize: () => win.minimize(),
        toggleMaximize: () => win.toggleMaximize(),
        close: () => win.close(),
      });
    }).catch((e) => {
      console.warn('[Header] failed to load tauri window api', e);
    });
    return () => { mounted = false; };
  }, []);

  if (!mod) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: spacing.xs,
        gap: 2,
      }}
    >
      <Pressable
        onPress={() => mod.minimize().catch(noop)}
        hitSlop={6}
        style={({ pressed }) => [
          {
            width: 32, height: 28,
            alignItems: 'center', justifyContent: 'center',
            borderRadius: 4,
          },
          pressed && { backgroundColor: colors.bg },
        ]}
      >
        <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 16 }}>─</Text>
      </Pressable>
      <Pressable
        onPress={() => mod.toggleMaximize().catch(noop)}
        hitSlop={6}
        style={({ pressed }) => [
          {
            width: 32, height: 28,
            alignItems: 'center', justifyContent: 'center',
            borderRadius: 4,
          },
          pressed && { backgroundColor: colors.bg },
        ]}
      >
        <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 16 }}>□</Text>
      </Pressable>
      <Pressable
        onPress={() => mod.close().catch(noop)}
        hitSlop={6}
        style={({ pressed }) => [
          {
            width: 32, height: 28,
            alignItems: 'center', justifyContent: 'center',
            borderRadius: 4,
          },
          pressed && { backgroundColor: colors.bg },
        ]}
      >
        <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 16 }}>✕</Text>
      </Pressable>
    </View>
  );
}

function noop() {}

function LangBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = useAnimatedPress();
  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} hitSlop={4}>
      <Animated.View
        style={[
          {
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderRadius: radius.full,
            minWidth: 28,
            alignItems: 'center',
          },
          active && { backgroundColor: colors.accent },
          animatedStyle,
        ]}
      >
        <Text
          style={[
            {
              fontSize: fontSize.xs,
              fontWeight: '600',
              color: active ? colors.bg : colors.textMuted,
            },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function IconBtn({ icon, onPress }: { icon: string; onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = useAnimatedPress();
  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} hitSlop={4}>
      <Animated.View
        style={[
          {
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: colors.accentSoft,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: colors.accent,
          },
          animatedStyle,
        ]}
      >
        <Text style={{ fontSize: 18, color: colors.accent }}>{icon}</Text>
      </Animated.View>
    </Pressable>
  );
}

// 注意：原本的 StyleSheet.create() 块已删除 —— Tauri WebView2 下 flex 类不可靠，
// 所有 layout (flex, flexDirection, alignItems, justifyContent, gap) 必须用 inline style
