// =============================================================================
// BOTTOM SHEET - Reusable slide-up panel component
// =============================================================================
// Powered by @gorhom/bottom-sheet for reliable keyboard handling, gesture-driven
// animations, and proper edge-to-edge support on Android.
//
// Keeps the same props API so consumers don't need major changes.
// Also re-exports gorhom components for scrollable content inside sheets.
//
// IMPORTANT: Any TextInput inside a sheet MUST be wrapped with <SheetInput>
// to register with gorhom's keyboard system. Without it, the library won't
// detect keyboard events and won't adjust the sheet.
// =============================================================================

import { sizing, spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import type { BottomSheetBackdropProps, BottomSheetFooterProps } from '@gorhom/bottom-sheet';
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  useBottomSheetInternal,
} from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import type { NativeSyntheticEvent } from 'react-native';
import {
  findNodeHandle,
  Platform,
  TextInput as RNTextInput,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';

// iOS-only: render sheets in a native FullWindowOverlay so they sit above any
// `fullScreenModal`/`formSheet`/`modal` screen from react-native-screens.
// Without it, gorhom's portal lives under the root provider — which on iOS is
// beneath the native modal VC — so sheets mount invisibly behind the screen.
// Cast needed: FullWindowOverlay requires `children`, gorhom's prop has it optional.
const IOSContainerComponent = (
  Platform.OS === 'ios' ? FullWindowOverlay : undefined
) as React.ComponentType<{ children?: React.ReactNode }> | undefined;

// -----------------------------------------------------------------------------
// Re-export gorhom components for use inside sheets
// -----------------------------------------------------------------------------

export { BottomSheetFlatList, BottomSheetFooter, BottomSheetScrollView, BottomSheetTextInput };
export type { BottomSheetFooterProps };

// -----------------------------------------------------------------------------
// SheetInput — render-prop wrapper to register TextInputs with gorhom keyboard
// -----------------------------------------------------------------------------
// MUST be rendered as a child of <BottomSheet> so it has access to the
// BottomSheetModal context. Mirrors BottomSheetTextInput's internal logic
// but works with ANY input component (MarkdownTextInput, TextInput, etc).
//
// Usage:
//   <BottomSheet ...>
//     <SheetInput>
//       {(inputProps) => (
//         <MarkdownTextInput {...inputProps} value={...} onChangeText={...} />
//       )}
//     </SheetInput>
//   </BottomSheet>
// -----------------------------------------------------------------------------

// Generic event type — we only need e.nativeEvent.target which exists on all RN events
type InputEvent = NativeSyntheticEvent<{ target: number }>;

interface SheetInputChildProps {
  ref: React.RefObject<any>;
  onFocus: (e: InputEvent) => void;
  onBlur: (e: InputEvent) => void;
}

export function SheetInput({
  children,
}: {
  children: (props: SheetInputChildProps) => React.ReactNode;
}) {
  // Use unsafe mode — returns null when not inside a BottomSheet (safe for reusable components)
  const context = useBottomSheetInternal(true);
  const inputRef = useRef<any>(null);

  // If not inside a BottomSheet, render children with a plain ref and no-op handlers
  if (!context) {
    const noop = () => {};
    return <>{children({ ref: inputRef, onFocus: noop as any, onBlur: noop as any })}</>;
  }

  return <SheetInputInner context={context} children={children} />;
}

// Inner component — always has valid context
function SheetInputInner({
  context,
  children,
}: {
  context: NonNullable<ReturnType<typeof useBottomSheetInternal>>;
  children: (props: SheetInputChildProps) => React.ReactNode;
}) {
  const inputRef = useRef<any>(null);
  const { animatedKeyboardState, textInputNodesRef } = context;

  // Register input node on mount, clean up on unmount.
  // Uses retry loop because findNodeHandle may return null if the native
  // view isn't ready yet (e.g. after a footer remount).
  useEffect(() => {
    let cancelled = false;

    const register = () => {
      const node = findNodeHandle(inputRef.current);
      if (!node) {
        if (!cancelled) requestAnimationFrame(register);
        return;
      }
      if (!textInputNodesRef.current.has(node)) {
        textInputNodesRef.current.add(node);
      }
    };
    register();

    return () => {
      cancelled = true;
      const componentNode = findNodeHandle(inputRef.current);
      if (!componentNode) return;

      const keyboardState = animatedKeyboardState.get();
      if (keyboardState.target === componentNode) {
        animatedKeyboardState.set((s: any) => ({ ...s, target: undefined }));
      }
      if (textInputNodesRef.current.has(componentNode)) {
        textInputNodesRef.current.delete(componentNode);
      }
    };
  }, [textInputNodesRef, animatedKeyboardState]);

  const onFocus = useCallback(
    (e: InputEvent) => {
      animatedKeyboardState.set((s: any) => ({
        ...s,
        target: e.nativeEvent.target,
      }));
    },
    [animatedKeyboardState],
  );

  const onBlur = useCallback(
    (e: InputEvent) => {
      const keyboardState = animatedKeyboardState.get();
      const currentFocused = findNodeHandle(
        RNTextInput.State.currentlyFocusedInput() as any,
      );

      const shouldRemove = keyboardState.target === e.nativeEvent.target;
      const shouldIgnore =
        currentFocused && textInputNodesRef.current.has(currentFocused);

      if (shouldRemove && !shouldIgnore) {
        animatedKeyboardState.set((s: any) => ({ ...s, target: undefined }));
      }
    },
    [animatedKeyboardState, textInputNodesRef],
  );

  return <>{children({ ref: inputRef, onFocus, onBlur })}</>;
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;

  // Height — always percentage-based snap points
  heightPercentage?: number;  // 0-100, default 60

  // Header
  title?: string;

  // Swipe
  enableSwipeToClose?: boolean;

  // Footer — sticky footer pinned to bottom (e.g. chat input)
  footerComponent?: React.FC<BottomSheetFooterProps>;

  // Content
  children: React.ReactNode;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function BottomSheet({
  visible,
  onClose,
  heightPercentage = 60,
  title,
  enableSwipeToClose = true,
  footerComponent,
  children,
}: BottomSheetProps) {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);

  // Track previous visible state to avoid dismiss on mount
  const wasVisible = useRef(false);

  // -------------------------------------------------------------------------
  // Bridge visible prop → present/dismiss
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (visible) {
      ref.current?.present();
      wasVisible.current = true;
    } else if (wasVisible.current) {
      ref.current?.dismiss();
      wasVisible.current = false;
    }
  }, [visible]);

  // -------------------------------------------------------------------------
  // Snap points — always percentage-based
  // -------------------------------------------------------------------------

  const snapPoints = useMemo(
    () => [`${heightPercentage}%`],
    [heightPercentage],
  );

  // -------------------------------------------------------------------------
  // Backdrop component
  // -------------------------------------------------------------------------

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    [],
  );

  // -------------------------------------------------------------------------
  // Handle dismiss callback (bridge to onClose)
  // -------------------------------------------------------------------------

  const handleDismiss = useCallback(() => {
    wasVisible.current = false;
    onClose();
  }, [onClose]);

  // -------------------------------------------------------------------------
  // Stable footer wrapper — prevents unmount/remount of footer tree
  // -------------------------------------------------------------------------
  // gorhom's BottomSheetFooterContainer is memo-wrapped and renders
  // <FooterComponent .../> as a component. If the function reference changes
  // (e.g. because useCallback deps changed), React sees a new component type
  // and unmounts the old tree. This destroys SheetInput's keyboard registration
  // and causes the keyboard to dismiss. The stable wrapper keeps the same
  // component identity and delegates to the latest callback via a ref.
  // -------------------------------------------------------------------------

  const footerComponentRef = useRef(footerComponent);
  footerComponentRef.current = footerComponent;

  const footerUpdateRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    footerUpdateRef.current?.();
  }, [footerComponent]);

  const StableFooterWrapper = useMemo(
    () =>
      function StableFooterWrapper(props: BottomSheetFooterProps) {
        const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
        useEffect(() => {
          footerUpdateRef.current = forceUpdate;
          return () => { footerUpdateRef.current = null; };
        }, []);
        return footerComponentRef.current
          ? footerComponentRef.current(props)
          : null;
      },
    [],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose={enableSwipeToClose}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      containerComponent={IOSContainerComponent}
      handleIndicatorStyle={{ backgroundColor: themeColors.borderLight }}
      backgroundStyle={{
        backgroundColor: themeColors.surface,
        borderTopLeftRadius: sizing.borderRadius.lg,
        borderTopRightRadius: sizing.borderRadius.lg,
      }}
      // Keyboard handling (docs-recommended setup)
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustPan"
      enableBlurKeyboardOnGesture={true}
      footerComponent={footerComponent ? StableFooterWrapper : undefined}
    >
      {/* Header */}
      {title ? (
        <View style={[styles.header, { borderBottomColor: themeColors.borderLight }]}>
          <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
        </View>
      ) : null}

      {/* Content — flex:1 + width replaces BottomSheetView (removed for scroll compat) */}
      <View style={[styles.content, { paddingBottom: insets.bottom }]}>
        {children}
      </View>
    </BottomSheetModal>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },

  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },

  content: {
    flex: 1,
    width: '100%',
  },
});

export default BottomSheet;
