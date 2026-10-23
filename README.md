# Consumption Production - Pure React Frontend

This is a pure React + Vite frontend application converted from the original ConsumptionProduction project.

## Features

- **Pure React + Vite**: Modern React development with Vite for fast builds
- **TypeScript**: Full TypeScript support for better development experience
- **Tailwind CSS**: Utility-first CSS framework for styling
- **React Router**: Client-side routing for navigation
- **Shadcn/UI Components**: Beautiful, accessible UI components
- **React Hook Form**: Form handling with validation
- **Zod**: Schema validation
- **React Query**: Data fetching and caching
- **Lucide React**: Beautiful icons

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update the environment variables in `.env`:
```
VITE_BASE_URL=http://localhost:3000
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

Build the application:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Shadcn/UI components
│   ├── layout/         # Layout components
│   ├── dashboard/      # Dashboard-specific components
│   └── common/         # Common components
├── pages/              # Page components
├── lib/                # Utility functions and configurations
├── hooks/              # Custom React hooks
└── assets/             # Static assets
```

## Key Components

- **Login**: Authentication page with form validation
- **Dashboard**: Main dashboard with metrics and navigation
- **VoucherTypesMetrics**: Dashboard component for voucher type metrics
- **Loader**: Loading component with animations

## Technologies Used

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router DOM
- React Hook Form
- Zod
- React Query
- Lucide React
- Radix UI (via Shadcn/UI)

## Converting from Original Project

This project was converted from the original ConsumptionProduction project which used:
- Wouter for routing (converted to React Router)
- Different project structure (simplified for pure React)
- All functionality preserved with modern React patterns

## License

MIT License
