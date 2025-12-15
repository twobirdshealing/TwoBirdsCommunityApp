# FullScreenPost Component Update

## Change Needed

Add `showCloseButton` prop to FullScreenPost component.

### In `components/feed/FullScreenPost.tsx`:

**1. Update Props Interface** (around line 52):

```typescript
interface FullScreenPostProps {
  feed: Feed;
  isActive: boolean;
  onClose: () => void;
  onReact: (type: 'like' | 'love') => void;
  onCommentPress: () => void;
  onAuthorPress: () => void;
  showCloseButton?: boolean;  // ← ADD THIS
}
```

**2. Destructure Prop** (around line 62):

```typescript
export function FullScreenPost({
  feed,
  isActive,
  onClose,
  onReact,
  onCommentPress,
  onAuthorPress,
  showCloseButton = true,  // ← ADD THIS (default true for backward compatibility)
}: FullScreenPostProps) {
```

**3. Conditionally Render Close Button** (around line 265):

**FIND:**
```typescript
{/* HEADER: Close button */}
<TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
  <Text style={styles.closeIcon}>✕</Text>
</TouchableOpacity>
```

**REPLACE WITH:**
```typescript
{/* HEADER: Close button - Only show if requested */}
{showCloseButton && (
  <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
    <Text style={styles.closeIcon}>✕</Text>
  </TouchableOpacity>
)}
```

That's it! 3 small changes.

## Why This Works

- **Default `true`**: Existing code keeps working
- **Explicitly `false`**: New feed viewer hides X button (uses back button instead)
- **No breaking changes**: All existing usages continue to work
