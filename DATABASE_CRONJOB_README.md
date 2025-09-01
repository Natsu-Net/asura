# Database Cronjob - Manga Database Builder

## Overview

This is a completely rebuilt database cronjob system for managing manga data. It automatically discovers new manga, updates existing entries, and normalizes slugs by removing trailing patterns like "-23723".

## Features

### 🔍 **New Manga Discovery**
- Automatically scans manga sites for new series
- Identifies manga not yet in the database
- Creates new entries with complete chapter information

### 📝 **Existing Manga Updates**
- Updates metadata (ratings, followers, images, URLs)
- Adds new chapters to existing series
- Maintains data consistency across updates

### 🧹 **Slug Normalization**
- Removes trailing patterns like "-23723" from slugs
- Converts "manga-title-23723" → "manga-title"
- Ensures clean, consistent URL structures
- Migrates existing data to normalized slugs

### 🚀 **Smart Manga Detection**
- Finds existing manga by slug, originalSlug, or title similarity
- Prevents duplicate entries
- Handles manga with multiple slug variations

### 🧹 **Database Maintenance**
- Removes duplicate manga entries
- Keeps the entry with the most chapters
- Cleans up orphaned data
- Maintains data integrity

## How It Works

### 1. **Domain Health Check**
```typescript
await checkAndUpdateDomain()
```
- Verifies the manga site is accessible
- Updates domain if redirected
- Stores new domain configuration

### 2. **Slug Migration**
```typescript
await migrateToNormalizedSlugs()
```
- Processes all existing manga
- Normalizes slugs by removing trailing numbers
- Migrates data to new slug format
- Updates manga index

### 3. **Manga Processing**
```typescript
for await (const manga of parser.getMangaList()) {
  await processManga(manga);
}
```
- Fetches manga list from the site
- Processes each manga individually
- Creates new entries or updates existing ones

### 4. **Duplicate Cleanup**
```typescript
await cleanupDuplicates()
```
- Identifies duplicate manga entries
- Keeps the entry with the most chapters
- Removes redundant data

## Slug Normalization Examples

| Original Slug | Normalized Slug |
|---------------|-----------------|
| `manga-title-23723` | `manga-title` |
| `another-series-12345` | `another-series` |
| `clean-title` | `clean-title` |
| `complex-name-999` | `complex-name` |

## Usage

### Running the Cronjob

```bash
# Run the complete database update
deno run --allow-net --allow-env --unstable-kv build-database.ts

# Or use the deno task
deno task start
```

### Programmatic Usage

```typescript
import { main, normalizeSlug, migrateToNormalizedSlugs } from "./build-database.ts";

// Run complete update
await main();

// Normalize a single slug
const cleanSlug = normalizeSlug("manga-title-23723");
// Result: "manga-title"

// Migrate existing slugs
await migrateToNormalizedSlugs();
```

## Configuration

### Environment Variables

The system automatically loads from `.env` file or system environment:

```bash
# Optional: Override default domain
MANGA_DOMAIN=https://asuracomic.net
```

### Domain Management

The system automatically:
- Detects domain changes
- Updates stored configuration
- Handles redirects gracefully

## Data Structure

### Manga Storage

```typescript
interface Manga {
  slug: string;           // Normalized slug (e.g., "manga-title")
  originalSlug?: string;  // Original slug from source
  title: string;
  imgUrl: string;
  url: string;
  chapters: Chapter[];
  // ... other metadata
}
```

### Database Keys

- `["manga_index"]` - List of all manga slugs
- `["manga_details", slug]` - Manga metadata
- `["manga_chapters", slug]` - Chapter references
- `["chapter_content", slug, number]` - Chapter content
- `["config", "domain"]` - Current domain
- `["config", "lastUpdate"]` - Last update timestamp

## Error Handling

- **Domain Issues**: Automatically detects and updates
- **Parser Errors**: Continues processing other manga
- **Database Errors**: Logs errors and continues
- **Network Timeouts**: 10-second timeout for domain checks

## Logging

The system provides comprehensive logging with emojis for easy identification:

- 🚀 **Startup**: System initialization
- 🔍 **Search**: Looking for existing manga
- 📝 **Update**: Updating existing entries
- 🆕 **Create**: Creating new entries
- 🔄 **Migration**: Slug normalization
- 🧹 **Cleanup**: Removing duplicates
- ✅ **Success**: Operations completed
- ❌ **Errors**: Issues encountered
- ⚠️ **Warnings**: Potential problems

## Performance

- **Efficient Processing**: Processes manga sequentially to avoid overwhelming the source
- **Smart Deduplication**: Only adds new chapters, doesn't reprocess existing ones
- **Batch Operations**: Groups database operations for efficiency
- **Memory Management**: Properly closes database connections

## Monitoring

### Last Update Tracking

The system stores timestamps for monitoring:

```typescript
const lastUpdate = await kv.get(["config", "lastUpdate"]);
console.log("Last update:", lastUpdate.value);
```

### Progress Tracking

Real-time progress updates during processing:

```
📖 Processing 1: Manga Title 1
📖 Processing 2: Manga Title 2
📖 Processing 3: Manga Title 3
...
```

## Troubleshooting

### Common Issues

1. **Domain Not Accessible**
   - Check network connectivity
   - Verify domain is correct
   - Check for site maintenance

2. **Slug Migration Failures**
   - Ensure database permissions
   - Check for conflicting slugs
   - Verify data integrity

3. **Parser Errors**
   - Check site structure changes
   - Verify parser compatibility
   - Review error logs

### Debug Mode

Enable detailed logging by setting environment variable:

```bash
DEBUG=true deno run build-database.ts
```

## Future Enhancements

- **Multi-site Support**: Parse multiple manga sites
- **Incremental Updates**: Only process changed manga
- **Parallel Processing**: Process multiple manga simultaneously
- **Webhook Notifications**: Notify external systems of updates
- **Metrics Collection**: Track processing statistics

## Contributing

When modifying the cronjob:

1. **Test Slug Normalization**: Ensure new patterns are handled
2. **Verify Manga Detection**: Test with various title formats
3. **Check Error Handling**: Ensure graceful failure handling
4. **Update Documentation**: Keep this README current

## License

This project follows the same license as the main codebase.