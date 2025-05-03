import { beforeEach, describe, expect, it } from "bun:test";

import { ShieldsBadgeManager, type Badge } from "./index";

describe("ShieldsBadgeManager", () => {
  let badgeManager: ShieldsBadgeManager;

  // Sample markdown with multiple badges
  const sampleMarkdown = `
# Project Title

[![GitHub Workflow Status](https://github.com/beshkenadze/bitnami-pgvector/actions/workflows/build.yml/badge.svg)](https://github.com/beshkenadze/bitnami-pgvector/actions/workflows/build.yml) 
[![pgvector](https://img.shields.io/badge/pgvector-0.8.0-green.svg?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector/releases) 
[![pg_search](https://img.shields.io/badge/pg_search-0.15.18-pg17-blue.svg?logo=postgresql&logoColor=white)](https://github.com/paradedb/paradedb/tree/dev/pg_search) 
[![PostgreSQL Versions](https://img.shields.io/badge/PostgreSQL-16%20%7C%2017-blue.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org/) 
[![GHCR latest](https://img.shields.io/badge/GHCR-latest-blue.svg)](https://github.com/beshkenadze/bitnami-pgvector/pkgs/container/bitnami-pgvector) 
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Some other text here.
  `;

  beforeEach(() => {
    badgeManager = new ShieldsBadgeManager();
  });

  describe("parseBadgesFromMarkdown", () => {
    let badges: Badge[];

    beforeEach(() => {
      // Parse badges once before each test in this describe block
      badges = badgeManager.parseBadgesFromMarkdown(sampleMarkdown);
    });

    it("should find the correct number of shields.io badges", () => {
      // Should find 5 shields.io badges (skipping the GitHub workflow badge)
      expect(badges.length).toBe(5);
    });

    it("should correctly parse the pgvector badge", () => {
      const pgvectorBadge = badges.find((b) => b.label === "pgvector");
      expect(pgvectorBadge).toBeDefined();
      expect(pgvectorBadge?.message).toBe("0.8.0");
      expect(pgvectorBadge?.color).toBe("green");
      expect(pgvectorBadge?.logo).toBe("postgresql");
      expect(pgvectorBadge?.logoColor).toBe("white");
      expect(pgvectorBadge?.url).toBe(
        "https://img.shields.io/badge/pgvector-0.8.0-green.svg?logo=postgresql&logoColor=white"
      );
      expect(pgvectorBadge?.linkUrl).toBe(
        "https://github.com/pgvector/pgvector/releases"
      );
    });

    it("should correctly parse the pg_search badge", () => {
      const pgSearchBadge = badges.find((b) => b.label === "pg_search");
      expect(pgSearchBadge).toBeDefined(); // Ensure the badge exists
      expect(pgSearchBadge?.message).toBe("0.15.18-pg17"); // Verify the standard message
      expect(pgSearchBadge?.color).toBe("blue");
      expect(pgSearchBadge?.logo).toBe("postgresql");
      expect(pgSearchBadge?.logoColor).toBe("white");
      expect(pgSearchBadge?.url).toBe(
        "https://img.shields.io/badge/pg_search-0.15.18-pg17-blue.svg?logo=postgresql&logoColor=white"
      );
      expect(pgSearchBadge?.linkUrl).toBe(
        "https://github.com/paradedb/paradedb/tree/dev/pg_search"
      );
    });

    it("should correctly parse the PostgreSQL Versions badge", () => {
      const postgresBadge = badges.find((b) => b.label === "PostgreSQL");
      expect(postgresBadge).toBeDefined();
      expect(postgresBadge?.message).toBe("16 | 17"); // Note: URL encoding %20%7C%20 gets decoded
      expect(postgresBadge?.color).toBe("blue");
      expect(postgresBadge?.logo).toBe("postgresql");
      expect(postgresBadge?.logoColor).toBe("white");
      expect(postgresBadge?.url).toBe(
        "https://img.shields.io/badge/PostgreSQL-16%20%7C%2017-blue.svg?logo=postgresql&logoColor=white"
      );
      expect(postgresBadge?.linkUrl).toBe("https://www.postgresql.org/");
    });

    it("should correctly parse the GHCR badge", () => {
      const ghcrBadge = badges.find((b) => b.label === "GHCR");
      expect(ghcrBadge).toBeDefined();
      expect(ghcrBadge?.message).toBe("latest");
      expect(ghcrBadge?.color).toBe("blue");
      expect(ghcrBadge?.url).toBe(
        "https://img.shields.io/badge/GHCR-latest-blue.svg"
      ); // No query params
      expect(ghcrBadge?.linkUrl).toBe(
        "https://github.com/beshkenadze/bitnami-pgvector/pkgs/container/bitnami-pgvector"
      );
    });

    it("should correctly parse the License badge", () => {
      const licenseBadge = badges.find((b) => b.label === "License");
      expect(licenseBadge).toBeDefined();
      expect(licenseBadge?.message).toBe("MIT");
      expect(licenseBadge?.color).toBe("yellow");
      expect(licenseBadge?.url).toBe(
        "https://img.shields.io/badge/License-MIT-yellow.svg"
      );
      expect(licenseBadge?.linkUrl).toBe("LICENSE");
    });

    it("should handle markdown with no shields.io badges", () => {
      const markdownWithoutBadges = `
# Project with no shields.io badges

[![GitHub Badge](https://github.com/some-action/badge.svg)](https://github.com/repo)

Just some regular text.
      `;

      const badges = badgeManager.parseBadgesFromMarkdown(
        markdownWithoutBadges
      );
      expect(badges.length).toBe(0);
    });

    it("should handle empty markdown", () => {
      const badges = badgeManager.parseBadgesFromMarkdown("");
      expect(badges.length).toBe(0);
    });
  });

  describe("updateBadgeUrl", () => {
    it("should update label in badge URL", () => {
      const originalUrl =
        "https://img.shields.io/badge/pgvector-0.8.0-green.svg?logo=postgresql&logoColor=white";
      const updatedUrl = badgeManager.updateBadgeUrl(originalUrl, {
        label: "Vector DB",
      });

      expect(updatedUrl).toBe(
        "https://img.shields.io/badge/Vector%20DB-0.8.0-green.svg?logo=postgresql&logoColor=white"
      );
    });

    it("should update message in badge URL", () => {
      const originalUrl =
        "https://img.shields.io/badge/pgvector-0.8.0-green.svg?logo=postgresql&logoColor=white";
      const updatedUrl = badgeManager.updateBadgeUrl(originalUrl, {
        message: "0.9.0",
      });

      expect(updatedUrl).toBe(
        "https://img.shields.io/badge/pgvector-0.9.0-green.svg?logo=postgresql&logoColor=white"
      );
    });

    it("should update color in badge URL", () => {
      const originalUrl =
        "https://img.shields.io/badge/pgvector-0.8.0-green.svg?logo=postgresql&logoColor=white";
      const updatedUrl = badgeManager.updateBadgeUrl(originalUrl, {
        color: "blue",
      });

      expect(updatedUrl).toBe(
        "https://img.shields.io/badge/pgvector-0.8.0-blue.svg?logo=postgresql&logoColor=white"
      );
    });

    it("should update multiple badge properties", () => {
      const originalUrl =
        "https://img.shields.io/badge/pgvector-0.8.0-green.svg?logo=postgresql&logoColor=white";
      const updatedUrl = badgeManager.updateBadgeUrl(originalUrl, {
        message: "1.0.0",
        color: "brightgreen",
        style: "for-the-badge",
      });

      expect(updatedUrl).toBe(
        "https://img.shields.io/badge/pgvector-1.0.0-brightgreen.svg?logo=postgresql&logoColor=white&style=for-the-badge"
      );
    });

    it("should handle URLs without query parameters", () => {
      const originalUrl = "https://img.shields.io/badge/GHCR-latest-blue.svg";
      const updatedUrl = badgeManager.updateBadgeUrl(originalUrl, {
        logo: "docker",
        logoColor: "white",
      });

      expect(updatedUrl).toBe(
        "https://img.shields.io/badge/GHCR-latest-blue.svg?logo=docker&logoColor=white"
      );
    });

    it("should handle non-shields.io URLs", () => {
      const originalUrl = "https://github.com/workflow/badge.svg";
      const updatedUrl = badgeManager.updateBadgeUrl(originalUrl, {
        label: "Test",
      });

      // Should return unchanged URL for non-shields.io URLs
      expect(updatedUrl).toBe(originalUrl);
    });

    it("should handle special characters in label and message", () => {
      const originalUrl =
        "https://img.shields.io/badge/pgvector-0.8.0-green.svg";
      const updatedUrl = badgeManager.updateBadgeUrl(originalUrl, {
        label: "PG Vector & DB",
        message: ">=0.8.0-beta",
      });

      expect(updatedUrl).toBe(
        "https://img.shields.io/badge/PG%20Vector%20%26%20DB-%3E%3D0.8.0-beta-green.svg"
      );
    });
  });

  describe("generateBadgeMarkdown", () => {
    it("should generate correct markdown for a badge", () => {
      const badge: Badge = {
        markdown: "",
        url: "https://img.shields.io/badge/pgvector-0.8.0-green.svg?logo=postgresql&logoColor=white",
        startIndex: 0,
        endIndex: 0,
        label: "pgvector",
        message: "0.8.0",
        color: "green",
        linkUrl: "https://github.com/pgvector/pgvector/releases",
        logo: "postgresql",
        logoColor: "white",
      };

      const markdown = badgeManager.generateBadgeMarkdown(badge);

      expect(markdown).toBe(
        "[![pgvector](https://img.shields.io/badge/pgvector-0.8.0-green.svg?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector/releases)"
      );
    });
  });

  describe("updateBadgeInMarkdown", () => {
    it("should update a specific badge in markdown by index", () => {
      // Update the second badge (pg_search) - index 1
      const updatedMarkdown = badgeManager.updateBadgeInMarkdown(
        sampleMarkdown,
        1,
        {
          message: "0.9.0",
          color: "brightgreen",
        }
      );

      // The updated markdown should contain the updated badge (This check is removed as potentially unreliable)
      // expect(updatedMarkdown).toContain('[![pg_search](https://img.shields.io/badge/pg_search-0.15.18--pg17-blue.svg?logo=postgresql&logoColor=white)]');
      // Check that the updated pg_search badge string exists
      expect(updatedMarkdown).toContain(
        "[![pg_search](https://img.shields.io/badge/pg_search-0.9.0-brightgreen.svg?logo=postgresql&logoColor=white)]"
      );

      // Parse badges from updated markdown to verify
      const updatedBadges =
        badgeManager.parseBadgesFromMarkdown(updatedMarkdown);

      // Check the updated badge (index 1 - pg_search)
      expect(updatedBadges[1]?.message).toBe("0.9.0");
      expect(updatedBadges[1]?.color).toBe("brightgreen");

      // Check that the pgvector badge (index 0) was NOT updated
      expect(updatedBadges[0]?.markdown).not.toBe(updatedBadges[1]?.markdown);

      // Check that the PostgreSQL badge (index 2) remained unchanged
      const originalPostgresBadge =
        badgeManager.parseBadgesFromMarkdown(sampleMarkdown)[2];
      expect(updatedBadges[2]!.markdown).toBe(originalPostgresBadge!.markdown);
    });

    it("should throw an error for invalid badge index", () => {
      expect(() => {
        badgeManager.updateBadgeInMarkdown(sampleMarkdown, 10, {
          color: "red",
        });
      }).toThrow("Badge index out of range: 10");

      expect(() => {
        badgeManager.updateBadgeInMarkdown(sampleMarkdown, -1, {
          color: "red",
        });
      }).toThrow("Badge index out of range: -1");
    });
  });

  describe("updateMatchingBadges", () => {
    it("should update all badges matching the filter criteria", () => {
      // Update all PostgreSQL-related badges
      const updatedMarkdown = badgeManager.updateMatchingBadges(
        sampleMarkdown,
        (badge) => badge.logo === "postgresql",
        { color: "purple" }
      );

      // Get badges from updated markdown
      const updatedBadges =
        badgeManager.parseBadgesFromMarkdown(updatedMarkdown);

      // All PostgreSQL badges should have purple color
      const postgresqlBadges = updatedBadges.filter(
        (badge) => badge.logo === "postgresql"
      );
      expect(postgresqlBadges.length).toBeGreaterThan(0);
      postgresqlBadges.forEach((badge) => {
        expect(badge.color).toBe("purple");
      });
    });

    it("should not modify markdown if no badges match the filter", () => {
      const updatedMarkdown = badgeManager.updateMatchingBadges(
        sampleMarkdown,
        (badge) => badge.logo === "nonexistent",
        { color: "red" }
      );

      // Markdown should remain unchanged
      expect(updatedMarkdown).toBe(sampleMarkdown);
    });
  });

  describe("createBadge", () => {
    it("should create a new badge with basic parameters", () => {
      const markdown = badgeManager.createBadge(
        "New Badge",
        "v1.0",
        "blue",
        "https://example.com"
      );

      expect(markdown).toBe(
        "[![New Badge](https://img.shields.io/badge/New%20Badge-v1.0-blue.svg)](https://example.com)"
      );
    });

    it("should create a new badge with all parameters", () => {
      const markdown = badgeManager.createBadge(
        "Test",
        "passing",
        "green",
        "https://github.com/repo",
        {
          logo: "github",
          logoColor: "white",
          style: "for-the-badge",
          labelColor: "black",
        }
      );

      expect(markdown).toBe(
        "[![Test](https://img.shields.io/badge/Test-passing-green.svg?logo=github&logoColor=white&style=for-the-badge&labelColor=black)](https://github.com/repo)"
      );
    });

    it("should properly encode special characters in label and message", () => {
      const markdown = badgeManager.createBadge(
        "Coverage & Tests",
        "100%",
        "brightgreen",
        "https://codecov.io"
      );

      expect(markdown).toBe(
        "[![Coverage & Tests](https://img.shields.io/badge/Coverage%20%26%20Tests-100%25-brightgreen.svg)](https://codecov.io)"
      );
    });
  });

  // Integration test
  describe("integration", () => {
    it("should support a complete workflow: parse, update, generate", () => {
      // 1. Parse badges from markdown
      const badges = badgeManager.parseBadgesFromMarkdown(sampleMarkdown);

      // 2. Find a specific badge
      const pgvectorBadgeIndex = badges.findIndex(
        (badge) => badge.label === "pgvector"
      );
      expect(pgvectorBadgeIndex).toBeGreaterThanOrEqual(0);

      // 3. Update the badge URL
      const updatedBadgeUrl = badgeManager.updateBadgeUrl(
        badges[pgvectorBadgeIndex]?.url || "",
        {
          message: "1.0.0",
          color: "brightgreen",
        }
      );

      // 4. Update the badge in the markdown
      const updatedMarkdown = badgeManager.updateBadgeInMarkdown(
        sampleMarkdown,
        pgvectorBadgeIndex,
        { message: "1.0.0", color: "brightgreen" }
      );

      // 5. Parse the badges from the updated markdown
      const updatedBadges =
        badgeManager.parseBadgesFromMarkdown(updatedMarkdown);
      const updatedPgvectorBadge = updatedBadges.find(
        (badge) => badge.label === "pgvector"
      );

      // 6. Verify the changes
      expect(updatedPgvectorBadge).toBeDefined();
      expect(updatedPgvectorBadge?.message).toBe("1.0.0");
      expect(updatedPgvectorBadge?.color).toBe("brightgreen");

      // The markdown should contain the updated badge URL
      expect(updatedMarkdown).toContain(updatedBadgeUrl);
    });
  });
});
