// =============================================================================
// AUDIO PLAYER CONTEXT - Global audiobook playback state
// =============================================================================
// Persists across navigation so audio continues playing when switching screens.
// Provides playback controls, chapter tracking, and bookmark management.
// =============================================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import bookclubApi from '@/modules/bookclub/services/bookclubApi';
import type { BookDetail, BookChapter, BookBookmark } from '@/modules/bookclub/types/bookclub';
import { createLogger } from '@/utils/logger';

const log = createLogger('AudioPlayer');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AudioPlayerState {
  /** Currently loaded book (null if nothing playing) */
  currentBook: BookDetail | null;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Current playback position in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Current playback speed */
  playbackRate: number;
  /** Index of current chapter (-1 if no chapters) */
  currentChapterIndex: number;
  /** User's bookmarks for current book */
  bookmarks: BookBookmark[];
  /** Whether audio is loading / buffering */
  isLoading: boolean;
  /** Error message if audio failed to load */
  error: string | null;
}

interface AudioPlayerActions {
  /** Load and start playing a book */
  loadBook: (book: BookDetail) => void;
  /** Toggle play/pause */
  togglePlayPause: () => void;
  /** Seek to a specific time in seconds */
  seekTo: (seconds: number) => void;
  /** Skip forward 30 seconds */
  skipForward: () => void;
  /** Skip backward 30 seconds */
  skipBackward: () => void;
  /** Jump to a specific chapter */
  jumpToChapter: (index: number) => void;
  /** Jump to next chapter */
  nextChapter: () => void;
  /** Jump to previous chapter */
  prevChapter: () => void;
  /** Set playback speed */
  setSpeed: (rate: number) => void;
  /** Create a bookmark at the current position. Returns true on success. */
  addBookmark: (title?: string) => Promise<boolean>;
  /** Delete a bookmark. Returns true on success. */
  removeBookmark: (bookmarkId: number) => Promise<boolean>;
  /** Stop playback and clear current book */
  stop: () => void;
}

type AudioPlayerContextType = AudioPlayerState & AudioPlayerActions;

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Find which chapter the current time falls in */
function findChapterIndex(chapters: BookChapter[], currentTime: number): number {
  if (!chapters.length) return -1;
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (currentTime >= chapters[i].time) return i;
  }
  return 0;
}

/** Available speed options */
export const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2];

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentBook, setCurrentBook] = useState<BookDetail | null>(null);
  const [bookmarks, setBookmarks] = useState<BookBookmark[]>([]);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // expo-audio hooks — start with null source, use player.replace() to load audio
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  // Derived state from player status
  const isPlaying = status.playing;
  const currentTime = status.currentTime ?? 0;
  const duration = status.duration ?? 0;
  // isLoading: true when a book is set but audio hasn't finished loading yet
  const isLoading = currentBook !== null && !status.isLoaded;

  const currentChapterIndex = useMemo(
    () => findChapterIndex(currentBook?.chapters ?? [], currentTime),
    [currentBook?.chapters, currentTime]
  );

  // ---------------------------------------------------------------------------
  // Audio mode setup
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Sync playback rate when it changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (player) {
      player.setPlaybackRate(playbackRate);
    }
  }, [player, playbackRate]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const loadBook = useCallback((book: BookDetail) => {
    if (!book.single_audio_url) {
      log('No audio URL for book:', book.title);
      setError('This book has no audio file');
      return;
    }

    setError(null);
    setCurrentBook(book);
    setBookmarks(book.bookmarks ?? []);

    try {
      // Load the audio source — isLoading derived from status.isLoaded
      player.replace({ uri: book.single_audio_url });

      // Enable lock screen / notification controls with book metadata
      player.setActiveForLockScreen(true, {
        title: book.title,
        artist: book.author,
        artworkUrl: book.cover_image ?? undefined,
      });

      log('Loading book:', book.title);
    } catch (err) {
      log('Failed to load audio:', err);
      setError('Failed to load audio');
    }
  }, [player]);

  const togglePlayPause = useCallback(() => {
    if (!player) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [player, isPlaying]);

  const seekTo = useCallback((seconds: number) => {
    if (!player) return;
    const clamped = Math.max(0, Math.min(seconds, duration));
    player.seekTo(clamped);
  }, [player, duration]);

  const skipForward = useCallback(() => {
    seekTo(currentTime + 30);
  }, [seekTo, currentTime]);

  const skipBackward = useCallback(() => {
    seekTo(currentTime - 30);
  }, [seekTo, currentTime]);

  const jumpToChapter = useCallback((index: number) => {
    const chapters = currentBook?.chapters ?? [];
    if (index >= 0 && index < chapters.length) {
      seekTo(chapters[index].time);
      if (!isPlaying) player.play();
    }
  }, [currentBook?.chapters, seekTo, isPlaying, player]);

  const nextChapter = useCallback(() => {
    const chapters = currentBook?.chapters ?? [];
    if (currentChapterIndex < chapters.length - 1) {
      jumpToChapter(currentChapterIndex + 1);
    }
  }, [currentBook?.chapters, currentChapterIndex, jumpToChapter]);

  const prevChapter = useCallback(() => {
    // If more than 3 seconds into current chapter, restart it
    const chapters = currentBook?.chapters ?? [];
    if (chapters.length && currentChapterIndex >= 0) {
      const chapterStart = chapters[currentChapterIndex].time;
      if (currentTime - chapterStart > 3) {
        seekTo(chapterStart);
      } else if (currentChapterIndex > 0) {
        jumpToChapter(currentChapterIndex - 1);
      } else {
        seekTo(0);
      }
    }
  }, [currentBook?.chapters, currentChapterIndex, currentTime, seekTo, jumpToChapter]);

  const setSpeed = useCallback((rate: number) => {
    setPlaybackRate(rate);
  }, []);

  const addBookmark = useCallback(async (title?: string): Promise<boolean> => {
    if (!currentBook) return false;
    const label = title || `Bookmark at ${formatTime(currentTime)}`;
    const response = await bookclubApi.createBookmark(currentBook.id, currentTime, label);
    if (response.success) {
      setBookmarks((prev) => [response.data.bookmark, ...prev]);
      return true;
    }
    return false;
  }, [currentBook, currentTime]);

  const removeBookmark = useCallback(async (bookmarkId: number): Promise<boolean> => {
    if (!currentBook) return false;
    const response = await bookclubApi.deleteBookmark(currentBook.id, bookmarkId);
    if (response.success) {
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
      return true;
    }
    return false;
  }, [currentBook]);

  const stop = useCallback(() => {
    if (player) {
      player.pause();
      player.clearLockScreenControls();
    }
    setCurrentBook(null);
    setBookmarks([]);
    setError(null);
  }, [player]);

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

  const value = useMemo<AudioPlayerContextType>(() => ({
    currentBook,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    currentChapterIndex,
    bookmarks,
    isLoading,
    error,
    loadBook,
    togglePlayPause,
    seekTo,
    skipForward,
    skipBackward,
    jumpToChapter,
    nextChapter,
    prevChapter,
    setSpeed,
    addBookmark,
    removeBookmark,
    stop,
  }), [
    currentBook, isPlaying, currentTime, duration, playbackRate,
    currentChapterIndex, bookmarks, isLoading, error,
    loadBook, togglePlayPause, seekTo, skipForward, skipBackward,
    jumpToChapter, nextChapter, prevChapter, setSpeed, addBookmark, removeBookmark, stop,
  ]);

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useAudioPlayerContext() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayerContext must be used within AudioPlayerProvider');
  }
  return context;
}

// -----------------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------------

/** Format seconds as HH:MM:SS or MM:SS */
export function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
