import { Badge } from "@/components/ui/badge";

interface NoteItemProps {
  content: string;
  authorName: string;
  createdAt: string;
  onMentionClick?: (userId: string, userName: string) => void;
}

export function NoteItem({ content, authorName, createdAt, onMentionClick }: NoteItemProps) {
  // Parse mentions from content and render them as badges
  const renderContent = () => {
    const parts: JSX.Element[] = [];
    let lastIndex = 0;
    const mentionRegex = /@\[([^:]+):([^\]]+)\]/g;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      const userId = match[1];
      const userName = match[2];
      const startIndex = match.index;

      // Add text before mention
      if (startIndex > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {content.slice(lastIndex, startIndex)}
          </span>
        );
      }

      // Add mention badge
      parts.push(
        <Badge
          key={`mention-${startIndex}`}
          variant="secondary"
          className="mx-1 cursor-pointer hover:bg-secondary/80"
          onClick={() => onMentionClick?.(userId, userName)}
        >
          @{userName}
        </Badge>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last mention
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {content.slice(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : content;
  };

  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="text-sm whitespace-pre-wrap break-words">
        {renderContent()}
      </div>
      <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
        <span className="font-medium">{authorName}</span>
        <span>•</span>
        <span>{new Date(createdAt).toLocaleString()}</span>
      </div>
    </div>
  );
}

