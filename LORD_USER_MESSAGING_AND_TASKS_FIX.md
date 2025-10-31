# Lord User Messaging and Task Assignment Fix

## Issue Summary
The Lord (MHP_LORD) user was unable to see any users in the Messages tab and couldn't assign tasks to other users. This was due to company-based filtering that prevented cross-company interactions.

## Changes Made

### 1. Backend - User List for Messaging (`server/routes.ts`)
**File**: `server/routes.ts` (lines 7996-8027)

**Problem**: The `/api/crm/company-users` endpoint only returned users from the same company, excluding Lord users without a company or preventing them from seeing users across all companies.

**Solution**: Modified the endpoint to detect Lord users and return all active users instead of filtering by company:

```typescript
// MHP_LORD can see all users, others need to be in a company
if (!isLord && !companyId) {
  return res.status(403).json({ message: 'User must be assigned to a company' });
}

const users = await storage.getUsers();

// MHP_LORD can message all active users, others only their company users
const companyUsers = isLord 
  ? users.filter(u => u.isActive)
  : users.filter(u => u.companyId === companyId && u.isActive);
```

### 2. Backend - Message Creation (`server/routes.ts`)
**File**: `server/routes.ts` (lines 8317-8351)

**Problem**: The Socket.IO message handler used `user.companyId!` which could be null for Lord users, and the schema requires a companyId for messages.

**Solution**: Enhanced the message handler to fetch the receiver's info and intelligently determine the companyId:

```typescript
// Get receiver's info to determine companyId
const receiver = await storage.getUser(data.receiverId);
if (!receiver) {
  socket.emit('message_error', { message: 'Receiver not found' });
  return;
}

// Use sender's companyId if available, otherwise use receiver's companyId
// This allows MHP_LORD users without a companyId to message anyone
const companyId = user.companyId || receiver.companyId;
```

### 3. Frontend - Task Assignment UI
**Files Modified**:
- `client/src/pages/crm/crm-tasks.tsx`
- `client/src/pages/crm/crm-deal-detail.tsx`
- `client/src/pages/crm/crm-contact-detail.tsx`
- `client/src/pages/crm/crm-unit-detail.tsx`

**Problem**: Tasks were always auto-assigned to the current user with no option to assign to others.

**Solution**: Added comprehensive task assignment functionality:

1. **Fetch Company Users**: Added query to fetch available users
2. **UI Enhancement**: Added "Assign To" dropdown in all task creation forms
3. **Default Behavior**: Defaults to current user if no one is selected
4. **Lord Visibility**: Lord users can see and assign tasks to all users across companies

Example implementation:
```typescript
// Fetch company users for task assignment
const { data: usersData } = useQuery({
  queryKey: ["/api/crm/company-users"],
  queryFn: async () => {
    const res = await fetch("/api/crm/company-users", { 
      headers: AuthManager.getAuthHeaders(),
      credentials: "include" 
    });
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  },
  enabled: !!user,
});

// Assignment dropdown
<Select 
  value={newTask.assignedTo} 
  onValueChange={(value) => setNewTask({ ...newTask, assignedTo: value })}
>
  <SelectTrigger>
    <SelectValue placeholder="Assign to me (default)" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">Assign to me (default)</SelectItem>
    {companyUsers.map((u) => (
      <SelectItem key={u.id} value={u.id}>
        {u.fullName} {u.id === user?.id ? "(me)" : ""}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

## Features Enabled

### For Lord Users:
1. ✅ Can see all active users in the Messages tab
2. ✅ Can send direct messages to any user across all companies
3. ✅ Can assign tasks to any user in the system
4. ✅ Can create tasks in CRM Tasks, Deals, Contacts, and Units pages with full assignment control

### For Regular Users:
1. ✅ Can see users within their company in the Messages tab
2. ✅ Can send direct messages to company members
3. ✅ Can assign tasks to team members within their company
4. ✅ Can choose who to assign tasks to (no longer auto-assigned to self)

## Real-Time Updates
All messaging functionality maintains real-time updates through Socket.IO:
- Messages are instantly delivered via WebSocket
- Notifications update in real-time
- Task assignments trigger real-time notifications to assigned users

## Backward Compatibility
All changes maintain backward compatibility:
- Default task assignment still goes to the current user if not specified
- Regular users maintain company-scoped visibility
- No breaking changes to existing API contracts

## Testing Recommendations
1. **Lord User Messaging**: Login as Lord user and verify all users appear in Messages tab
2. **Cross-Company Messages**: Send messages between Lord and users from different companies
3. **Task Assignment**: Create tasks and assign to different users in all CRM sections
4. **Real-Time**: Verify Socket.IO events trigger properly for messages and task updates
5. **Regular Users**: Verify non-Lord users still have company-scoped access

## Security Notes
- Lord users have elevated privileges by design (as per existing codebase patterns)
- Company-based isolation is maintained for non-Lord users
- Message encryption remains intact (as per existing DM encryption implementation)
- Authentication and authorization checks remain in place

