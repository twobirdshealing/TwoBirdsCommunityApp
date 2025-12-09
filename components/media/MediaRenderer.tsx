// =============================================================================
// MEDIA RENDERER - Smart media detection and display
// =============================================================================
// Analyzes feed content and renders the appropriate media component:
// - Uploaded images → ImageMedia
// - YouTube links → YouTubeEmbed
// - Direct videos → VideoPlayer
// - Other links → LinkPreview
// =============================================================================

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feed } from '@/types';
import { ImageMedia } from './ImageMedia';
import { YouTubeEmbed } from './YouTubeEmbed';
import { VideoPlayer } from './VideoPlayer';
import { LinkPreview } from './LinkPreview';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface MediaRendererProps {
  feed: Feed;
  maxHeight?: number;
  onImagePress?: () => void;
  onVideoPlay?: () => void;
}

interface DetectedMedia {
  type: 'image' | 'youtube' | 'video' | 'link' | 'none';
  url?: string;
  videoId?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  title?: string;
  provider?: string;
}

// -----------------------------------------------------------------------------
// Media Detection Functions
// -----------------------------------------------------------------------------

// Extract YouTube video ID from various URL formats
function extractYouTubeId(text: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

// Extract Vimeo video ID
function extractVimeoId(text: string): string | null {
  const pattern = /vimeo\.com\/(\d+)/;
  const match = text.match(pattern);
  return match ? match[1] : null;
}

// Check if URL is a direct video file
function isDirectVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.m4v', '.avi'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
}

// Extract first URL from text
function extractFirstUrl(text: string): string | null {
  const urlPattern = /https?:\/\/[^\s<>"]+/gi;
  const match = text.match(urlPattern);
  return match ? match[0] : null;
}

// -----------------------------------------------------------------------------
// Main Detection Function
// -----------------------------------------------------------------------------

function detectMedia(feed: Feed): DetectedMedia {
  const message = feed.message || '';
  const messageRendered = feed.message_rendered || '';
  const meta = feed.meta || {};
  
  // 1. Check for uploaded image in meta.media_preview
  if (meta.media_preview?.image && meta.media_preview?.provider === 'uploader') {
    return {
      type: 'image',
      url: meta.media_preview.image,
      width: meta.media_preview.width,
      height: meta.media_preview.height,
    };
  }
  
  // 2. Check for featured_image
  if (feed.featured_image) {
    return {
      type: 'image',
      url: feed.featured_image,
    };
  }
  
  // 3. Check for YouTube link in message
  const youtubeId = extractYouTubeId(message) || extractYouTubeId(messageRendered);
  if (youtubeId) {
    return {
      type: 'youtube',
      videoId: youtubeId,
      thumbnail: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    };
  }
  
  // 4. Check for Vimeo (future support)
  const vimeoId = extractVimeoId(message) || extractVimeoId(messageRendered);
  if (vimeoId) {
    return {
      type: 'link', // For now, show as link preview
      url: `https://vimeo.com/${vimeoId}`,
      provider: 'vimeo',
    };
  }
  
  // 5. Check for direct video URL
  const firstUrl = extractFirstUrl(message);
  if (firstUrl && isDirectVideoUrl(firstUrl)) {
    return {
      type: 'video',
      url: firstUrl,
    };
  }
  
  // 6. Check for video content type
  if (feed.content_type === 'video' && meta.video_url) {
    return {
      type: 'video',
      url: meta.video_url,
    };
  }
  
  // 7. Check for any other link preview data in meta
  if (meta.media_preview && meta.media_preview.provider !== 'uploader') {
    return {
      type: 'link',
      url: meta.media_preview.url || firstUrl,
      thumbnail: meta.media_preview.image,
      title: meta.media_preview.title,
      provider: meta.media_preview.provider,
    };
  }
  
  // 8. No media detected
  return { type: 'none' };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function MediaRenderer({ 
  feed, 
  maxHeight = 400,
  onImagePress,
  onVideoPlay,
}: MediaRendererProps) {
  const media = detectMedia(feed);
  
  // No media to display
  if (media.type === 'none') {
    return null;
  }
  
  return (
    <View style={styles.container}>
      {/* Uploaded Image */}
      {media.type === 'image' && media.url && (
        <ImageMedia
          url={media.url}
          width={media.width}
          height={media.height}
          maxHeight={maxHeight}
          onPress={onImagePress}
        />
      )}
      
      {/* YouTube Video */}
      {media.type === 'youtube' && media.videoId && (
        <YouTubeEmbed
          videoId={media.videoId}
          onPlay={onVideoPlay}
        />
      )}
      
      {/* Direct Video File */}
      {media.type === 'video' && media.url && (
        <VideoPlayer
          url={media.url}
          onPlay={onVideoPlay}
        />
      )}
      
      {/* Link Preview */}
      {media.type === 'link' && media.url && (
        <LinkPreview
          url={media.url}
          thumbnail={media.thumbnail}
          title={media.title}
          provider={media.provider}
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
});

// Export detection function for external use
export { detectMedia, extractYouTubeId };
export default MediaRenderer;
