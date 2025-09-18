# Parks & Lots Booking System

## Overview

A full-stack booking web application for managing companies, parks, and lots with integrated showing scheduling. The system features a public-facing property browser and private admin/manager dashboards with Google Calendar integration for scheduling property showings.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React + TypeScript**: Component-based SPA with React Router (wouter) for client-side routing
- **Shadcn/UI + Tailwind CSS**: Design system with pre-built components and utility-first styling
- **TanStack Query**: Data fetching, caching, and synchronization with automatic background updates
- **Vite**: Build tool and development server with HMR support

### Backend Architecture
- **Express.js + TypeScript**: RESTful API server with middleware-based request handling
- **JWT Authentication**: Access/refresh token pattern with role-based authorization (ADMIN, MANAGER)
- **Bcrypt**: Password hashing with salt rounds for secure user authentication
- **Multer**: File upload handling for property images with size and type validation

### Database Design
- **PostgreSQL with Drizzle ORM**: Type-safe database operations with schema migrations
- **Neon Database**: Serverless PostgreSQL with connection pooling
- **Hierarchical Data Model**: Companies → Parks → Lots → Showings with many-to-many manager assignments

### Authentication & Authorization
- **Role-Based Access Control**: 
  - Admins: Full CRUD operations across all entities
  - Managers: Limited to assigned parks and their lots
  - Public: Read-only access to parks and lots
- **Invite-Only Registration**: Managers are invited by admins via email tokens
- **JWT Token Management**: 15-minute access tokens with 7-day refresh tokens

### File Storage
- **Local Static Files**: Images stored in `/static/uploads` with public access
- **Upload Validation**: 10MB limit, image files only with MIME type checking

### State Management
- **TanStack Query**: Server state management with optimistic updates
- **Local Storage**: Client-side auth token persistence
- **React Context**: User authentication state across components

## External Dependencies

### Database
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Drizzle Kit**: Database migrations and schema management

### Authentication
- **JWT**: Token-based authentication with configurable secrets
- **bcryptjs**: Password hashing with configurable salt rounds

### Google Integration
- **Google Calendar API**: Two-way sync for showing appointments
- **OAuth 2.0**: Manager calendar connection with refresh token management
- **Google Client Libraries**: Authentication and API interaction

### UI Framework
- **Radix UI**: Accessible component primitives for complex interactions
- **Tailwind CSS**: Utility-first styling with CSS variables for theming
- **Lucide React**: Consistent icon library throughout the application

### Development Tools
- **TypeScript**: Type safety across full stack with shared schema definitions
- **ESBuild**: Fast bundling for production builds
- **PostCSS**: CSS processing with Tailwind and Autoprefixer

### File Upload
- **Multer**: Express middleware for handling multipart/form-data uploads
- **File System**: Local storage with future S3 abstraction capability

## Recent Changes

### Manager Dashboard Improvements (September 2025)
- **Simplified Dashboard Layout**: Removed "Pending Requests" section, streamlined to 2-column layout with essential metrics only
- **Lot Visibility Management**: Added enable/disable functionality for lots with visual indicators (badges, icons, opacity changes)
- **Enhanced UI/UX**: Clear status indicators (Visible/Hidden badges), toggle buttons with eye icons, immediate visual feedback
- **Accurate Statistics**: "Visible Lots" metric now counts only active (isActive) lots across all statuses
- **Secure API Integration**: Toggle endpoint with proper authentication and role-based authorization for managers

### Multi-Park Bulk Upload Enhancement (September 2025)
- **Smart Park Assignment**: Single-park managers get automatic park assignment, multi-park managers can specify target park in CSV
- **Flexible Park Specification**: Support for both `parkId` (direct) and `parkName` (case-insensitive lookup) columns in CSV files
- **Enhanced Security**: Backend validates all park assignments against manager's authorized parks, preventing unauthorized uploads
- **Improved User Experience**: Clear documentation in upload dialog explaining single vs multi-park behavior
- **Column Mapping Enhancement**: Added Park ID and Park Name as optional mapping fields with user-friendly labels
- **Robust Error Handling**: Per-row validation with detailed error messages including available parks for troubleshooting

### Mandatory Park Name Implementation (September 2025)
- **Mandatory Park Name**: Park name is now required for all bulk uploads (admins) and multi-park managers, with park ID as optional fallback
- **Backend Park Name Priority**: Both admin and manager endpoints prioritize park name over park ID for user-friendly CSV creation
- **Enhanced Validation**: Frontend validation prevents 'skip'/'ignore' selection for required park name field
- **User-Friendly CSV Format**: Users can now use familiar park names instead of technical park IDs in their CSV files
- **Comprehensive Error Messages**: Clear feedback when park names are invalid with list of available parks for easy correction