// =============================================================================
// CART SUMMARY — Totals, coupons, and checkout button
// =============================================================================

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SheetInput } from '@/components/common/BottomSheet';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/common/Button';
import { spacing, sizing, typography } from '@/constants/layout';
import { SITE_URL } from '@/constants/config';
import type { CartCoupon, CartFee, CartSettings, CartTotals } from '../types';
import { formatPrice } from './CartItem';

interface CartSummaryProps {
  totals: CartTotals;
  coupons: CartCoupon[];
  fees: CartFee[];
  settings: CartSettings;
  onApplyCoupon: (code: string) => Promise<boolean>;
  onRemoveCoupon: (code: string) => void;
  onClose: () => void;
  couponLoading?: boolean;
  couponError?: string | null;
}

export function CartSummary({
  totals,
  coupons,
  fees,
  settings,
  onApplyCoupon,
  onRemoveCoupon,
  onClose,
  couponLoading,
  couponError,
}: CartSummaryProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const [couponInput, setCouponInput] = useState('');

  const handleApplyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    const success = await onApplyCoupon(code);
    if (success) setCouponInput('');
  };

  const handleCheckout = () => {
    onClose();
    router.push({ pathname: '/webview', params: { url: `${SITE_URL}/checkout/`, title: 'Checkout' } });
  };

  const hasDiscount = parseFloat(totals.discount) > 0;
  const hasTax = settings.tax_enabled && parseFloat(totals.tax) > 0;
  const hasShipping = settings.shipping_enabled && parseFloat(totals.shipping) > 0;

  return (
    <View style={[styles.container, { borderTopColor: colors.borderLight }]}>

      {/* Coupon section */}
      {settings.coupons_enabled && (
        <View style={styles.couponSection}>
          <View style={styles.couponInputRow}>
            <SheetInput>
              {(inputProps) => (
                <TextInput
                  {...inputProps}
                  style={[
                    styles.couponInput,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      color: colors.text,
                      borderColor: couponError ? colors.error : colors.border,
                    },
                  ]}
                  placeholder="Coupon code"
                  placeholderTextColor={colors.textTertiary}
                  value={couponInput}
                  onChangeText={setCouponInput}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleApplyCoupon}
                />
              )}
            </SheetInput>
            <Button
              title="Apply"
              variant="secondary"
              size="sm"
              onPress={handleApplyCoupon}
              loading={couponLoading}
              disabled={!couponInput.trim()}
            />
          </View>

          {couponError && (
            <Text style={[styles.couponError, { color: colors.error }]}>{couponError}</Text>
          )}

          {/* Applied coupons */}
          {coupons.length > 0 && (
            <View style={styles.couponPills}>
              {coupons.map((coupon) => (
                <View
                  key={coupon.code}
                  style={[styles.couponPill, { backgroundColor: colors.backgroundSecondary }]}
                >
                  <Ionicons name="pricetag-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.couponPillText, { color: colors.text }]}>
                    {coupon.code.toUpperCase()}
                  </Text>
                  <Pressable onPress={() => onRemoveCoupon(coupon.code)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Totals breakdown */}
      <View style={styles.totalsSection}>
        <TotalRow label="Subtotal" value={totals.subtotal} settings={settings} />
        {hasDiscount && <TotalRow label="Discount" value={totals.discount} settings={settings} highlight negative />}
        {hasShipping && <TotalRow label="Shipping" value={totals.shipping} settings={settings} />}
        {fees.map((fee) => (
          <TotalRow key={fee.name} label={fee.name} value={fee.amount} settings={settings} />
        ))}
        {hasTax && <TotalRow label="Tax" value={totals.tax} settings={settings} />}

        <View style={[styles.totalDivider, { borderTopColor: colors.borderLight }]} />

        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, styles.totalFinal, { color: colors.text }]}>Total</Text>
          <Text style={[styles.totalValue, styles.totalFinal, { color: colors.text }]}>
            {formatPrice(totals.total, settings)}
          </Text>
        </View>
      </View>

      {/* Checkout button */}
      <Button
        title="Proceed to Checkout"
        variant="primary"
        onPress={handleCheckout}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Total Row
// -----------------------------------------------------------------------------

function TotalRow({
  label,
  value,
  settings,
  highlight,
  negative,
}: {
  label: string;
  value: string;
  settings: CartSettings;
  highlight?: boolean;
  negative?: boolean;
}) {
  const { colors } = useTheme();
  const formatted = formatPrice(value, settings);
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.totalValue,
          { color: highlight ? colors.success : colors.textSecondary },
        ]}
      >
        {negative ? `-${formatted}` : formatted}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.lg,
  },

  // Coupon
  couponSection: {
    gap: spacing.sm,
  },

  couponInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  couponInput: {
    flex: 1,
    height: sizing.height.buttonSmall,
    borderRadius: sizing.borderRadius.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.sm,
    borderWidth: 1,
  },

  couponError: {
    fontSize: typography.size.xs,
  },

  couponPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  couponPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.full,
  },

  couponPillText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  // Totals
  totalsSection: {
    gap: spacing.sm,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  totalLabel: {
    fontSize: typography.size.sm,
  },

  totalValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  totalDivider: {
    borderTopWidth: 1,
    marginVertical: spacing.xs,
  },

  totalFinal: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
});
