## Key Features

- **Parse badges** from markdown text
- **Update existing badges** with new properties
- **Create new badges** with customizable options
- **Generate markdown** for badges
- **Batch update** badges matching specific criteria

## Example Usage

Here's how you can use this class in your project:

```typescript
import { ShieldsBadgeManager } from './path-to-file';

// Create an instance
const badgeManager = new ShieldsBadgeManager();

// Example markdown with badges
const readmeContent = `
[![GitHub Workflow Status](https://github.com/beshkenadze/bitnami-pgvector/actions/workflows/build.yml/badge.svg)](https://github.com/beshkenadze/bitnami-pgvector/actions/workflows/build.yml) 
[![pgvector](https://img.shields.io/badge/pgvector-0.8.0-green.svg?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector/releases) 
[![PostgreSQL Versions](https://img.shields.io/badge/PostgreSQL-16%20%7C%2017-blue.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
`;

// Parse all shields.io badges
const badges = badgeManager.parseBadgesFromMarkdown(readmeContent);
console.log(`Found ${badges.length} shields.io badges`);

// Update a specific badge (e.g., pgvector version)
const updatedReadme = badgeManager.updateBadgeInMarkdown(readmeContent, 1, {
  message: '0.9.0',
  color: 'brightgreen'
});

// Update all PostgreSQL badges to use a different color
const postgresReadme = badgeManager.updateMatchingBadges(
  readmeContent,
  (badge) => badge.label.includes('PostgreSQL'),
  { color: 'purple' }
);

// Create a new badge
const newBadge = badgeManager.createBadge(
  'New Feature',
  'coming-soon',
  'orange',
  'https://github.com/your-repo',
  { logo: 'github', logoColor: 'white' }
);
```

## Class Structure

The class provides:

1. **Type definitions:**
   - `Badge` interface for badge properties
   - `BadgeUpdateOptions` interface for update parameters

2. **Core methods:**
   - `parseBadgesFromMarkdown`: Extract badges from markdown
   - `updateBadgeUrl`: Update badge URL with new options
   - `generateBadgeMarkdown`: Create markdown for a badge
   - `updateBadgeInMarkdown`: Update specific badge in markdown
   - `updateMatchingBadges`: Update all badges matching criteria
   - `createBadge`: Create a new badge from scratch