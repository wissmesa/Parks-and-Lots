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