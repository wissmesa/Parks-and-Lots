import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface User {
  id: string;
  fullName: string;
  email: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  users: User[];
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

export function MentionTextarea({
  value,
  onChange,
  users,
  placeholder = "Type @ to mention someone...",
  rows = 3,
  disabled = false,
}: MentionTextareaProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionPosition, setMentionPosition] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter users based on search
  const filteredUsers = users.filter((user) =>
    user.fullName.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Handle @ symbol detection
  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(cursorPos);

    // Check if @ was just typed
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      
      // Check if there's a space after @ (then we shouldn't show mentions)
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setMentionSearch(textAfterAt);
        setMentionPosition(lastAtIndex);
        setShowMentions(true);
        return;
      }
    }
    
    setShowMentions(false);
  };

  // Handle user selection
  const handleUserSelect = (user: User) => {
    const beforeMention = value.slice(0, mentionPosition);
    const afterMention = value.slice(cursorPosition);
    
    // Insert mention in format @[userId:DisplayName]
    const mention = `@[${user.id}:${user.fullName}]`;
    const newValue = beforeMention + mention + " " + afterMention;
    
    onChange(newValue);
    setShowMentions(false);
    setMentionSearch("");
    
    // Focus back to textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mention.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle keyboard events
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && (e.key === "Escape" || e.key === "Backspace")) {
      if (e.key === "Escape") {
        setShowMentions(false);
        e.preventDefault();
      }
    }
  };

  // Parse mentions for display (show as @Name instead of @[id:Name])
  const displayValue = value.replace(/@\[([^:]+):([^\]]+)\]/g, "@$2");

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={displayValue}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="resize-none"
      />
      
      {showMentions && filteredUsers.length > 0 && (
        <div className="absolute z-50 mt-1 w-64 rounded-md border bg-popover p-1 shadow-md">
          <Command>
            <CommandList>
              <CommandGroup>
                {filteredUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    onSelect={() => handleUserSelect(user)}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{user.fullName}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {filteredUsers.length === 0 && (
                <CommandEmpty>No users found</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}

