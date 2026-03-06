// =============================================================================
// GIF PICKER MODAL - Search and browse Giphy GIFs
// =============================================================================
// BottomSheet with search input + 2-column grid of animated GIFs.
// Loads trending on open, debounced search, infinite scroll pagination.
// Uses BottomSheetFlatList for scroll inside gorhom sheet.
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import {
  BottomSheet,
  BottomSheetFlatList,
  SheetInput,
} from '@/components/common/BottomSheet';
import { giphyApi, GiphyGif } from '@/services/api/giphy';
import { GifAttachment } from '@/types/gif';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface GifPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (gif: GifAttachment) => void;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_GAP = spacing.xs;
const HORIZONTAL_PADDING = spacing.md;
const NUM_COLUMNS = 2;
const CELL_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - COLUMN_GAP) / NUM_COLUMNS;
const CELL_HEIGHT = 120;
const DEBOUNCE_MS = 400;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function GifPickerModal({
  visible,
  onClose,
  onSelect,
}: GifPickerModalProps) {
  const { colors: themeColors } = useTheme();
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offsetRef = useRef(0);
  const queryRef = useRef('');

  // ---------------------------------------------------------------------------
  // Fetch GIFs
  // ---------------------------------------------------------------------------

  const fetchGifs = useCallback(async (searchQuery: string, offset: number) => {
    try {
      const response = await giphyApi.searchGifs(searchQuery, offset);
      if (response.success && response.data?.gifs) {
        const newGifs = response.data.gifs;
        if (offset === 0) {
          setGifs(newGifs);
        } else {
          setGifs(prev => [...prev, ...newGifs]);
        }
        setHasMore(newGifs.length >= 20);
        offsetRef.current = offset + newGifs.length;
      }
    } catch (error) {
      if (__DEV__) console.error('[GifPicker] Error fetching GIFs:', error);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Load trending on open
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (visible) {
      setLoading(true);
      offsetRef.current = 0;
      queryRef.current = '';
      fetchGifs('', 0).finally(() => setLoading(false));
    }
  }, [visible, fetchGifs]);

  // ---------------------------------------------------------------------------
  // Debounced search
  // ---------------------------------------------------------------------------

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      queryRef.current = text;
      offsetRef.current = 0;
      setLoading(true);
      fetchGifs(text, 0).finally(() => setLoading(false));
    }, DEBOUNCE_MS);
  }, [fetchGifs]);

  // ---------------------------------------------------------------------------
  // Load more (pagination)
  // ---------------------------------------------------------------------------

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchGifs(queryRef.current, offsetRef.current).finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, fetchGifs]);

  // ---------------------------------------------------------------------------
  // Select GIF
  // ---------------------------------------------------------------------------

  const handleSelect = useCallback((gif: GiphyGif) => {
    const medium = gif.images.downsized_medium;
    const preview = gif.images.preview_gif;
    onSelect({
      image: medium.url,
      width: parseInt(medium.width, 10) || 0,
      height: parseInt(medium.height, 10) || 0,
      previewUrl: preview.url,
    });
    handleClose();
  }, [onSelect]);

  // ---------------------------------------------------------------------------
  // Close and reset
  // ---------------------------------------------------------------------------

  const handleClose = useCallback(() => {
    setQuery('');
    setGifs([]);
    setHasMore(true);
    offsetRef.current = 0;
    queryRef.current = '';
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onClose();
  }, [onClose]);

  // ---------------------------------------------------------------------------
  // Render GIF cell
  // ---------------------------------------------------------------------------

  const renderGif = useCallback(({ item }: { item: GiphyGif }) => {
    return (
      <TouchableOpacity
        style={[styles.gifCell, { backgroundColor: themeColors.backgroundSecondary }]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.images.preview_gif.url }}
          style={styles.gifImage}
          contentFit="cover"
          autoplay={true}
          recyclingKey={item.images.preview_gif.url}
          transition={200}
          cachePolicy="memory-disk"
        />
      </TouchableOpacity>
    );
  }, [themeColors.backgroundSecondary, handleSelect]);

  const keyExtractor = useCallback((_item: GiphyGif, index: number) => {
    return `${_item.images.preview_gif.url}-${index}`;
  }, []);

  // ---------------------------------------------------------------------------
  // Footer (loading more indicator)
  // ---------------------------------------------------------------------------

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoading}>
        <ActivityIndicator size="small" color={themeColors.primary} />
      </View>
    );
  }, [loadingMore, themeColors.primary]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title="Search GIFs"
      heightPercentage={75}
    >
      {/* Search Input */}
      <View style={[styles.searchContainer, { borderBottomColor: themeColors.border }]}>
        <SheetInput>
          {(inputProps) => (
            <TextInput
              {...inputProps}
              style={[styles.searchInput, {
                backgroundColor: themeColors.background,
                color: themeColors.text,
                borderColor: themeColors.borderLight,
              }]}
              placeholder="Search GIFs..."
              placeholderTextColor={themeColors.textTertiary}
              value={query}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          )}
        </SheetInput>
      </View>

      {/* GIF Grid */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : gifs.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
            {query ? 'No GIFs found' : 'No trending GIFs available'}
          </Text>
        </View>
      ) : (
        <BottomSheetFlatList
          data={gifs}
          keyExtractor={keyExtractor}
          renderItem={renderGif}
          numColumns={NUM_COLUMNS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.gridContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Giphy Attribution */}
      <View style={styles.attribution}>
        <Text style={[styles.attributionText, { color: themeColors.textTertiary }]}>
          Powered by GIPHY
        </Text>
      </View>
    </BottomSheet>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },

  searchInput: {
    fontSize: typography.size.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.md,
    borderWidth: 1,
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },

  emptyText: {
    fontSize: typography.size.md,
  },

  gridContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },

  row: {
    gap: COLUMN_GAP,
    marginBottom: COLUMN_GAP,
  },

  gifCell: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    borderRadius: sizing.borderRadius.sm,
    overflow: 'hidden',
  },

  gifImage: {
    width: '100%',
    height: '100%',
  },

  footerLoading: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },

  attribution: {
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },

  attributionText: {
    fontSize: typography.size.xs,
    fontWeight: '500',
  },
});

export default GifPickerModal;
