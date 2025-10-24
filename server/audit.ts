import { db } from './db';
import { auditLogs, type InsertAuditLog, type AuditLog } from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

// Field name mapping for user-friendly display
const FIELD_NAME_MAP: Record<string, string> = {
  // Common fields
  name: 'Name',
  description: 'Description',
  isActive: 'Status',
  
  // Company fields
  address: 'Address',
  city: 'City',
  state: 'State',
  zipCode: 'ZIP Code',
  phone: 'Phone',
  email: 'Email',
  
  // Park fields
  zip: 'ZIP Code',
  companyId: 'Company',
  lotRent: 'Lot Rent',
  amenities: 'Amenities',
  meetingPlace: 'Meeting Place',
  
  // Lot fields
  nameOrNumber: 'Lot Number',
  status: 'Status',
  price: 'Price',
  priceForRent: 'Price for Rent',
  priceForSale: 'Price for Sale',
  priceRentToOwn: 'Price for Rent to Own',
  priceContractForDeed: 'Price for Contract for Deed',
  depositForRent: 'Deposit for Rent',
  depositForSale: 'Deposit for Sale',
  depositRentToOwn: 'Deposit for Rent to Own',
  depositContractForDeed: 'Deposit for Contract for Deed',
  downPaymentContractForDeed: 'Down Payment for Contract for Deed',
  promotionalPrice: 'Promotional Price',
  promotionalPriceActive: 'Promotional Price Active',
  estimatedPayment: 'Estimated Payment',
  availableDate: 'Available Date',
  mobileHomeYear: 'Mobile Home Year',
  mobileHomeSize: 'Mobile Home Size',
  showingLink: 'Showing Link',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  sqFt: 'Square Feet',
  houseManufacturer: 'House Manufacturer',
  houseModel: 'House Model',
  parkId: 'Park',
  specialStatusId: 'Special Status',
  facebookPostId: 'Facebook Post ID',
};

// Fields to ignore in change tracking (internal/timestamp fields)
const IGNORED_FIELDS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'resetToken',
  'resetTokenExpiresAt',
]);

/**
 * Format a value for display in audit logs
 */
function formatValue(value: any): string {
  if (value === null || value === undefined || value === '') {
    return 'Not set';
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) return 'Not set';
    // Handle array of objects (like amenities)
    if (typeof value[0] === 'object' && value[0] !== null) {
      return value.map(item => {
        if (typeof item === 'string') {
          try {
            const parsed = JSON.parse(item);
            return parsed.name || item;
          } catch {
            return item;
          }
        }
        return item.name || JSON.stringify(item);
      }).join(', ');
    }
    return value.join(', ');
  }
  
  if (typeof value === 'object' && value !== null) {
    // Try to format date objects
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return JSON.stringify(value);
  }
  
  // Format as string
  return String(value);
}

/**
 * Get a user-friendly field name
 */
function getFieldDisplayName(fieldName: string): string {
  return FIELD_NAME_MAP[fieldName] || fieldName;
}

/**
 * Log a single audit entry
 */
export async function logAuditEntry(entry: InsertAuditLog): Promise<void> {
  try {
    await db.insert(auditLogs).values(entry);
  } catch (error) {
    console.error('Failed to log audit entry:', error);
    // Don't throw - audit logging should not break the main operation
  }
}

/**
 * Log creation of an entity
 */
export async function logCreation(
  entityType: string,
  entityId: string,
  entityName: string,
  userId: string,
  userName: string,
  userRole: string
): Promise<void> {
  await logAuditEntry({
    entityType,
    entityId,
    entityName,
    action: 'CREATED',
    fieldName: null,
    oldValue: null,
    newValue: null,
    userId,
    userName,
    userRole,
  });
}

/**
 * Compare two objects and generate audit log entries for changes
 */
export function compareObjects(
  oldObj: any,
  newObj: any,
  userId: string,
  userName: string,
  userRole: string,
  entityType: string,
  entityId: string,
  entityName: string
): InsertAuditLog[] {
  const entries: InsertAuditLog[] = [];
  
  // Get all keys from both objects
  const allKeys = new Set([
    ...Object.keys(oldObj || {}),
    ...Object.keys(newObj || {}),
  ]);
  
  for (const key of allKeys) {
    // Skip ignored fields
    if (IGNORED_FIELDS.has(key)) {
      continue;
    }
    
    const oldValue = oldObj?.[key];
    const newValue = newObj?.[key];
    
    // Check if values are different
    const oldStr = JSON.stringify(oldValue);
    const newStr = JSON.stringify(newValue);
    
    if (oldStr !== newStr) {
      entries.push({
        entityType,
        entityId,
        entityName,
        action: 'UPDATED',
        fieldName: key,
        oldValue: formatValue(oldValue),
        newValue: formatValue(newValue),
        userId,
        userName,
        userRole,
      });
    }
  }
  
  return entries;
}

/**
 * Log multiple audit entries at once
 */
export async function logAuditEntries(entries: InsertAuditLog[]): Promise<void> {
  if (entries.length === 0) {
    return;
  }
  
  try {
    await db.insert(auditLogs).values(entries);
  } catch (error) {
    console.error('Failed to log audit entries:', error);
    // Don't throw - audit logging should not break the main operation
  }
}

/**
 * Get audit logs for a specific entity
 */
export async function getAuditLogs(
  entityType: string,
  entityId: string,
  limit: number = 100
): Promise<AuditLog[]> {
  return await db
    .select()
    .from(auditLogs)
    .where(and(
      eq(auditLogs.entityType, entityType),
      eq(auditLogs.entityId, entityId)
    ))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

/**
 * Format an audit log entry for display
 */
export function formatAuditLogEntry(log: AuditLog): string {
  const fieldName = log.fieldName ? getFieldDisplayName(log.fieldName) : '';
  
  switch (log.action) {
    case 'CREATED':
      return `Created ${log.entityType.toLowerCase()}`;
    
    case 'UPDATED':
      if (log.fieldName === 'isActive') {
        const newStatus = log.newValue === 'Yes' ? 'Active' : 'Inactive';
        return `Changed status to ${newStatus}`;
      }
      return `Changed ${fieldName} from "${log.oldValue}" to "${log.newValue}"`;
    
    case 'DELETED':
      return `Deleted ${log.entityType.toLowerCase()}`;
    
    case 'STATUS_CHANGED':
      return `Changed status from "${log.oldValue}" to "${log.newValue}"`;
    
    default:
      return `${log.action} - ${fieldName}`;
  }
}



