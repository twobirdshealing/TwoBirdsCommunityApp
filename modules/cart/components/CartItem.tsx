// =============================================================================
// CART ITEM — Individual cart item row for the cart bottom sheet
// =============================================================================

import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { spacing, sizing, typography } from '@/constants/layout';
import type { CartItem as CartItemType, CartSettings } from '../types';

interface CartItemProps {
  item: CartItemType;
  settings: CartSettings;
  onUpdateQuantity: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
  disabled?: boolean;
}

export const CartItemRow = React.memo(function CartItemRow({
  item,
  settings,
  onUpdateQuantity,
  onRemove,
  disabled,
}: CartItemProps) {
  const { colors } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  const handleDelete = () => {
    swipeableRef.current?.close();
    onRemove(item.key);
  };

  const renderDeleteAction = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.swipeAction,
          { backgroundColor: colors.error, transform: [{ translateX }] },
        ]}
      >
        <Pressable style={styles.swipeActionButton} onPress={handleDelete}>
          <Ionicons name="trash" size={20} color={colors.textInverse} />
        </Pressable>
      </Animated.View>
    );
  };

  const variationEntries = Object.entries(item.variation);
  const atMaxQty = item.max_quantity !== null && item.quantity >= item.max_quantity;

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderDeleteAction}
      rightThreshold={40}
      overshootRight={false}
    >
      <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        {/* Product image */}
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            style={[styles.image, { backgroundColor: colors.backgroundSecondary }]}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="image-outline" size={24} color={colors.textTertiary} />
          </View>
        )}

        {/* Product info */}
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
            {item.name}
          </Text>

          {variationEntries.length > 0 && (
            <Text style={[styles.variation, { color: colors.textSecondary }]} numberOfLines={1}>
              {variationEntries.map(([key, val]) => `${key}: ${val}`).join(', ')}
            </Text>
          )}

          <Text style={[styles.price, { color: colors.text }]}>
            {formatPrice(item.price, settings)}
          </Text>
        </View>

        {/* Quantity controls */}
        <View style={styles.quantityControls}>
          <AnimatedPressable
            style={[styles.qtyButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => {
              if (item.quantity <= 1) {
                onRemove(item.key);
              } else {
                onUpdateQuantity(item.key, item.quantity - 1);
              }
            }}
            disabled={disabled}
            haptic
          >
            <Ionicons
              name={item.quantity <= 1 ? 'trash-outline' : 'remove'}
              size={16}
              color={disabled ? colors.textTertiary : colors.text}
            />
          </AnimatedPressable>

          <Text style={[styles.qtyText, { color: colors.text }]}>
            {item.quantity}
          </Text>

          <AnimatedPressable
            style={[styles.qtyButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => onUpdateQuantity(item.key, item.quantity + 1)}
            disabled={disabled || atMaxQty}
            haptic
          >
            <Ionicons
              name="add"
              size={16}
              color={disabled || atMaxQty ? colors.textTertiary : colors.text}
            />
          </AnimatedPressable>
        </View>
      </View>
    </Swipeable>
  );
});

// -----------------------------------------------------------------------------
// Price formatting helper
// -----------------------------------------------------------------------------

export function formatPrice(value: string, settings: CartSettings): string {
  const num = parseFloat(value);
  const formatted = num.toFixed(settings.price_decimals);
  const { currency_symbol, currency_position } = settings;

  switch (currency_position) {
    case 'left':        return `${currency_symbol}${formatted}`;
    case 'right':       return `${formatted}${currency_symbol}`;
    case 'left_space':  return `${currency_symbol} ${formatted}`;
    case 'right_space': return `${formatted} ${currency_symbol}`;
    default:            return `${currency_symbol}${formatted}`;
  }
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    gap: spacing.md,
  },

  image: {
    width: 64,
    height: 64,
    borderRadius: sizing.borderRadius.sm,
  },

  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  info: {
    flex: 1,
    gap: spacing.xs,
  },

  name: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  variation: {
    fontSize: typography.size.sm,
  },

  price: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: sizing.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  qtyText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    minWidth: 20,
    textAlign: 'center',
  },

  swipeAction: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: 80,
  },

  swipeActionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
});
